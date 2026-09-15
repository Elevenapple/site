import { randomUUID } from 'node:crypto';

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  RetryError,
  type InferUIMessageChunk,
  type UIMessage,
} from 'ai';

import {
  FIT_STAGE_COPY,
  FIT_STOPPED_COPY,
  type FitStageId,
} from '../../src/features/role-fit/stages.js';
import type {
  FitApiError,
  FitApiErrorCode,
  FitBrief,
} from '../../src/features/role-fit/types.js';
import { generateFitBrief, type FitStageListener } from './generation.js';
import { takeFitRateLimit } from './rate-limit.js';
import {
  FitValidationError,
  isSameOriginRequest,
  readAndValidateFitRequest,
} from './validation.js';

const jsonResponseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};

const streamExtraHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};

type FitStreamDataParts = {
  stage: {
    stage: FitStageId;
    label: string;
  };
  brief: FitBrief;
  error: {
    code: FitApiErrorCode;
    message: string;
  };
};

type FitUIMessage = UIMessage<never, FitStreamDataParts>;

export type FitFailureDiagnostic = {
  requestId: string;
  errorClass: string;
  status: number;
  durationMs: number;
};

export type FitHandlerDependencies = {
  generateFitBrief: typeof generateFitBrief;
  takeFitRateLimit: typeof takeFitRateLimit;
  createRequestId: () => string;
  now: () => number;
  logFailure: (diagnostic: FitFailureDiagnostic) => void;
};

function defaultFailureLogger(diagnostic: FitFailureDiagnostic): void {
  console.error(diagnostic);
}

function safeErrorClass(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const className = error.constructor.name;
    if (/^[A-Za-z_$][A-Za-z0-9_$]{0,99}$/.test(className)) {
      return className;
    }
  }
  return fallback;
}

function errorResponse(
  status: number,
  code: FitApiErrorCode,
  message: string,
  requestId: string,
  additionalHeaders?: HeadersInit
): Response {
  const body: FitApiError = { error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonResponseHeaders,
      'X-Request-Id': requestId,
      ...additionalHeaders,
    },
  });
}

function isProviderTimeout(
  error: unknown,
  requestSignal: AbortSignal
): boolean {
  if (requestSignal.aborted) {
    return false;
  }

  if (RetryError.isInstance(error) && error.reason === 'abort') {
    return true;
  }

  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || /timed?\s*out/i.test(error.message))
  );
}

function writeStage(
  writer: { write: (part: InferUIMessageChunk<FitUIMessage>) => void },
  stage: FitStageId
): void {
  writer.write({
    type: 'data-stage',
    id: 'fit-stage',
    data: {
      stage,
      label: FIT_STAGE_COPY[stage],
    },
    transient: true,
  });
}

export async function handleFitRequest(
  request: Request,
  dependencyOverrides: Partial<FitHandlerDependencies> = {}
): Promise<Response> {
  const generate = dependencyOverrides.generateFitBrief ?? generateFitBrief;
  const rateLimit = dependencyOverrides.takeFitRateLimit ?? takeFitRateLimit;
  const createRequestId = dependencyOverrides.createRequestId ?? randomUUID;
  const now = dependencyOverrides.now ?? Date.now;
  const logFailure = dependencyOverrides.logFailure ?? defaultFailureLogger;
  const requestId = createRequestId();
  const startedAt = now();

  const fail = (
    status: number,
    code: FitApiErrorCode,
    message: string,
    errorClass: string,
    additionalHeaders?: HeadersInit
  ): Response => {
    const diagnostic: FitFailureDiagnostic = {
      requestId,
      errorClass,
      status,
      durationMs: Math.max(0, Math.round(now() - startedAt)),
    };
    try {
      logFailure(diagnostic);
    } catch {
      // Diagnostics must never alter the public API response.
    }
    return errorResponse(status, code, message, requestId, additionalHeaders);
  };

  if (request.method !== 'POST') {
    return fail(
      405,
      'invalid-input',
      'Only POST requests are supported.',
      'MethodNotAllowedError',
      { Allow: 'POST' }
    );
  }

  if (!isSameOriginRequest(request)) {
    return fail(
      403,
      'forbidden-origin',
      'This request must come from the portfolio website.',
      'ForbiddenOriginError'
    );
  }

  let roleText: string;
  try {
    const payload = await readAndValidateFitRequest(request);
    roleText = payload.input.text;
  } catch (error) {
    if (error instanceof FitValidationError) {
      return fail(400, 'invalid-input', error.message, 'FitValidationError');
    }
    return fail(
      400,
      'invalid-input',
      'The role description could not be read.',
      safeErrorClass(error, 'RequestReadError')
    );
  }

  const rateLimitDecision = rateLimit(request);
  if (!rateLimitDecision.allowed) {
    return fail(
      429,
      'rate-limited',
      'You have reached the demo limit for now. Please try again later.',
      'RateLimitError',
      { 'Retry-After': String(rateLimitDecision.retryAfterSeconds) }
    );
  }

  const stream = createUIMessageStream<FitUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });

      const onStage: FitStageListener = (stage) => {
        if (!request.signal.aborted) {
          writeStage(writer, stage);
        }
      };

      try {
        const fitBrief = await generate(
          roleText,
          requestId,
          request.signal,
          onStage
        );

        if (request.signal.aborted) {
          return;
        }

        writer.write({
          type: 'data-brief',
          id: 'fit-brief',
          data: fitBrief,
        });
        writer.write({ type: 'finish' });
      } catch (error) {
        if (request.signal.aborted) {
          return;
        }

        const timedOut = isProviderTimeout(error, request.signal);
        const status = timedOut ? 504 : 502;
        const code: FitApiErrorCode = timedOut
          ? 'provider-timeout'
          : 'generation-failed';
        const message = timedOut
          ? 'The comparison took too long. Please try again.'
          : 'The comparison could not be generated. Please try again.';
        const errorClass = timedOut
          ? 'ProviderTimeoutError'
          : safeErrorClass(error, 'GenerationError');

        try {
          logFailure({
            requestId,
            errorClass,
            status,
            durationMs: Math.max(0, Math.round(now() - startedAt)),
          });
        } catch {
          // Diagnostics must never alter the public API response.
        }

        writer.write({
          type: 'data-error',
          id: 'fit-error',
          data: {
            code,
            message: FIT_STOPPED_COPY,
          },
          transient: true,
        });
        writer.write({
          type: 'error',
          errorText: message,
        });
      }
    },
    onError: () => FIT_STOPPED_COPY,
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      ...streamExtraHeaders,
      'X-Request-Id': requestId,
    },
  });
}
