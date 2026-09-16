import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  handleMcpRequest,
  SERVER_INSTRUCTIONS,
} from '../../server/mcp/handler';
import { LATEST_PROTOCOL_VERSION } from '../../server/mcp/protocol';
import approvedClaims from '../../content/approved-claims.json';

type ToolContent = { type: string; text: string };
type ToolCallResult = {
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type SearchResult = { id: string; title: string; url: string };

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
    expect(payload.result.capabilities).toHaveProperty('prompts');
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
    // A stateless server has no subscriptions to offer.
    const response = await handleMcpRequest(
      post(rpc('resources/subscribe', { uri: 'paprikaf://evidence/claims' }))
    );

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
      'search',
      'fetch',
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

describe('MCP prompts', () => {
  type PromptList = {
    result: {
      prompts: Array<{ name: string; title: string; arguments: unknown[] }>;
    };
  };
  type PromptGet = {
    result: {
      messages: Array<{
        role: string;
        content: { type: string; text: string };
      }>;
    };
  };

  it('lists argument-free prompts, because Claude Code splits arguments on whitespace', async () => {
    const payload = (await (
      await handleMcpRequest(post(rpc('prompts/list')))
    ).json()) as PromptList;

    expect(payload.result.prompts.map((prompt) => prompt.name)).toEqual([
      'overview',
      'check_fit',
    ]);
    for (const prompt of payload.result.prompts) {
      expect(prompt.title.length).toBeGreaterThan(0);
      expect(prompt.arguments).toEqual([]);
    }
  });

  it('returns a single user message that names the tools to call', async () => {
    const overview = (await (
      await handleMcpRequest(post(rpc('prompts/get', { name: 'overview' })))
    ).json()) as PromptGet;
    const checkFit = (await (
      await handleMcpRequest(post(rpc('prompts/get', { name: 'check_fit' })))
    ).json()) as PromptGet;

    expect(overview.result.messages).toHaveLength(1);
    expect(overview.result.messages[0].role).toBe('user');
    expect(overview.result.messages[0].content.text).toContain('get_profile');
    expect(checkFit.result.messages[0].content.text).toContain('compare_role');
  });

  it('rejects an unknown prompt with invalid params', async () => {
    const payload = (await (
      await handleMcpRequest(post(rpc('prompts/get', { name: 'hire_him' })))
    ).json()) as { error: { code: number; message: string } };

    expect(payload.error.code).toBe(-32602);
    expect(payload.error.message).toContain('overview');
  });
});

describe('server instructions', () => {
  it('keeps the rules against overclaiming inside the first 512 characters', () => {
    // ChatGPT asks for the first 512 characters to stand on their own.
    const head = SERVER_INSTRUCTIONS.slice(0, 512);

    expect(head).toContain('do not conclude that Ahmed lacks the');
    expect(head).toContain('respect every caveat');
    expect(head).toContain('get_profile');
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

describe('ChatGPT compatibility', () => {
  // ChatGPT's deep research and company-knowledge modes retrieve only through
  // a `search` + `fetch` pair with OpenAI's exact result shape. Getting any of
  // this wrong makes the connector silently return nothing.
  it('declares search and fetch with an output schema', async () => {
    const response = await handleMcpRequest(post(rpc('tools/list')));
    const payload = (await response.json()) as {
      result: {
        tools: Array<{
          name: string;
          inputSchema: { properties: Record<string, unknown> };
          outputSchema?: Record<string, unknown>;
        }>;
      };
    };

    const search = payload.result.tools.find((tool) => tool.name === 'search');
    const fetchTool = payload.result.tools.find(
      (tool) => tool.name === 'fetch'
    );

    expect(Object.keys(search?.inputSchema.properties ?? {})).toEqual([
      'query',
    ]);
    expect(Object.keys(fetchTool?.inputSchema.properties ?? {})).toEqual([
      'id',
    ]);
    expect(search?.outputSchema).toBeDefined();
    expect(fetchTool?.outputSchema).toBeDefined();
  });

  it('returns search results as both structuredContent and a JSON string', async () => {
    const result = await callTool('search', { query: 'MCP server' });

    const structured = result.structuredContent as { results: SearchResult[] };
    expect(structured.results.length).toBeGreaterThan(0);

    // OpenAI requires the same value twice; clients read one or the other.
    const duplicated = JSON.parse(result.content[0].text) as {
      results: SearchResult[];
    };
    expect(duplicated).toEqual(structured);

    for (const entry of structured.results) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'title', 'url']);
      expect(entry.url.startsWith('https://')).toBe(true);
    }
  });

  it('returns an empty result set rather than an error for a miss', async () => {
    const result = await callTool('search', { query: 'zzzzqqq nothing here' });

    expect(result.isError).toBeUndefined();
    expect(
      (result.structuredContent as { results: SearchResult[] }).results
    ).toHaveLength(0);
  });

  it('fetches every id that search hands back', async () => {
    const search = await callTool('search', { query: 'zero to one' });
    const results = (search.structuredContent as { results: SearchResult[] })
      .results;

    expect(results.length).toBeGreaterThan(0);

    for (const entry of results) {
      const fetched = await callTool('fetch', { id: entry.id });
      const document = fetched.structuredContent as {
        id: string;
        title: string;
        text: string;
        url: string;
      };

      expect(document.id).toBe(entry.id);
      expect(document.text.length).toBeGreaterThan(0);
      expect(document.url.startsWith('https://')).toBe(true);
      expect(JSON.parse(fetched.content[0].text)).toEqual(document);
    }
  });

  it('fetches a project id and the profile overview', async () => {
    const project = await callTool('fetch', { id: 'academy' });
    expect((project.structuredContent as { text: string }).text).toContain(
      'Builder Academy'
    );

    const profile = await callTool('fetch', { id: 'profile' });
    expect((profile.structuredContent as { text: string }).text).toContain(
      'Ahmed Felfel'
    );
  });

  it('reports an unknown id instead of inventing a document', async () => {
    const result = await callTool('fetch', { id: 'not-a-real-record' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('search');
  });
});
