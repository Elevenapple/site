import { describe, expect, it } from 'vitest';

import {
  assertPublicUrl,
  isBlockedAddress,
  UrlGuardError,
} from '../../server/role-fit/url-guard';

async function guardFailure(url: string): Promise<string> {
  try {
    await assertPublicUrl(url);
  } catch (error) {
    if (error instanceof UrlGuardError) return error.code;
    return 'unexpected';
  }
  return 'allowed';
}

describe('address classification', () => {
  it('blocks every private, loopback, and link-local IPv4 range', () => {
    const blocked = [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254', // cloud metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '255.255.255.255',
    ];

    for (const address of blocked) {
      expect(isBlockedAddress(address, 4), address).toBe(true);
    }
  });

  it('allows ordinary public IPv4 addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '99.83.1.1']) {
      expect(isBlockedAddress(address, 4), address).toBe(false);
    }
  });

  it('blocks loopback, unique-local, and link-local IPv6', () => {
    for (const address of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1']) {
      expect(isBlockedAddress(address, 6), address).toBe(true);
    }

    expect(isBlockedAddress('2606:4700::1111', 6)).toBe(false);
  });

  it('applies the IPv4 rules to IPv4-mapped IPv6', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:169.254.169.254', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:8.8.8.8', 6)).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('requires https', async () => {
    expect(await guardFailure('http://example.com/job')).toBe('not-https');
    expect(await guardFailure('file:///etc/passwd')).toBe('not-https');
  });

  it('rejects malformed input', async () => {
    expect(await guardFailure('not a url')).toBe('invalid-url');
  });

  it('rejects embedded credentials', async () => {
    expect(await guardFailure('https://user:pw@example.com/')).toBe(
      'invalid-url'
    );
  });

  it('blocks local and internal hostnames without resolving them', async () => {
    for (const host of [
      'https://localhost/x',
      'https://api.localhost/x',
      'https://printer.local/x',
      'https://vault.internal/x',
      'https://metadata.google.internal/x',
    ]) {
      expect(await guardFailure(host), host).toBe('blocked-host');
    }
  });

  it('blocks literal private addresses that would skip DNS', async () => {
    for (const host of [
      'https://169.254.169.254/latest/meta-data/',
      'https://127.0.0.1/admin',
      'https://10.0.0.5/internal',
      'https://[::1]/admin',
      'https://[fd00::1]/admin',
    ]) {
      expect(await guardFailure(host), host).toBe('blocked-address');
    }
  });

  it('allows a public https url', async () => {
    const url = await assertPublicUrl('https://example.com/careers/1');
    expect(url.hostname).toBe('example.com');
  });
});
