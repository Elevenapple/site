import { randomUUID } from 'node:crypto';

import type { ApprovedClaim } from '../role-fit/evidence.js';
import { generateFitBrief } from '../role-fit/generation.js';
import {
  MAX_ROLE_TEXT_LENGTH,
  MIN_ROLE_TEXT_LENGTH,
  sanitizeRoleText,
} from '../role-fit/validation.js';
import type { FitBrief } from '../../src/features/role-fit/types.js';
import {
  evidenceMeta,
  getClaim,
  listCapabilities,
  listProjects,
  searchProfile,
} from './profile.js';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  /** ChatGPT reads this; other clients read the text block. */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  /** Only `compare_role` reaches a paid provider, so only it is metered. */
  metered?: boolean;
};

const PROVENANCE_NOTE =
  'Provenance: links show the work exists. Role and ownership details are ' +
  'Ahmed’s own published account unless a source says otherwise.';

const SITE_URL = 'https://paprikaf.com';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_profile',
    title: 'Get Ahmed Felfel’s profile',
    description:
      'Start here. Returns who Ahmed Felfel is, his current role, every project ' +
      'he has published public evidence for, and the capability index you can ' +
      'search against. Use this before the other tools to learn what exists.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'search_work',
    title: 'Search Ahmed’s published work',
    description:
      'Search Ahmed Felfel’s approved public claims by keyword, capability, ' +
      'technology, or employer. Returns matching claims with their public ' +
      'source links and caveats. Returns nothing when no approved claim ' +
      'matches, which is not evidence that Ahmed lacks the experience.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Keywords to match, for example "MCP server", "zero to one", or "Builder.io".',
          minLength: 1,
          maxLength: 300,
        },
        limit: {
          type: 'integer',
          description: 'Maximum claims to return. Defaults to 6.',
          minimum: 1,
          maximum: 20,
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_project',
    title: 'Get one project',
    description:
      'Return every approved claim, caveat, and public link for one project. ' +
      'Use the projectId values returned by get_profile.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'A projectId from get_profile, for example "academy".',
          minLength: 1,
          maxLength: 80,
        },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
  },
  {
    name: 'compare_role',
    title: 'Compare a role with Ahmed’s work',
    description:
      'Paste a public job description and get an evidence-grounded brief: which ' +
      'requirements Ahmed’s published work lines up with, which ones this ' +
      'evidence cannot answer, and three interview questions that would test ' +
      'the fit. Does not return a hiring recommendation or a numeric score. ' +
      'This call is rate limited because it runs a model.',
    inputSchema: {
      type: 'object',
      properties: {
        roleText: {
          type: 'string',
          description:
            'The full public role description, including responsibilities and requirements.',
          minLength: MIN_ROLE_TEXT_LENGTH,
          maxLength: MAX_ROLE_TEXT_LENGTH,
        },
      },
      required: ['roleText'],
      additionalProperties: false,
    },
    metered: true,
  },
  // ── ChatGPT compatibility ────────────────────────────────────────────────
  // ChatGPT's deep research and company-knowledge modes retrieve only through
  // a tool pair named exactly `search` and `fetch`, with the result shape
  // below. The names are OpenAI's, not ours, so the descriptions carry the
  // subject to stop another client routing a generic search here.
  {
    name: 'search',
    title: 'Search Ahmed Felfel’s public work',
    description:
      'Search Ahmed Felfel’s published claims, projects, and public evidence. ' +
      'Returns matching records with ids you can pass to fetch. Use this for ' +
      'any question about Ahmed Felfel’s experience, projects, or background.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to look for in Ahmed Felfel’s published work.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              url: { type: 'string' },
            },
            required: ['id', 'title', 'url'],
          },
        },
      },
      required: ['results'],
    },
  },
  {
    name: 'fetch',
    title: 'Fetch one record about Ahmed Felfel',
    description:
      'Retrieve the full text of one record about Ahmed Felfel’s work by the ' +
      'id returned from search. Accepts a claim id, a project id, or ' +
      '"profile" for the overview.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'A record id returned by search.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        text: { type: 'string' },
        url: { type: 'string' },
        metadata: { type: 'object', additionalProperties: { type: 'string' } },
      },
      required: ['id', 'title', 'text', 'url'],
    },
  },
];

function text(body: string): ToolResult {
  return { content: [{ type: 'text', text: body }] };
}

export function toolError(body: string): ToolResult {
  return { content: [{ type: 'text', text: body }], isError: true };
}

function renderSources(claim: ApprovedClaim): string[] {
  return claim.sources.map((source) => {
    const provenance = source.provenance.replace(/-/g, ' ');
    return source.url
      ? `  - ${source.label} — ${source.url} (${provenance})`
      : `  - ${source.label} (${provenance})`;
  });
}

function renderClaim(claim: ApprovedClaim): string {
  const lines = [
    `### ${claim.title} — ${claim.organization}`,
    `- claimId: ${claim.id}`,
    claim.projectId ? `- projectId: ${claim.projectId}` : null,
    `- ownership: ${claim.ownership} · status: ${claim.status}`,
    `- capabilities: ${claim.capabilities.join(', ')}`,
    '',
    claim.claim,
    '',
    '- Sources:',
    ...renderSources(claim),
  ].filter((line): line is string => line !== null);

  if (claim.caveats.length > 0) {
    lines.push('- Caveats:');
    for (const caveat of claim.caveats) {
      lines.push(`  - ${caveat}`);
    }
  }

  return lines.join('\n');
}

/** Ownership values that describe a shipped artifact rather than a résumé area. */
const ARTIFACT_OWNERSHIP = new Set([
  'built',
  'creator',
  'creator-maintainer',
  'maintainer',
  'contributor',
  'current-work',
]);

function runGetProfile(): ToolResult {
  const meta = evidenceMeta();
  const projects = listProjects();
  const artifacts = projects.filter((project) =>
    ARTIFACT_OWNERSHIP.has(project.ownership)
  );
  const practice = projects.filter(
    (project) => !ARTIFACT_OWNERSHIP.has(project.ownership)
  );

  // The entry point stays compact on purpose. Dumping every claim here would
  // spend an agent's context before it knows which question it is answering;
  // search_work and get_project exist to go deep on demand.
  const capabilities = listCapabilities()
    .slice()
    .sort(
      (a, b) =>
        b.claimIds.length - a.claimIds.length ||
        a.capability.localeCompare(b.capability)
    );

  const body = [
    '# Ahmed Felfel',
    '',
    'Product engineer in Montréal who builds products from scratch. Currently a ' +
      'GTM Engineer at Builder.io, where he has worked as a Customer Engineer ' +
      'and in partner enablement. He has built learning software, developer ' +
      'tools, and internal AI systems.',
    '',
    `Site: ${SITE_URL} · Résumé: ${SITE_URL}/resume · Contact: ahmed@galite.ai`,
    `Evidence set ${meta.version}, last reviewed ${meta.reviewedAt}.`,
    '',
    '## Projects with public artifacts',
    '',
    ...artifacts.map((project) =>
      [
        `- **${project.title}** (${project.projectId}) — ${project.organization}`,
        `  ${project.ownership}, ${project.status} · ${project.capabilities.join(', ')}`,
        project.links.length === 0
          ? '  no public link (internal system)'
          : `  ${project.links
              .slice(0, 2)
              .map((link) => link.url)
              .join(' · ')}${
              project.links.length > 2
                ? ` · +${project.links.length - 2} more via get_project`
                : ''
            }`,
      ].join('\n')
    ),
    '',
    '## Also documented, from the résumé and portfolio',
    '',
    practice
      .map((project) => `${project.title} (${project.projectId})`)
      .join(' · '),
    '',
    '## Capabilities, by how much evidence backs them',
    '',
    capabilities
      .filter((entry) => entry.claimIds.length > 1)
      .map((entry) => `${entry.capability} (${entry.claimIds.length})`)
      .join(' · '),
    `Plus ${capabilities.filter((entry) => entry.claimIds.length === 1).length} ` +
      'capabilities backed by a single claim. search_work finds those by name.',
    '',
    '## Next steps',
    '',
    '- search_work to find the evidence behind a capability or technology.',
    '- get_project for every claim and link on one project id above.',
    '- compare_role to check a job description against this evidence.',
    '',
    PROVENANCE_NOTE,
  ].join('\n');

  return text(body);
}

function runSearchWork(args: Record<string, unknown>): ToolResult {
  const query = typeof args.query === 'string' ? args.query.trim() : '';

  if (query.length === 0) {
    return toolError('Provide a non-empty "query" string.');
  }

  if (query.length > 300) {
    return toolError('Shorten "query" to 300 characters or fewer.');
  }

  const limit =
    typeof args.limit === 'number' && Number.isInteger(args.limit)
      ? args.limit
      : 6;
  const hits = searchProfile(query, limit);

  if (hits.length === 0) {
    return text(
      [
        `No approved public claim matches "${query}".`,
        '',
        'This does not mean Ahmed lacks the experience. It means this site ' +
          'publishes no evidence for it. Call get_profile to see what the ' +
          'evidence set does cover, or ask Ahmed directly at ahmed@galite.ai.',
      ].join('\n')
    );
  }

  return text(
    [
      `# ${hits.length} claim${hits.length === 1 ? '' : 's'} matching "${query}"`,
      ...hits.map((hit) => renderClaim(hit.claim)),
      PROVENANCE_NOTE,
    ].join('\n\n')
  );
}

function runGetProject(args: Record<string, unknown>): ToolResult {
  const projectId =
    typeof args.projectId === 'string' ? args.projectId.trim() : '';

  if (projectId.length === 0) {
    return toolError('Provide a "projectId" string from get_profile.');
  }

  const project = listProjects().find(
    (candidate) => candidate.projectId === projectId
  );

  if (!project) {
    const known = listProjects()
      .map((candidate) => candidate.projectId)
      .join(', ');
    return toolError(
      `No project called "${projectId}". Known projectIds: ${known}.`
    );
  }

  const claims = project.claimIds
    .map((claimId) => getClaim(claimId))
    .filter((claim): claim is ApprovedClaim => claim !== undefined);

  return text(
    [
      `# ${project.title} — ${project.organization}`,
      '',
      `- projectId: ${project.projectId}`,
      `- ownership: ${project.ownership} · status: ${project.status}`,
      `- capabilities: ${project.capabilities.join(', ')}`,
      ...claims.map(renderClaim),
      PROVENANCE_NOTE,
    ].join('\n\n')
  );
}

function renderBrief(brief: FitBrief): string {
  const requirementById = new Map(
    brief.role.requirements.map((requirement) => [requirement.id, requirement])
  );
  const roleName =
    [brief.role.title, brief.role.company].filter(Boolean).join(' · ') ||
    'the submitted role';

  const lines = [
    `# Role fit brief — ${roleName}`,
    '',
    '## Bottom line',
    '',
    brief.summary,
    '',
    '## Role priorities read from the description',
    '',
    ...brief.role.requirements.map(
      (requirement) =>
        `- [${requirement.priority}] ${requirement.label} — “${requirement.sourceExcerpt}”`
    ),
    '',
    '## Where Ahmed’s public work lines up',
    '',
  ];

  if (brief.matches.length === 0) {
    lines.push(
      'Nothing in the published evidence clearly matches this role. Ahmed may ' +
        'still have relevant experience that is not public.'
    );
  } else {
    for (const match of brief.matches) {
      const requirement = requirementById.get(match.requirementId);
      lines.push(
        `### ${requirement?.label ?? match.requirementId} (${
          match.relationship === 'direct' ? 'mapped overlap' : 'related work'
        })`,
        '',
        match.rationale,
        ''
      );
      for (const evidence of match.evidence) {
        lines.push(`- ${evidence.title} — ${evidence.organization}`);
        lines.push(`  ${evidence.claim}`);
        for (const source of evidence.sources) {
          lines.push(
            source.url
              ? `  - ${source.label} — ${source.url}`
              : `  - ${source.label}`
          );
        }
        for (const caveat of evidence.caveats) {
          lines.push(`  - Caveat: ${caveat}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## What this evidence cannot answer', '');

  if (brief.unknowns.length === 0) {
    lines.push('Every listed requirement had related public work.');
  } else {
    for (const unknown of brief.unknowns) {
      const requirement = requirementById.get(unknown.requirementId);
      lines.push(
        `- ${requirement?.label ?? unknown.requirementId}: ${unknown.explanation}`
      );
    }
  }

  lines.push(
    '',
    '## Questions worth asking Ahmed',
    '',
    ...brief.interviewQuestions.map(
      (question, index) => `${index + 1}. ${question.question}`
    ),
    '',
    `Evidence set ${brief.meta.evidenceVersion} · compared ${brief.meta.generatedAt}`,
    '',
    PROVENANCE_NOTE,
    'This brief is AI-assisted and deliberately returns no hiring ' +
      'recommendation and no numeric score.'
  );

  return lines.join('\n');
}

async function runCompareRole(
  args: Record<string, unknown>,
  signal: AbortSignal
): Promise<ToolResult> {
  const raw = typeof args.roleText === 'string' ? args.roleText : '';
  const roleText = sanitizeRoleText(raw);

  if (roleText.length < MIN_ROLE_TEXT_LENGTH) {
    return toolError(
      `"roleText" must contain at least ${MIN_ROLE_TEXT_LENGTH} characters of ` +
        'role description. Include the responsibilities and requirements.'
    );
  }

  if (roleText.length > MAX_ROLE_TEXT_LENGTH) {
    return toolError(
      `"roleText" must contain no more than ${MAX_ROLE_TEXT_LENGTH} characters.`
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return toolError(
      'The comparison model is not configured on this deployment. Use ' +
        'search_work and get_project instead.'
    );
  }

  try {
    const brief = await generateFitBrief(roleText, randomUUID(), signal);
    return text(renderBrief(brief));
  } catch {
    return toolError(
      'The comparison did not finish. Try again, or use search_work and ' +
        `get_project against the published evidence at ${SITE_URL}.`
    );
  }
}

/**
 * ChatGPT requires the payload twice: as `structuredContent` for its own
 * retrieval path, and as a JSON string in the content array for every other
 * client. Returning only one of the two makes the connector look empty.
 */
function chatgptResult(payload: Record<string, unknown>): ToolResult {
  return {
    structuredContent: payload,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

/**
 * ChatGPT cites this url, so prefer an independent public record over Ahmed's
 * own portfolio page. A link to the artifact is stronger evidence than a link
 * back to the claim about it.
 */
function claimUrl(claim: ApprovedClaim): string {
  const independent = claim.sources.find(
    (source) =>
      source.url !== undefined && source.provenance !== 'ahmed-published-claim'
  );

  return (
    independent?.url ??
    claim.sources.find((source) => source.url !== undefined)?.url ??
    `${SITE_URL}/#work`
  );
}

function runSearch(args: Record<string, unknown>): ToolResult {
  const query = typeof args.query === 'string' ? args.query.trim() : '';

  if (query.length === 0 || query.length > 300) {
    return chatgptResult({ results: [] });
  }

  const results = searchProfile(query, 10).map((hit) => ({
    id: hit.claim.id,
    title: `${hit.claim.title} — ${hit.claim.organization}`,
    url: claimUrl(hit.claim),
  }));

  return chatgptResult({ results });
}

function runFetch(args: Record<string, unknown>): ToolResult {
  const id = typeof args.id === 'string' ? args.id.trim() : '';

  if (id.length === 0) {
    return toolError('Provide an "id" returned by search.');
  }

  if (id === 'profile') {
    const profile = runGetProfile();
    return chatgptResult({
      id: 'profile',
      title: 'Ahmed Felfel — profile',
      text: profile.content[0].text,
      url: SITE_URL,
      metadata: { kind: 'profile', evidenceVersion: evidenceMeta().version },
    });
  }

  const claim = getClaim(id);

  if (claim) {
    return chatgptResult({
      id: claim.id,
      title: `${claim.title} — ${claim.organization}`,
      text: renderClaim(claim),
      url: claimUrl(claim),
      metadata: {
        kind: 'claim',
        organization: claim.organization,
        ownership: claim.ownership,
        status: claim.status,
        reviewedAt: claim.reviewedAt,
        ...(claim.projectId ? { projectId: claim.projectId } : {}),
      },
    });
  }

  const project = listProjects().find(
    (candidate) => candidate.projectId === id
  );

  if (project) {
    const claims = project.claimIds
      .map((claimId) => getClaim(claimId))
      .filter((entry): entry is ApprovedClaim => entry !== undefined);

    return chatgptResult({
      id: project.projectId,
      title: `${project.title} — ${project.organization}`,
      text: claims.map(renderClaim).join('\n\n'),
      url: project.links[0]?.url ?? `${SITE_URL}/#work`,
      metadata: {
        kind: 'project',
        organization: project.organization,
        ownership: project.ownership,
        status: project.status,
      },
    });
  }

  return toolError(
    `No record with id "${id}". Use search to get valid ids, or "profile" for ` +
      'the overview.'
  );
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  signal: AbortSignal
): Promise<ToolResult> {
  switch (name) {
    case 'get_profile':
      return runGetProfile();
    case 'search_work':
      return runSearchWork(args);
    case 'get_project':
      return runGetProject(args);
    case 'compare_role':
      return runCompareRole(args, signal);
    case 'search':
      return runSearch(args);
    case 'fetch':
      return runFetch(args);
    default:
      return toolError(
        `Unknown tool "${name}". Available tools: ${TOOL_DEFINITIONS.map(
          (tool) => tool.name
        ).join(', ')}.`
      );
  }
}

export function findTool(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name);
}
