/**
 * How a visitor slices Selected work.
 *
 * The facets answer the question the ownership labels already imply — what did
 * he build versus contribute to — so the counts do most of the work before
 * anyone clicks. A project can hold more than one: Nomad was built from zero
 * and is still being built.
 */
export const WORK_FACETS = ['built', 'building', 'contributed'] as const;

export type WorkFacet = (typeof WORK_FACETS)[number];

export const WORK_FACET_LABELS: Record<WorkFacet, string> = {
  built: 'Built from zero',
  building: 'Still building',
  contributed: 'Contributed',
};

/** The only thing these helpers need from a project. */
type Faceted = { facets: readonly WorkFacet[] };

export function isWorkFacet(value: unknown): value is WorkFacet {
  return (
    typeof value === 'string' &&
    (WORK_FACETS as readonly string[]).includes(value)
  );
}

/**
 * Unknown slugs are dropped rather than treated as an error, so a stale or
 * hand-edited link still renders the feed instead of breaking it.
 */
export function parseFacets(value: unknown): WorkFacet[] {
  if (typeof value !== 'string') return [];

  const seen = new Set<WorkFacet>();
  for (const part of value.split(',')) {
    const slug = part.trim();
    if (isWorkFacet(slug)) seen.add(slug);
  }

  return WORK_FACETS.filter((facet) => seen.has(facet));
}

/**
 * Serialised in WORK_FACETS order so the same selection always produces the
 * same URL, whatever order the visitor clicked them in.
 */
export function serializeFacets(
  facets: readonly WorkFacet[]
): string | undefined {
  const selected = WORK_FACETS.filter((facet) => facets.includes(facet));
  return selected.length > 0 ? selected.join(',') : undefined;
}

export function toggleFacet(
  facets: readonly WorkFacet[],
  facet: WorkFacet
): WorkFacet[] {
  return facets.includes(facet)
    ? facets.filter((current) => current !== facet)
    : WORK_FACETS.filter(
        (current) => facets.includes(current) || current === facet
      );
}

/** No selection means everything, which is also what an empty match would show. */
export function filterProjects<T extends Faceted>(
  projects: readonly T[],
  facets: readonly WorkFacet[]
): T[] {
  if (facets.length === 0) return [...projects];

  return projects.filter((project) =>
    project.facets.some((facet) => facets.includes(facet))
  );
}

export function countByFacet(
  projects: readonly Faceted[]
): Record<WorkFacet, number> {
  const counts = Object.fromEntries(
    WORK_FACETS.map((facet) => [facet, 0])
  ) as Record<WorkFacet, number>;

  for (const project of projects) {
    for (const facet of project.facets) {
      counts[facet] += 1;
    }
  }

  return counts;
}
