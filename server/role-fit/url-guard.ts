import { lookup } from 'node:dns/promises';

/**
 * Guards for fetching a visitor-supplied URL server-side.
 *
 * Fetching an arbitrary URL from the server is server-side request forgery by
 * default: the caller picks the destination and our network position does the
 * asking. These checks keep the endpoint pointed at the public internet.
 */

export type UrlGuardFailure =
  | 'invalid-url'
  | 'not-https'
  | 'blocked-host'
  | 'blocked-address';

export class UrlGuardError extends Error {
  readonly code: UrlGuardFailure;

  constructor(code: UrlGuardFailure, message: string) {
    super(message);
    this.name = 'UrlGuardError';
    this.code = code;
  }
}

/** Hostnames that never resolve anywhere useful and often resolve somewhere dangerous. */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.intranet$/i,
  /^metadata(\.google\.internal)?$/i,
];

function ipv4ToInt(address: string): number | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }

  return value;
}

/** CIDR blocks that are private, local, or otherwise not the public internet. */
const BLOCKED_V4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, includes cloud metadata at 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes broadcast
];

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return true;

  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const baseValue = ipv4ToInt(base);
    if (baseValue === null) return false;
    const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (baseValue & mask) >>> 0;
  });
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];

  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped (::ffff:10.0.0.1) inherits the IPv4 rules.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized);
  if (mapped) return isBlockedIpv4(mapped[1]);

  return (
    /^f[cd][0-9a-f]{2}:/.test(normalized) || // unique local fc00::/7
    /^fe[89ab][0-9a-f]:/.test(normalized) || // link-local fe80::/10
    /^ff[0-9a-f]{2}:/.test(normalized) // multicast
  );
}

export function isBlockedAddress(address: string, family: number): boolean {
  return family === 6 ? isBlockedIpv6(address) : isBlockedIpv4(address);
}

/**
 * Validate a URL and confirm every address its hostname resolves to is public.
 *
 * Resolution happens before the connection, so a name that points at a private
 * address is rejected rather than fetched. A rebind between this check and the
 * request remains theoretically possible; the endpoint sits in front of no
 * private network and returns only extracted page text, which keeps the
 * residual value of that race low.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlGuardError('invalid-url', 'That is not a valid URL.');
  }

  if (url.protocol !== 'https:') {
    throw new UrlGuardError('not-https', 'Only https:// links can be loaded.');
  }

  if (url.username || url.password) {
    throw new UrlGuardError(
      'invalid-url',
      'Remove the credentials from the link before loading it.'
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new UrlGuardError('blocked-host', 'That host cannot be loaded.');
  }

  // A literal IP in the URL skips DNS, so check it directly.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isBlockedIpv4(hostname)) {
      throw new UrlGuardError('blocked-address', 'That host cannot be loaded.');
    }
    return url;
  }

  if (hostname.includes(':')) {
    if (isBlockedIpv6(hostname)) {
      throw new UrlGuardError('blocked-address', 'That host cannot be loaded.');
    }
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;

  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UrlGuardError(
      'blocked-host',
      'That link’s domain could not be resolved.'
    );
  }

  if (addresses.length === 0) {
    throw new UrlGuardError(
      'blocked-host',
      'That link’s domain could not be resolved.'
    );
  }

  for (const entry of addresses) {
    if (isBlockedAddress(entry.address, entry.family)) {
      throw new UrlGuardError('blocked-address', 'That host cannot be loaded.');
    }
  }

  return url;
}
