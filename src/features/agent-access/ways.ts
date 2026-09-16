/**
 * Four ways to point an AI at this site, one line each.
 *
 * The CLI and MCP lines were checked against the vendors' docs in September
 * 2026; the per-client connector steps live in docs/MCP_SERVER.md, where there
 * is room for them.
 */

export const MCP_ENDPOINT = 'https://paprikaf.com/api/mcp';
export const MCP_SETUP_URL =
  'https://github.com/paprikaf/site/blob/main/docs/MCP_SERVER.md#connect';

/** The skill lives at skills/<SKILL_NAME>/SKILL.md in the public repo. */
export const SKILL_NAME = 'paprikaf';

export const AGENT_WAY_IDS = ['prompt', 'cli', 'skill', 'mcp'] as const;

export type AgentWayId = (typeof AGENT_WAY_IDS)[number];

export type AgentWay = {
  id: AgentWayId;
  label: string;
  /** Shown, and copied, exactly as written. */
  text: string;
  /** A short aside after the line, when the line alone is not enough. */
  note?: { label: string; href: string };
};

export const AGENT_WAYS: AgentWay[] = [
  {
    // Works in any assistant that can open a page, with nothing to install.
    id: 'prompt',
    label: 'Prompt',
    text: 'Read paprikaf.com/llms.txt and tell me what Ahmed has built',
  },
  {
    // Claude Code's default scope is the current project only; -s user makes
    // the server available everywhere.
    id: 'cli',
    label: 'CLI',
    text: `claude mcp add -s user -t http paprikaf ${MCP_ENDPOINT}`,
  },
  {
    // The repo also vendors the vgpu skill, so --skill picks this one.
    id: 'skill',
    label: 'Skill',
    text: `npx skills add paprikaf/site --skill ${SKILL_NAME}`,
  },
  {
    id: 'mcp',
    label: 'MCP',
    text: MCP_ENDPOINT,
    note: { label: 'Claude & ChatGPT setup', href: MCP_SETUP_URL },
  },
];

export const DEFAULT_AGENT_WAY: AgentWayId = 'prompt';

export function getAgentWay(id: AgentWayId): AgentWay {
  return AGENT_WAYS.find((way) => way.id === id) ?? AGENT_WAYS[0];
}
