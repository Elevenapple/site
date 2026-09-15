import { describe, expect, it, vi } from 'vitest';

import { consumeFitUiMessageStream } from '../../src/features/role-fit/fit-stream';
import {
  FIT_STAGE_COPY,
  FIT_STOPPED_COPY,
} from '../../src/features/role-fit/stages';
import type { FitBrief } from '../../src/features/role-fit/types';

function sseResponse(chunks: unknown[]): Response {
  const body = chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join('');
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  });
}

const brief = {
  role: {
    title: null,
    company: null,
    sourceKind: 'text',
    requirements: [],
  },
  summary: 'ok',
  matches: [],
  unknowns: [],
  interviewQuestions: [],
  meta: {
    requestId: 'r1',
    evidenceVersion: 'v',
    generatedAt: '2026-09-15T00:00:00.000Z',
  },
} as FitBrief;

describe('consumeFitUiMessageStream', () => {
  it('emits real stage events then the brief', async () => {
    const onEvent = vi.fn();
    const response = sseResponse([
      { type: 'start' },
      {
        type: 'data-stage',
        data: { stage: 1, label: FIT_STAGE_COPY[1] },
      },
      {
        type: 'data-stage',
        data: { stage: 2, label: FIT_STAGE_COPY[2] },
      },
      {
        type: 'data-stage',
        data: { stage: 3, label: FIT_STAGE_COPY[3] },
      },
      { type: 'data-brief', data: brief },
      { type: 'finish' },
    ]);

    await consumeFitUiMessageStream(response, onEvent);

    expect(onEvent.mock.calls.map((call) => call[0].type)).toEqual([
      'stage',
      'stage',
      'stage',
      'brief',
    ]);
    expect(onEvent.mock.calls[0]![0]).toMatchObject({
      type: 'stage',
      stage: 1,
      label: 'Reading the role',
    });
    expect(onEvent.mock.calls[3]![0]).toMatchObject({
      type: 'brief',
      brief,
    });
  });

  it('maps stream errors to the locked stop copy path', async () => {
    const onEvent = vi.fn();
    const response = sseResponse([
      {
        type: 'data-error',
        data: { code: 'generation-failed', message: FIT_STOPPED_COPY },
      },
    ]);

    await consumeFitUiMessageStream(response, onEvent);

    expect(onEvent).toHaveBeenCalledWith({
      type: 'error',
      error: {
        code: 'generation-failed',
        message: FIT_STOPPED_COPY,
      },
    });
  });
});
