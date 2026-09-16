import approvedClaimsJson from '../../content/approved-claims.json' with { type: 'json' };
import { createFitRateLimiter } from '../role-fit/rate-limit.js';
import { MAX_REQUEST_BODY_BYTES } from '../role-fit/validation.js';
import { evidenceMeta } from './profile.js';
import {
  DEFAULT_PROTOCOL_VERSION,
  failure,
  isProtocolVersionSupported,
  JsonRpcErrorCode,
  negotiateProtocolVersion,
  parseMessage,
  success,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './protocol.js';
import { findPrompt, PROMPT_DEFINITIONS } from './prompts.js';
import { callTool, findTool, TOOL_DEFINITIONS, toolError } from './tools.js';

const SERVER_NAME = 'paprikaf';
const SERVER_VERSION = '1.0.0';
const SITE_URL = 'https://paprikaf.com';

/**
 * Independent from the /api/fit limiter so a busy website cannot lock agents
 * out, and a busy agent cannot lock the website out. Only `compare_role`
 * consumes it; the evidence lookups are free and served from memory.
 */
const takeMcpRateLimit = createFitRateLimiter();

/**
 * The rules come before the tool order. ChatGPT's developer-mode guide asks for
 * the first 512 characters to stand on their own, and a client that truncates
 * should keep the part that stops it overclaiming, not the part it could work
 * out from the tool descriptions.
 */
export const SERVER_INSTRUCTIONS = [
  'Answers questions about Ahmed Felfel, a product engineer in Montréal, using',
  'only claims and links he has published on paprikaf.com.',
  '',
  'Cite the source links you get back. When a tool finds no match, say the',
  'site publishes no evidence for it; do not conclude that Ahmed lacks the',
  'experience. Do not infer ownership, seniority, metrics, or outcomes beyond',
  'what a claim states, and respect every caveat.',
  '',
  'Call get_profile first to see which projects have public evidence. Use',
  'search_work for a capability or technology, get_project for one project,',
  'and compare_role to check a job description against the evidence.',
].join('\n');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

function jsonHeaders(protocolVersion: string): Record<string, string> {
  return {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'MCP-Protocol-Version': protocolVersion,
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  protocolVersion: string,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...jsonHeaders(protocolVersion), ...extraHeaders },
  });
}

function requestedProtocolVersion(request: Request): string | null {
  return request.headers.get('mcp-protocol-version');
}

function handleInitialize(message: JsonRpcRequest): JsonRpcResponse {
  const requested = message.params?.protocolVersion;
  const protocolVersion = negotiateProtocolVersion(requested);

  return success(message.id, {
    protocolVersion,
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false },
      prompts: { listChanged: false },
    },
    serverInfo: {
      name: SERVER_NAME,
      title: 'Ahmed Felfel — public work',
      version: SERVER_VERSION,
      websiteUrl: SITE_URL,
    },
    instructions: SERVER_INSTRUCTIONS,
  });
}

function handleToolsList(message: JsonRpcRequest): JsonRpcResponse {
  return success(message.id, {
    tools: TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      annotations: {
        title: tool.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
  });
}

function handleResourcesList(message: JsonRpcRequest): JsonRpcResponse {
  const meta = evidenceMeta();

  return success(message.id, {
    resources: [
      {
        uri: 'paprikaf://evidence/claims',
        name: 'approved-claims',
        title: `Approved public claims (${meta.version})`,
        description:
          'Every public claim about Ahmed Felfel’s work, with source links, ' +
          'provenance, and caveats. This is the corpus every tool reads from.',
        mimeType: 'application/json',
      },
    ],
  });
}

function handleResourcesRead(message: JsonRpcRequest): JsonRpcResponse {
  const uri = message.params?.uri;

  if (uri !== 'paprikaf://evidence/claims') {
    return failure(
      message.id,
      JsonRpcErrorCode.InvalidParams,
      `Unknown resource "${String(uri)}". Known: paprikaf://evidence/claims.`
    );
  }

  return success(message.id, {
    contents: [
      {
        uri: 'paprikaf://evidence/claims',
        mimeType: 'application/json',
        text: JSON.stringify(approvedClaimsJson, null, 2),
      },
    ],
  });
}

function handlePromptsList(message: JsonRpcRequest): JsonRpcResponse {
  return success(message.id, {
    prompts: PROMPT_DEFINITIONS.map((prompt) => ({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      arguments: [],
    })),
  });
}

function handlePromptsGet(message: JsonRpcRequest): JsonRpcResponse {
  const name = message.params?.name;
  const prompt = typeof name === 'string' ? findPrompt(name) : undefined;

  if (!prompt) {
    return failure(
      message.id,
      JsonRpcErrorCode.InvalidParams,
      `Unknown prompt "${String(name)}". Known: ${PROMPT_DEFINITIONS.map(
        (definition) => definition.name
      ).join(', ')}.`
    );
  }

  return success(message.id, {
    description: prompt.description,
    messages: [{ role: 'user', content: { type: 'text', text: prompt.text } }],
  });
}

async function handleToolsCall(
  message: JsonRpcRequest,
  request: Request,
  signal: AbortSignal
): Promise<JsonRpcResponse> {
  const name = message.params?.name;
  const rawArgs = message.params?.arguments;

  if (typeof name !== 'string') {
    return failure(
      message.id,
      JsonRpcErrorCode.InvalidParams,
      'tools/call requires a "name" string.'
    );
  }

  const tool = findTool(name);

  if (!tool) {
    return success(
      message.id,
      toolError(
        `Unknown tool "${name}". Available tools: ${TOOL_DEFINITIONS.map(
          (definition) => definition.name
        ).join(', ')}.`
      ) as unknown as Record<string, unknown>
    );
  }

  if (tool.metered) {
    const decision = takeMcpRateLimit(request);
    if (!decision.allowed) {
      return success(
        message.id,
        toolError(
          `This tool is rate limited. Try again in about ${Math.ceil(
            decision.retryAfterSeconds / 60
          )} minutes, or read the published evidence with search_work and ` +
            'get_project, which are not limited.'
        ) as unknown as Record<string, unknown>
      );
    }
  }

  const args =
    typeof rawArgs === 'object' && rawArgs !== null && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  const result = await callTool(name, args, signal);
  return success(message.id, result as unknown as Record<string, unknown>);
}

async function dispatch(
  message: JsonRpcRequest,
  request: Request,
  signal: AbortSignal
): Promise<JsonRpcResponse> {
  switch (message.method) {
    case 'initialize':
      return handleInitialize(message);
    case 'ping':
      return success(message.id, {});
    case 'tools/list':
      return handleToolsList(message);
    case 'tools/call':
      return handleToolsCall(message, request, signal);
    case 'resources/list':
      return handleResourcesList(message);
    case 'resources/read':
      return handleResourcesRead(message);
    case 'resources/templates/list':
      return success(message.id, { resourceTemplates: [] });
    case 'prompts/list':
      return handlePromptsList(message);
    case 'prompts/get':
      return handlePromptsGet(message);
    default:
      return failure(
        message.id,
        JsonRpcErrorCode.MethodNotFound,
        `This server does not implement "${message.method}".`
      );
  }
}

function methodNotAllowed(protocolVersion: string, reason: string): Response {
  return jsonResponse(
    failure(null, JsonRpcErrorCode.InvalidRequest, reason),
    405,
    protocolVersion,
    { Allow: 'POST, OPTIONS' }
  );
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const headerVersion = requestedProtocolVersion(request);

  if (headerVersion !== null && !isProtocolVersionSupported(headerVersion)) {
    return jsonResponse(
      failure(
        null,
        JsonRpcErrorCode.InvalidRequest,
        `Unsupported MCP-Protocol-Version "${headerVersion}".`
      ),
      400,
      DEFAULT_PROTOCOL_VERSION
    );
  }

  const protocolVersion = headerVersion ?? DEFAULT_PROTOCOL_VERSION;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Stateless and read-only: there is no server-initiated stream to open and no
  // session to delete, so both are 405 exactly as the transport spec allows.
  if (request.method === 'GET') {
    return methodNotAllowed(
      protocolVersion,
      'This MCP endpoint is stateless and does not offer an SSE stream. POST ' +
        'JSON-RPC messages instead.'
    );
  }

  if (request.method === 'DELETE') {
    return methodNotAllowed(
      protocolVersion,
      'This MCP endpoint does not use sessions, so there is nothing to delete.'
    );
  }

  if (request.method !== 'POST') {
    return methodNotAllowed(
      protocolVersion,
      `${request.method} is not supported by this MCP endpoint.`
    );
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REQUEST_BODY_BYTES
  ) {
    return jsonResponse(
      failure(null, JsonRpcErrorCode.InvalidRequest, 'Request body too large.'),
      413,
      protocolVersion
    );
  }

  const body = await request.text();

  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BODY_BYTES) {
    return jsonResponse(
      failure(null, JsonRpcErrorCode.InvalidRequest, 'Request body too large.'),
      413,
      protocolVersion
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return jsonResponse(
      failure(null, JsonRpcErrorCode.ParseError, 'Invalid JSON.'),
      400,
      protocolVersion
    );
  }

  const incoming = Array.isArray(payload) ? payload : [payload];

  if (incoming.length === 0) {
    return jsonResponse(
      failure(null, JsonRpcErrorCode.InvalidRequest, 'Empty JSON-RPC batch.'),
      400,
      protocolVersion
    );
  }

  const parsed = incoming.map(parseMessage);
  const requests = parsed.filter(
    (entry): entry is { kind: 'request'; message: JsonRpcRequest } =>
      entry.kind === 'request'
  );

  // Notifications and responses carry nothing to answer.
  if (requests.length === 0) {
    return new Response(null, {
      status: 202,
      headers: { ...corsHeaders, 'MCP-Protocol-Version': protocolVersion },
    });
  }

  const responses: JsonRpcResponse[] = [];

  for (const entry of requests) {
    try {
      responses.push(await dispatch(entry.message, request, request.signal));
    } catch {
      responses.push(
        failure(
          entry.message.id,
          JsonRpcErrorCode.InternalError,
          'The server could not complete this request.'
        )
      );
    }
  }

  // An initialize response must carry the version it negotiated, not the one
  // the client guessed in the header.
  const initializeResponse = responses.find(
    (response) => 'result' in response && 'protocolVersion' in response.result
  );
  const responseVersion =
    initializeResponse && 'result' in initializeResponse
      ? String(initializeResponse.result.protocolVersion)
      : protocolVersion;

  return jsonResponse(
    Array.isArray(payload) ? responses : responses[0],
    200,
    responseVersion
  );
}
