import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  AGENT_WAYS,
  getAgentWay,
  MCP_ENDPOINT,
  MCP_SETUP_URL,
  SKILL_NAME,
} from '../../src/features/agent-access/ways';

const root = resolve(__dirname, '../..');

describe('agent access lines', () => {
  it('offers prompt, CLI, skill, and MCP in that order', () => {
    expect(AGENT_WAYS.map((way) => way.label)).toEqual([
      'Prompt',
      'CLI',
      'Skill',
      'MCP',
    ]);
  });

  it('points the prompt at a file the site actually serves', () => {
    expect(getAgentWay('prompt').text).toContain('paprikaf.com/llms.txt');
    expect(existsSync(resolve(root, 'public/llms.txt'))).toBe(true);
  });

  it('installs the server for every Claude Code project, not just one', () => {
    const cli = getAgentWay('cli').text;

    expect(cli).toMatch(/^claude mcp add /);
    expect(cli).toContain('-s user');
    expect(cli).toContain('-t http');
    expect(cli.endsWith(` paprikaf ${MCP_ENDPOINT}`)).toBe(true);
  });

  it('installs a skill that exists in the repo under the same name', () => {
    expect(getAgentWay('skill').text).toBe(
      `npx skills add paprikaf/site --skill ${SKILL_NAME}`
    );

    const skill = readFileSync(
      resolve(root, `skills/${SKILL_NAME}/SKILL.md`),
      'utf8'
    );
    expect(skill).toMatch(new RegExp(`^---\\nname: ${SKILL_NAME}\\n`));
    expect(skill).toContain(MCP_ENDPOINT);
  });

  it('links MCP setup to a heading that exists in the docs', () => {
    expect(getAgentWay('mcp').text).toBe(MCP_ENDPOINT);
    expect(getAgentWay('mcp').note?.href).toBe(MCP_SETUP_URL);

    const anchor = new URL(MCP_SETUP_URL).hash.slice(1);
    const docs = readFileSync(resolve(root, 'docs/MCP_SERVER.md'), 'utf8');
    expect(docs).toMatch(new RegExp(`^## ${anchor}$`, 'im'));
  });
});
