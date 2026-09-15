import type { FitApiError, FitBrief } from './types';
import {
  FIT_STAGE_COPY,
  FIT_STOPPED_COPY,
  isFitStageId,
  type FitStageId,
} from './stages';

export { FIT_STAGE_COPY, FIT_STOPPED_COPY, type FitStageId };

export type FitStreamEvent =
  | { type: 'stage'; stage: FitStageId; label: string }
  | { type: 'brief'; brief: FitBrief }
  | { type: 'error'; error: FitApiError['error'] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse Vercel AI SDK UI message SSE (`createUIMessageStreamResponse`) for
 * role-fit data parts: `data-stage`, `data-brief`, `data-error`, and `error`.
 */
export async function consumeFitUiMessageStream(
  response: Response,
  onEvent: (event: FitStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!response.body) {
    throw new Error('The comparison stream was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };

  if (signal) {
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) {
            continue;
          }

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') {
            continue;
          }

          let chunk: unknown;
          try {
            chunk = JSON.parse(payload) as unknown;
          } catch {
            continue;
          }

          if (!isRecord(chunk) || typeof chunk.type !== 'string') {
            continue;
          }

          if (chunk.type === 'data-stage' && isRecord(chunk.data)) {
            const stage = chunk.data.stage;
            if (isFitStageId(stage)) {
              const label =
                typeof chunk.data.label === 'string'
                  ? chunk.data.label
                  : FIT_STAGE_COPY[stage];
              onEvent({ type: 'stage', stage, label });
            }
            continue;
          }

          if (chunk.type === 'data-brief' && isRecord(chunk.data)) {
            onEvent({ type: 'brief', brief: chunk.data as FitBrief });
            continue;
          }

          if (chunk.type === 'data-error' && isRecord(chunk.data)) {
            const code =
              typeof chunk.data.code === 'string'
                ? chunk.data.code
                : 'generation-failed';
            const message =
              typeof chunk.data.message === 'string'
                ? chunk.data.message
                : FIT_STOPPED_COPY;
            onEvent({
              type: 'error',
              error: {
                code: code as FitApiError['error']['code'],
                message,
              },
            });
            continue;
          }

          if (chunk.type === 'error') {
            const message =
              typeof chunk.errorText === 'string'
                ? chunk.errorText
                : FIT_STOPPED_COPY;
            onEvent({
              type: 'error',
              error: { code: 'generation-failed', message },
            });
          }
        }
      }
    }
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abort);
    }
  }
}
