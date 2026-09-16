import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fixtures are the easy place to leak a credential by accident: a page captured
 * with curl carries whatever the site put in its own script tags. That is how a
 * third party's Google API key ended up in this directory once, and how it
 * would happen again.
 */

const fixturesDir = fileURLToPath(new URL('./fixtures', import.meta.url));

/** Prefixes that identify a real credential regardless of entropy. */
const CREDENTIAL_PATTERNS: Array<[string, RegExp]> = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Google OAuth client', /[0-9]+-[0-9a-z]{32}\.apps\.googleusercontent\.com/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[0-9A-Za-z]{36}/],
  ['Slack token', /xox[abprs]-[0-9A-Za-z-]{10,}/],
  ['Stripe key', /[sr]k_(live|test)_[0-9A-Za-z]{24}/],
  ['Anthropic key', /sk-ant-[0-9A-Za-z_-]{20,}/],
  ['OpenAI key', /sk-proj-[0-9A-Za-z_-]{20,}/],
  ['reCAPTCHA site key', /6L[0-9A-Za-z_-]{38}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function fixtureFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? fixtureFiles(path) : [path];
  });
}

describe('test fixtures', () => {
  const files = fixtureFiles(fixturesDir);

  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s carries no credentials', (path) => {
    const contents = readFileSync(path, 'utf-8');

    for (const [label, pattern] of CREDENTIAL_PATTERNS) {
      expect(pattern.test(contents), `${label} found in ${path}`).toBe(false);
    }
  });

  it.each(files)('%s stays small enough to review by hand', (path) => {
    // A fixture past this size is almost certainly a captured page rather than
    // something written for the test, and captured pages bring along whatever
    // the site embedded.
    expect(statSync(path).size).toBeLessThan(20_000);
  });
});
