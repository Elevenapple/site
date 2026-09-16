import { createFitRateLimiter } from './rate-limit.js';
import {
  fetchRoleFromUrl,
  RoleSourceError,
  type RoleSourceErrorCode,
} from './url-source.js';
import { isSameOriginRequest } from './validation.js';

const MAX_URL_LENGTH = 2_048;
const MAX_BODY_BYTES = 4_096;

/**
 * Its own budget, separate from the comparison limiter, because loading a link
 * is cheap and a visitor may reasonably try two or three postings before
 * running one comparison.
 */
const takeUrlRateLimit = createFitRateLimiter();

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Origin',
};

function errorResponse(
  status: number,
  code: RoleSourceErrorCode | 'forbidden-origin' | 'rate-limited',
  message: string,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...responseHeaders, ...extraHeaders },
  });
}

function statusForCode(code: RoleSourceErrorCode): number {
  switch (code) {
    case 'invalid-url':
    case 'blocked-host':
      return 400;
    case 'too-large':
      return 413;
    case 'unsupported-content':
    case 'no-role-text':
      return 422;
    case 'unreachable':
      return 502;
  }
}

export async function handleRoleSourceRequest(
  request: Request
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        error: { code: 'invalid-url', message: 'Use POST with a url body.' },
      }),
      { status: 405, headers: { ...responseHeaders, Allow: 'POST' } }
    );
  }

  // Same-origin only. Without this the endpoint is a public URL fetcher that
  // anyone can point at anything while wearing this deployment's address.
  if (!isSameOriginRequest(request)) {
    return errorResponse(
      403,
      'forbidden-origin',
      'Links can only be loaded from Ahmed’s portfolio.'
    );
  }

  const decision = takeUrlRateLimit(request);
  if (!decision.allowed) {
    return errorResponse(
      429,
      'rate-limited',
      'Too many links loaded. Try again shortly, or paste the description.',
      { 'Retry-After': String(decision.retryAfterSeconds) }
    );
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'too-large', 'That request is too large.');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return errorResponse(400, 'invalid-url', 'Send a JSON body with a url.');
  }

  const rawUrl =
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as Record<string, unknown>).url === 'string'
      ? ((payload as Record<string, unknown>).url as string).trim()
      : '';

  if (rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    return errorResponse(400, 'invalid-url', 'Provide a job posting link.');
  }

  try {
    const source = await fetchRoleFromUrl(rawUrl, request.signal);
    return new Response(JSON.stringify(source), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof RoleSourceError) {
      return errorResponse(
        statusForCode(error.code),
        error.code,
        error.message
      );
    }

    return errorResponse(
      502,
      'unreachable',
      'That link could not be read. Paste the description instead.'
    );
  }
}
