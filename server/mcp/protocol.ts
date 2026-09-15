/**
 * Minimal JSON-RPC 2.0 plumbing for the MCP Streamable HTTP transport.
 *
 * The endpoint is stateless and read-only, which is the subset of the transport
 * that needs no session store and no SSE: a POST carrying one request gets one
 * `application/json` response, and GET/DELETE answer 405. Implementing that
 * directly avoids taking `mcp-handler`, whose peer dependency is Next.js.
 */

export const LATEST_PROTOCOL_VERSION = '2025-06-18';

/** Ordered newest first; the negotiated version is echoed back to the client. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

/** Assumed when a client sends no MCP-Protocol-Version header, per the spec. */
export const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

export const JSON_RPC_VERSION = '2.0';

export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcNotification = {
  jsonrpc: typeof JSON_RPC_VERSION;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcSuccess = {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: JsonRpcId;
  result: Record<string, unknown>;
};

export type JsonRpcFailure = {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: JsonRpcId | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export function isProtocolVersionSupported(value: string): boolean {
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(value);
}

export function negotiateProtocolVersion(requested: unknown): string {
  return typeof requested === 'string' && isProtocolVersionSupported(requested)
    ? requested
    : LATEST_PROTOCOL_VERSION;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return (
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

export type ParsedMessage =
  | { kind: 'request'; message: JsonRpcRequest }
  | { kind: 'notification'; message: JsonRpcNotification }
  /** A response or an unusable envelope: both are acknowledged, never answered. */
  | { kind: 'acknowledge' };

export function parseMessage(value: unknown): ParsedMessage {
  if (!isPlainObject(value) || value.jsonrpc !== JSON_RPC_VERSION) {
    return { kind: 'acknowledge' };
  }

  if (typeof value.method !== 'string') {
    return { kind: 'acknowledge' };
  }

  const params = isPlainObject(value.params) ? value.params : undefined;

  if (!('id' in value) || value.id === null) {
    return {
      kind: 'notification',
      message: {
        jsonrpc: JSON_RPC_VERSION,
        method: value.method,
        ...(params ? { params } : {}),
      },
    };
  }

  if (!isJsonRpcId(value.id)) {
    return { kind: 'acknowledge' };
  }

  return {
    kind: 'request',
    message: {
      jsonrpc: JSON_RPC_VERSION,
      id: value.id,
      method: value.method,
      ...(params ? { params } : {}),
    },
  };
}

export function success(
  id: JsonRpcId,
  result: Record<string, unknown>
): JsonRpcSuccess {
  return { jsonrpc: JSON_RPC_VERSION, id, result };
}

export function failure(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcFailure {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}
