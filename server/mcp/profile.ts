import { approvedEvidence, type ApprovedClaim } from '../role-fit/evidence.js';

/**
 * Read-only lookups over the approved public claim set.
 *
 * Everything here is already published on paprikaf.com. Nothing in this module
 * may reach private evidence, so the MCP endpoint can stay unauthenticated.
 */

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'by',
  'did',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'he',
  'his',
  'how',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'to',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'with',
  'work',
  'worked',
  'ahmed',
  'felfel',
]);

export type ProfileSearchHit = {
  claim: ApprovedClaim;
  score: number;
};

export type ProjectSummary = {
  projectId: string;
  title: string;
  organization: string;
  ownership: string;
  status: string;
  capabilities: string[];
  claimIds: string[];
  links: Array<{ label: string; url: string }>;
};

function tokenize(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map((token) => token.replace(/^[.+#]+|[.+#]+$/g, ''))
        .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    ),
  ];
}

function haystack(claim: ApprovedClaim): string {
  return [
    claim.title,
    claim.organization,
    claim.claim,
    claim.ownership,
    claim.status,
    claim.capabilities.join(' ').replace(/-/g, ' '),
    claim.caveats.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Deterministic keyword scoring. The approved corpus is small enough that this
 * beats embeddings on both predictability and cost, and it never invents a hit.
 */
export function searchProfile(query: string, limit = 6): ProfileSearchHit[] {
  const tokens = tokenize(query);
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  if (tokens.length === 0) {
    return approvedEvidence.claims
      .slice(0, safeLimit)
      .map((claim) => ({ claim, score: 0 }));
  }

  const hits = approvedEvidence.claims
    .map((claim) => {
      const text = haystack(claim);
      const title = claim.title.toLowerCase();
      const capabilities = claim.capabilities
        .join(' ')
        .replace(/-/g, ' ')
        .toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (capabilities.includes(token)) score += 3;
        if (title.includes(token)) score += 2;
        if (text.includes(token)) score += 1;
      }

      return { claim, score };
    })
    .filter((hit) => hit.score > 0);

  hits.sort(
    (a, b) => b.score - a.score || a.claim.id.localeCompare(b.claim.id)
  );
  return hits.slice(0, safeLimit);
}

export function getClaim(claimId: string): ApprovedClaim | undefined {
  return approvedEvidence.claims.find((claim) => claim.id === claimId);
}

export function listClaimIds(): string[] {
  return approvedEvidence.claims.map((claim) => claim.id);
}

/** One row per project, folding together the claims that describe it. */
export function listProjects(): ProjectSummary[] {
  const byProject = new Map<string, ProjectSummary>();

  for (const claim of approvedEvidence.claims) {
    const projectId = claim.projectId ?? claim.id;
    const existing = byProject.get(projectId);

    const links = claim.sources
      .filter((source) => source.url !== undefined)
      .map((source) => ({ label: source.label, url: source.url as string }));

    if (!existing) {
      byProject.set(projectId, {
        projectId,
        title: claim.title,
        organization: claim.organization,
        ownership: claim.ownership,
        status: claim.status,
        capabilities: [...claim.capabilities],
        claimIds: [claim.id],
        links,
      });
      continue;
    }

    existing.claimIds.push(claim.id);
    for (const capability of claim.capabilities) {
      if (!existing.capabilities.includes(capability)) {
        existing.capabilities.push(capability);
      }
    }
    for (const link of links) {
      if (!existing.links.some((current) => current.url === link.url)) {
        existing.links.push(link);
      }
    }
  }

  return [...byProject.values()];
}

export function listCapabilities(): Array<{
  capability: string;
  claimIds: string[];
}> {
  const byCapability = new Map<string, string[]>();

  for (const claim of approvedEvidence.claims) {
    for (const capability of claim.capabilities) {
      const claimIds = byCapability.get(capability) ?? [];
      claimIds.push(claim.id);
      byCapability.set(capability, claimIds);
    }
  }

  return [...byCapability.entries()]
    .map(([capability, claimIds]) => ({ capability, claimIds }))
    .sort((a, b) => a.capability.localeCompare(b.capability));
}

export function evidenceMeta(): { version: string; reviewedAt: string } {
  return {
    version: approvedEvidence.version,
    reviewedAt: approvedEvidence.reviewedAt,
  };
}
