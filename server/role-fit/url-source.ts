import { assertPublicUrl, UrlGuardError } from './url-guard.js';
import { MIN_ROLE_TEXT_LENGTH, sanitizeRoleText } from './validation.js';

/**
 * Load a public job posting from a URL and reduce it to role text.
 *
 * Two paths. Job boards that publish a documented JSON API give clean, complete
 * text, so those are read through an adapter. Everything else falls back to
 * reading the page and stripping the markup, which works on server-rendered
 * postings and returns nothing useful on client-rendered ones. That failure is
 * reported rather than passed on: feeding an empty shell or a page of
 * navigation chrome to the model produces a confident, wrong brief.
 */

export type RoleSourceErrorCode =
  | 'invalid-url'
  | 'blocked-host'
  | 'unreachable'
  | 'unsupported-content'
  | 'too-large'
  | 'no-role-text';

export class RoleSourceError extends Error {
  readonly code: RoleSourceErrorCode;

  constructor(code: RoleSourceErrorCode, message: string) {
    super(message);
    this.name = 'RoleSourceError';
    this.code = code;
  }
}

export type RoleSource = {
  text: string;
  title: string | null;
  company: string | null;
  sourceUrl: string;
  /** Which path produced the text, so the UI can say where it came from. */
  via: 'greenhouse' | 'page';
};

const MAX_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 9_000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  'paprikaf-role-fit/1.0 (+https://paprikaf.com; job description reader)';

function isTextualContentType(value: string | null): boolean {
  if (!value) return false;
  const type = value.split(';')[0].trim().toLowerCase();
  return (
    type === 'text/html' ||
    type === 'application/xhtml+xml' ||
    type === 'text/plain' ||
    type === 'application/json'
  );
}

async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new RoleSourceError('too-large', 'That page is too large to read.');
  }

  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_BYTES) {
        throw new RoleSourceError(
          'too-large',
          'That page is too large to read.'
        );
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8').decode(merged);
}

/**
 * Fetch with redirects followed by hand, so every hop is re-validated. A
 * permitted host that redirects to 169.254.169.254 would otherwise walk the
 * request straight past the guard.
 */
async function guardedFetch(
  startUrl: string,
  signal: AbortSignal
): Promise<{ body: string; finalUrl: string; contentType: string | null }> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current);

    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const composite = AbortSignal.any([signal, timeout]);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: composite,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8',
          'Accept-Language': 'en',
        },
      });
    } catch {
      throw new RoleSourceError(
        'unreachable',
        'That link could not be reached.'
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new RoleSourceError(
          'unreachable',
          'That link redirected without a destination.'
        );
      }
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) {
      throw new RoleSourceError(
        'unreachable',
        response.status === 403 || response.status === 401
          ? 'That site refused the request. Paste the description instead.'
          : `That link returned ${response.status}.`
      );
    }

    const contentType = response.headers.get('content-type');
    if (!isTextualContentType(contentType)) {
      throw new RoleSourceError(
        'unsupported-content',
        'That link is not a web page.'
      );
    }

    return {
      body: await readCapped(response),
      finalUrl: url.toString(),
      contentType,
    };
  }

  throw new RoleSourceError(
    'unreachable',
    'That link redirected too many times.'
  );
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match
    );
}

/** Strip markup to readable text, keeping list and paragraph breaks. */
export function htmlToText(html: string): string {
  let working = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|noscript|svg|head|nav|header|footer|form|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      ' '
    );

  // Keep the document's own structure as newlines before dropping tags.
  working = working
    .replace(/<\/(p|div|section|article|h[1-6]|tr|ul|ol|table)\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ');

  return decodeEntities(working.replace(/<[^>]+>/g, ' '))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Prefer the main content region when the page marks one. */
function readableRegion(html: string): string {
  const main =
    /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(html) ??
    /<article\b[^>]*>([\s\S]*?)<\/article\s*>/i.exec(html);

  const region = main?.[1] ?? html;
  const text = htmlToText(region);

  // A <main> that turned out to be a shell is worse than the whole document.
  return text.length < MIN_ROLE_TEXT_LENGTH ? htmlToText(html) : text;
}

function documentTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (!match) return null;

  const title = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
  return title.length > 0 ? title.slice(0, 160) : null;
}

type GreenhouseTarget = { board: string; jobId: string; api: string };

/**
 * Greenhouse publishes every posting through an open JSON API, which returns
 * the description without the surrounding page chrome.
 */
export function parseGreenhouseUrl(url: URL): GreenhouseTarget | null {
  const host = url.hostname.toLowerCase();
  if (!/(^|\.)greenhouse\.io$/.test(host)) return null;

  const match = /^\/([A-Za-z0-9_.-]+)\/jobs\/(\d+)/.exec(url.pathname);
  if (!match) return null;

  const [, board, jobId] = match;
  const region = host.includes('.eu.') ? 'boards-api.eu' : 'boards-api';

  return {
    board,
    jobId,
    api: `https://${region}.greenhouse.io/v1/boards/${board}/jobs/${jobId}`,
  };
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function loadFromGreenhouse(
  target: GreenhouseTarget,
  signal: AbortSignal
): Promise<RoleSource | null> {
  let payload: unknown;

  try {
    const { body } = await guardedFetch(target.api, signal);
    payload = JSON.parse(body) as unknown;
  } catch {
    // The public page is still worth trying.
    return null;
  }

  if (typeof payload !== 'object' || payload === null) return null;

  const record = payload as Record<string, unknown>;
  const content = typeof record.content === 'string' ? record.content : '';
  if (content.length === 0) return null;

  const title = typeof record.title === 'string' ? record.title : null;
  const company =
    typeof record.company_name === 'string' && record.company_name.length > 0
      ? record.company_name
      : titleCase(target.board);
  const location =
    typeof record.location === 'object' &&
    record.location !== null &&
    typeof (record.location as Record<string, unknown>).name === 'string'
      ? ((record.location as Record<string, unknown>).name as string)
      : null;

  // Greenhouse double-encodes: the JSON string holds escaped HTML.
  const body = htmlToText(decodeEntities(content));
  const header = [
    title,
    company ? `Company: ${company}` : null,
    location ? `Location: ${location}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    text: `${header}\n\n${body}`.trim(),
    title,
    company,
    sourceUrl:
      typeof record.absolute_url === 'string'
        ? record.absolute_url
        : target.api,
    via: 'greenhouse',
  };
}

export async function fetchRoleFromUrl(
  rawUrl: string,
  signal: AbortSignal
): Promise<RoleSource> {
  let url: URL;

  try {
    url = await assertPublicUrl(rawUrl);
  } catch (error) {
    if (error instanceof UrlGuardError) {
      throw new RoleSourceError(
        error.code === 'invalid-url' || error.code === 'not-https'
          ? 'invalid-url'
          : 'blocked-host',
        error.message
      );
    }
    throw error;
  }

  const greenhouse = parseGreenhouseUrl(url);
  if (greenhouse) {
    const fromApi = await loadFromGreenhouse(greenhouse, signal);
    if (
      fromApi &&
      sanitizeRoleText(fromApi.text).length >= MIN_ROLE_TEXT_LENGTH
    ) {
      return { ...fromApi, text: sanitizeRoleText(fromApi.text) };
    }
  }

  const { body, finalUrl, contentType } = await guardedFetch(
    url.toString(),
    signal
  );

  const isJson = (contentType ?? '').includes('json');
  const raw = isJson ? body : readableRegion(body);
  const text = sanitizeRoleText(raw);

  if (text.length < MIN_ROLE_TEXT_LENGTH) {
    throw new RoleSourceError(
      'no-role-text',
      'That page did not return readable job text. Some job boards render the ' +
        'description in the browser, which this cannot see. Copy the ' +
        'description and paste it instead.'
    );
  }

  return {
    text,
    title: isJson ? null : documentTitle(body),
    company: null,
    sourceUrl: finalUrl,
    via: 'page',
  };
}
