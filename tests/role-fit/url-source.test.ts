import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  htmlToText,
  parseGreenhouseUrl,
} from '../../server/role-fit/url-source';
import { MIN_ROLE_TEXT_LENGTH } from '../../server/role-fit/validation';

const jobPageHtml = readFileSync(
  fileURLToPath(
    new URL('./fixtures/greenhouse-job-page.html', import.meta.url)
  ),
  'utf-8'
);

describe('parseGreenhouseUrl', () => {
  it('maps every public board host to the JSON API', () => {
    const cases: Array<[string, string]> = [
      [
        'https://job-boards.greenhouse.io/figma/jobs/6158162004?gh_jid=6158162004&gh_src=28109e334us',
        'https://boards-api.greenhouse.io/v1/boards/figma/jobs/6158162004',
      ],
      [
        'https://boards.greenhouse.io/acme/jobs/12345',
        'https://boards-api.greenhouse.io/v1/boards/acme/jobs/12345',
      ],
      [
        'https://job-boards.eu.greenhouse.io/acme/jobs/999',
        'https://boards-api.eu.greenhouse.io/v1/boards/acme/jobs/999',
      ],
    ];

    for (const [input, expected] of cases) {
      expect(parseGreenhouseUrl(new URL(input))?.api, input).toBe(expected);
    }
  });

  it('ignores hosts that only look like greenhouse', () => {
    for (const url of [
      'https://greenhouse.io.evil.com/acme/jobs/1',
      'https://notgreenhouse.io/acme/jobs/1',
      'https://job-boards.greenhouse.io/acme/about',
      'https://example.com/careers/1',
    ]) {
      expect(parseGreenhouseUrl(new URL(url)), url).toBeNull();
    }
  });
});

describe('htmlToText', () => {
  it('drops scripts, styles, and navigation chrome', () => {
    const text = htmlToText(
      `<nav>Home About</nav>
       <script>var secret = "leak";</script>
       <style>.a{color:red}</style>
       <p>Build products end to end.</p>
       <footer>Privacy</footer>`
    );

    expect(text).toContain('Build products end to end.');
    expect(text).not.toContain('leak');
    expect(text).not.toContain('color:red');
    expect(text).not.toContain('Home About');
    expect(text).not.toContain('Privacy');
  });

  it('keeps list and paragraph structure a role description depends on', () => {
    const text = htmlToText(
      '<p>Requirements</p><ul><li>TypeScript</li><li>React</li></ul>'
    );

    expect(text).toContain('- TypeScript');
    expect(text).toContain('- React');
  });

  it('decodes entities rather than leaking them into the prompt', () => {
    expect(
      htmlToText('<p>R&amp;D &mdash; 5&#43; years &quot;senior&quot;</p>')
    ).toBe('R&D — 5+ years "senior"');
  });

  it('reads a real job posting page into usable role text', () => {
    const text = htmlToText(jobPageHtml);

    expect(text.length).toBeGreaterThan(MIN_ROLE_TEXT_LENGTH);
    expect(text).toContain('Forward Deployed Engineer');
    expect(text).not.toMatch(/<\/?[a-z]/i);
    expect(text).not.toContain('function(');
  });
});
