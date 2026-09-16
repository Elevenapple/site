import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/role-fit/url-source', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/role-fit/url-source')
  >('../../server/role-fit/url-source');

  return {
    ...actual,
    fetchRoleFromUrl: vi.fn(async (url: string) => {
      if (url.includes('spa')) {
        throw new actual.RoleSourceError(
          'no-role-text',
          'That page did not return readable job text.'
        );
      }

      return {
        text: 'Build and own customer-facing product surfaces end to end. '.repeat(
          8
        ),
        title: 'Forward Deployed Engineer',
        company: 'Figma',
        sourceUrl: url,
        via: 'greenhouse' as const,
      };
    }),
  };
});

import { handleRoleSourceRequest } from '../../server/role-fit/url-handler';

let clientCounter = 0;

function request(
  url: string,
  {
    origin = 'https://paprikaf.com',
    method = 'POST',
    clientIp,
    body,
  }: {
    origin?: string | null;
    method?: string;
    clientIp?: string;
    body?: string;
  } = {}
): Request {
  clientCounter += 1;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': clientIp ?? `192.0.2.${clientCounter % 250}`,
  };
  if (origin) headers.Origin = origin;

  return new Request('https://paprikaf.com/api/role-source', {
    method,
    headers,
    ...(method === 'POST' ? { body: body ?? JSON.stringify({ url }) } : {}),
  });
}

async function errorCode(response: Response): Promise<string> {
  const payload = (await response.json()) as { error: { code: string } };
  return payload.error.code;
}

describe('role source endpoint', () => {
  it('loads a posting and returns the extracted text', async () => {
    const response = await handleRoleSourceRequest(
      request('https://job-boards.greenhouse.io/figma/jobs/6158162004')
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      text: string;
      title: string;
      company: string;
      via: string;
    };

    expect(payload.title).toBe('Forward Deployed Engineer');
    expect(payload.company).toBe('Figma');
    expect(payload.via).toBe('greenhouse');
    expect(payload.text.length).toBeGreaterThan(250);
  });

  it('refuses cross-origin callers so it is not an open URL fetcher', async () => {
    const response = await handleRoleSourceRequest(
      request('https://example.com/job', { origin: 'https://evil.example' })
    );

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden-origin');
  });

  it('refuses a request with no origin at all', async () => {
    const response = await handleRoleSourceRequest(
      request('https://example.com/job', { origin: null })
    );

    expect(response.status).toBe(403);
  });

  it('rejects non-POST methods', async () => {
    const response = await handleRoleSourceRequest(
      request('https://example.com/job', { method: 'GET' })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
  });

  it('rejects a malformed body and a missing url', async () => {
    const malformed = await handleRoleSourceRequest(
      request('', { body: '{ nope' })
    );
    expect(malformed.status).toBe(400);

    const missing = await handleRoleSourceRequest(
      request('', { body: JSON.stringify({ notUrl: 'x' }) })
    );
    expect(missing.status).toBe(400);
    expect(await errorCode(missing)).toBe('invalid-url');
  });

  it('passes a client-rendered page failure through as a clear 422', async () => {
    const response = await handleRoleSourceRequest(
      request('https://jobs.example.com/spa/123')
    );

    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe('no-role-text');
  });

  it('rate limits repeated loads from one client', async () => {
    const clientIp = '203.0.113.210';
    let limited = false;

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await handleRoleSourceRequest(
        request('https://job-boards.greenhouse.io/figma/jobs/1', { clientIp })
      );
      if (response.status === 429) {
        expect(response.headers.get('Retry-After')).toBeTruthy();
        limited = true;
        break;
      }
    }

    expect(limited).toBe(true);
  });
});
