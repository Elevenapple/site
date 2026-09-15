import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/role-fit/generation', () => ({
  generateFitBrief: vi.fn(async () => {
    throw new Error('generateFitBrief mock not configured for this test');
  }),
}));

import type { FitApiError, FitBrief } from '../../src/features/role-fit/types';
import {
  handleFitRequest,
  type FitFailureDiagnostic,
} from '../../server/role-fit/handler';
import { FIT_STOPPED_COPY } from '../../src/features/role-fit/stages';

const privateRoleText = `PRIVATE ROLE MATERIAL. ${'Build reliable React and TypeScript systems for customer-facing product workflows. '.repeat(8)}`;

function requestFor(
  text = privateRoleText,
  origin = 'https://paprikaf.com'
): Request {
  return new Request('https://paprikaf.com/api/fit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      'X-Forwarded-For': '203.0.113.20',
    },
    body: JSON.stringify({ input: { type: 'text', text } }),
  });
}

function briefFor(requestId: string): FitBrief {
  return {
    role: {
      title: null,
      company: null,
      sourceKind: 'text',
      requirements: [],
    },
    summary: 'Public-record comparison.',
    matches: [],
    unknowns: [],
    interviewQuestions: [],
    meta: {
      requestId,
      evidenceVersion: 'test-evidence',
      generatedAt: '2026-08-27T12:00:00.000Z',
    },
  };
}

function clock(startedAt: number, finishedAt: number) {
  return vi
    .fn<() => number>()
    .mockReturnValueOnce(startedAt)
    .mockReturnValue(finishedAt);
}

async function readSseText(response: Response): Promise<string> {
  return response.text();
}

describe('role-fit HTTP handler', () => {
  it('streams a successful no-store UI message response without failure logging', async () => {
    const logFailure = vi.fn<(diagnostic: FitFailureDiagnostic) => void>();
    const generate = vi.fn(
      async (
        _roleText: string,
        requestId: string,
        _signal: AbortSignal,
        onStage?: (stage: 1 | 2 | 3) => void
      ): Promise<FitBrief> => {
        onStage?.(1);
        onStage?.(2);
        onStage?.(3);
        return briefFor(requestId);
      }
    );
    const request = requestFor();

    const response = await handleFitRequest(request, {
      createRequestId: () => 'request-success',
      now: () => 1_000,
      logFailure,
      takeFitRateLimit: () => ({ allowed: true }),
      generateFitBrief: generate,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('X-Request-Id')).toBe('request-success');
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');

    const body = await readSseText(response);
    expect(body).toContain('"type":"data-stage"');
    expect(body).toContain('Reading the role');
    expect(body).toContain('Matching public claims');
    expect(body).toContain('Drafting gaps and three questions');
    expect(body).toContain('"type":"data-brief"');
    expect(body).toContain('request-success');
    expect(generate).toHaveBeenCalledWith(
      privateRoleText.trim(),
      'request-success',
      request.signal,
      expect.any(Function)
    );
    expect(logFailure).not.toHaveBeenCalled();
  });

  it('enforces same-origin and logs only the four safe diagnostic fields', async () => {
    const logFailure = vi.fn<(diagnostic: FitFailureDiagnostic) => void>();

    const response = await handleFitRequest(
      requestFor(privateRoleText, 'https://attacker.example'),
      {
        createRequestId: () => 'request-origin',
        now: clock(2_000, 2_025),
        logFailure,
      }
    );

    expect(response.status).toBe(403);
    expect(((await response.json()) as FitApiError).error.code).toBe(
      'forbidden-origin'
    );
    expect(logFailure).toHaveBeenCalledWith({
      requestId: 'request-origin',
      errorClass: 'ForbiddenOriginError',
      status: 403,
      durationMs: 25,
    });
    expect(Object.keys(logFailure.mock.calls[0]![0]).sort()).toEqual([
      'durationMs',
      'errorClass',
      'requestId',
      'status',
    ]);
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain(
      'PRIVATE ROLE MATERIAL'
    );
  });

  it('streams fixed provider errors without logging input or error messages', async () => {
    class ProviderFailure extends Error {}

    const logFailure = vi.fn<(diagnostic: FitFailureDiagnostic) => void>();
    const generate = vi.fn(async (): Promise<FitBrief> => {
      throw new ProviderFailure('api-key-secret provider response');
    });

    const response = await handleFitRequest(requestFor(), {
      createRequestId: () => 'request-provider',
      now: clock(3_000, 3_018),
      logFailure,
      takeFitRateLimit: () => ({ allowed: true }),
      generateFitBrief: generate,
    });
    const body = await readSseText(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
    expect(body).toContain('"type":"data-error"');
    expect(body).toContain(FIT_STOPPED_COPY);
    expect(body).not.toContain('api-key-secret');
    expect(logFailure).toHaveBeenCalledWith({
      requestId: 'request-provider',
      errorClass: 'ProviderFailure',
      status: 502,
      durationMs: 18,
    });
    const serializedLog = JSON.stringify(logFailure.mock.calls);
    expect(serializedLog).not.toContain('PRIVATE ROLE MATERIAL');
    expect(serializedLog).not.toContain('api-key-secret');
  });

  it('preserves rate-limit status, retry headers, and safe diagnostics', async () => {
    const logFailure = vi.fn<(diagnostic: FitFailureDiagnostic) => void>();

    const response = await handleFitRequest(requestFor(), {
      createRequestId: () => 'request-limited',
      now: clock(4_000, 4_009),
      logFailure,
      takeFitRateLimit: () => ({
        allowed: false,
        retryAfterSeconds: 321,
      }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('321');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(logFailure).toHaveBeenCalledWith({
      requestId: 'request-limited',
      errorClass: 'RateLimitError',
      status: 429,
      durationMs: 9,
    });
  });

  it('maps provider timeouts into the stream without exposing the thrown error', async () => {
    const timeout = new Error('private timeout details');
    timeout.name = 'TimeoutError';
    const logFailure = vi.fn<(diagnostic: FitFailureDiagnostic) => void>();

    const response = await handleFitRequest(requestFor(), {
      createRequestId: () => 'request-timeout',
      now: clock(5_000, 5_040),
      logFailure,
      takeFitRateLimit: () => ({ allowed: true }),
      generateFitBrief: async () => {
        throw timeout;
      },
    });

    const body = await readSseText(response);
    expect(response.status).toBe(200);
    expect(body).toContain('"type":"data-error"');
    expect(body).toContain('provider-timeout');
    expect(body).toContain(FIT_STOPPED_COPY);
    expect(body).not.toContain('private timeout details');
    expect(logFailure).toHaveBeenCalledWith({
      requestId: 'request-timeout',
      errorClass: 'ProviderTimeoutError',
      status: 504,
      durationMs: 40,
    });
    expect(JSON.stringify(logFailure.mock.calls)).not.toContain(
      'private timeout details'
    );
  });
});
