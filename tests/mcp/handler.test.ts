import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleMcpRequest } from '../../server/mcp/handler';
import { LATEST_PROTOCOL_VERSION } from '../../server/mcp/protocol';
import approvedClaims from '../../content/approved-claims.json';

type ToolContent = { type: string; text: string };
type ToolCallResult = { content: ToolContent[]; isError?: boolean };

let clientCounter = 0;

function post(
  body: unknown,
  headers: Record<string, string> = {},
  clientIp?: string
): Request {
  clientCounter += 1;
  return new Request('https://paprikaf.com/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      // A distinct address per request keeps the shared rate-limit map from
      // leaking between tests.
      'X-Forwarded-For': clientIp ?? `198.51.100.${clientCounter % 250}`,
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function rpc(method: string, params?: Record<string, unknown>, id = 1) {
  return { jsonrpc: '2.0', id, method, ...(params ? { params } : {}) };
}

async function callTool(
  name: string,
  args: Record<string, unknown> = {},
  clientIp?: string
): Promise<ToolCallResult> {
  const response = await handleMcpRequest(
    post(rpc('tools/call', { name, arguments: args }), {}, clientIp)
  );
  const payload = (await response.json()) as { result: ToolCallResult };
  return payload.result;
}

function textOf(result: ToolCallResult): string {
  return result.content.map((entry) => entry.text).join('\n');
}

let cachedProfile: ToolCallResult | undefined;

function runGetProfileSync(): ToolCallResult {
  if (!cachedProfile) throw new Error('call get_profile before the size guard');
  return cachedProfile;
}

describe('MCP transport', () => {
  it('negotiates a supported protocol version on initialize', async () => {
    const response = await handleMcpRequest(
      post(
        rpc('initialize', {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        })
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('MCP-Protocol-Version')).toBe(
      LATEST_PROTOCOL_VERSION
    );

    const payload = (await response.json()) as {
      result: {
        protocolVersion: string;
        capabilities: Record<string, unknown>;
        serverInfo: { name: string };
        instructions: string;
      };
    };

    expect(payload.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
    expect(payload.result.capabilities).toHaveProperty('tools');
    expect(payload.result.capabilities).toHaveProperty('resources');
    expect(payload.result.serverInfo.name).toBe('paprikaf');
    expect(payload.result.instructions).toContain('get_profile');
  });

  it('falls back to the latest version when the client asks for an unknown one', async () => {
    const response = await handleMcpRequest(
      post(rpc('initialize', { protocolVersion: '1999-01-01' }))
    );

    const payload = (await response.json()) as {
      result: { protocolVersion: string };
    };
    expect(payload.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it('rejects an unsupported MCP-Protocol-Version header with 400', async () => {
    const response = await handleMcpRequest(
      post(rpc('ping'), { 'MCP-Protocol-Version': '1999-01-01' })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: number } };
    expect(payload.error.code).toBe(-32600);
  });

  it('answers GET and DELETE with 405 because it is stateless', async () => {
    for (const method of ['GET', 'DELETE']) {
      const response = await handleMcpRequest(
        new Request('https://paprikaf.com/api/mcp', { method })
      );
      expect(response.status).toBe(405);
      expect(response.headers.get('Allow')).toContain('POST');
    }
  });

  it('answers CORS preflight so browser-based clients can connect', async () => {
    const response = await handleMcpRequest(
      new Request('https://paprikaf.com/api/mcp', { method: 'OPTIONS' })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('acknowledges a notification with 202 and no body', async () => {
    const response = await handleMcpRequest(
      post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    );

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
  });

  it('returns a parse error for invalid JSON', async () => {
    const response = await handleMcpRequest(post('{ not json'));

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: { code: number } };
    expect(payload.error.code).toBe(-32700);
  });

  it('returns method not found for an unimplemented method', async () => {
    const response = await handleMcpRequest(post(rpc('prompts/list')));

    const payload = (await response.json()) as { error: { code: number } };
    expect(payload.error.code).toBe(-32601);
  });

  it('answers a batch with an array of responses', async () => {
    const response = await handleMcpRequest(
      post([rpc('ping', undefined, 1), rpc('tools/list', undefined, 2)])
    );

    const payload = (await response.json()) as Array<{ id: number }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload).toHaveLength(2);
    expect(payload.map((entry) => entry.id)).toEqual([1, 2]);
  });
});

describe('MCP tools', () => {
  it('lists read-only tools with input schemas', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list')));
    const payload = (await response.json()) as {
      result: {
        tools: Array<{
          name: string;
          inputSchema: Record<string, unknown>;
          annotations: { readOnlyHint: boolean };
        }>;
      };
    };

    const names = payload.result.tools.map((tool) => tool.name);
    expect(names).toEqual([
      'get_profile',
      'search_work',
      'get_project',
      'compare_role',
    ]);

    for (const tool of payload.result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('get_profile lists projects, capabilities, and next steps', async () => {
    cachedProfile = await callTool('get_profile');
    const body = textOf(cachedProfile);

    expect(body).toContain('Ahmed Felfel');
    expect(body).toContain('(academy)');
    expect(body).toContain('Capabilities, by how much evidence backs them');
    expect(body).toContain('search_work');
  });

  it('keeps the get_profile entry point small enough to be cheap to call', () => {
    // get_profile is the first call an agent makes. If it grows into a dump of
    // every claim it spends the agent's context before it knows the question.
    const body = textOf(runGetProfileSync());
    expect(body.length).toBeLessThan(4_000);
  });

  it('search_work finds claims by capability and returns source links', async () => {
    const body = textOf(await callTool('search_work', { query: 'MCP server' }));

    expect(body).toContain('claimId:');
    expect(body).toContain('https://');
    expect(body.toLowerCase()).toContain('mcp');
  });

  it('search_work says the site publishes nothing rather than denying experience', async () => {
    const body = textOf(
      await callTool('search_work', {
        query: 'zzzzqqq underwater basket weaving',
      })
    );

    expect(body).toContain('No approved public claim');
    expect(body).toContain('does not mean Ahmed lacks the experience');
  });

  it('search_work rejects an empty query', async () => {
    const result = await callTool('search_work', { query: '   ' });
    expect(result.isError).toBe(true);
  });

  it('get_project returns claims for a known project', async () => {
    const body = textOf(
      await callTool('get_project', { projectId: 'academy' })
    );

    expect(body).toContain('Builder Academy');
    expect(body).toContain('claimId: builder-academy-built');
  });

  it('get_project names the known ids when asked for a missing one', async () => {
    const result = await callTool('get_project', { projectId: 'nope' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('academy');
  });

  it('reports an unknown tool without failing the JSON-RPC call', async () => {
    const result = await callTool('drop_database');

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unknown tool');
  });
});

describe('compare_role', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a role description under the minimum length', async () => {
    const result = await callTool('compare_role', { roleText: 'Too short.' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('at least');
  });

  it('explains itself when the model is not configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    const result = await callTool('compare_role', {
      roleText:
        'Build and own customer-facing product surfaces end to end. '.repeat(8),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('search_work');
  });

  it('rate limits repeated calls from one client', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    const roleText =
      'Build and own customer-facing product surfaces end to end. '.repeat(8);
    const clientIp = '203.0.113.77';
    const bodies: string[] = [];

    for (let attempt = 0; attempt < 7; attempt += 1) {
      bodies.push(
        textOf(await callTool('compare_role', { roleText }, clientIp))
      );
    }

    expect(bodies.some((body) => body.includes('rate limited'))).toBe(true);
    // The free lookups must stay available to a client that exhausted the quota.
    const stillFree = textOf(await callTool('get_profile', {}, clientIp));
    expect(stillFree).toContain('Ahmed Felfel');
  });
});

describe('MCP resources', () => {
  it('lists and reads the approved claim set', async () => {
    const listed = (await (
      await handleMcpRequest(post(rpc('resources/list')))
    ).json()) as { result: { resources: Array<{ uri: string }> } };

    expect(listed.result.resources[0]?.uri).toBe('paprikaf://evidence/claims');

    const read = (await (
      await handleMcpRequest(
        post(rpc('resources/read', { uri: 'paprikaf://evidence/claims' }))
      )
    ).json()) as { result: { contents: Array<{ text: string }> } };

    const parsed = JSON.parse(read.result.contents[0].text) as {
      claims: unknown[];
    };
    expect(parsed.claims.length).toBe(approvedClaims.claims.length);
  });

  it('rejects an unknown resource uri', async () => {
    const response = await handleMcpRequest(
      post(rpc('resources/read', { uri: 'paprikaf://secrets' }))
    );

    const payload = (await response.json()) as { error: { code: number } };
    expect(payload.error.code).toBe(-32602);
  });
});

describe('public-only guarantee', () => {
  it('never serves a claim that is not marked public', async () => {
    for (const claim of approvedClaims.claims) {
      expect(claim.public).toBe(true);
    }
  });

  it('only emits https source urls', async () => {
    const body = textOf(await callTool('get_profile'));
    const urls = body.match(/https?:\/\/[^\s)]+/g) ?? [];

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
