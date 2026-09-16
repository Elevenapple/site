import { describe, expect, it } from 'vitest';

import { projects } from '../../src/data/portfolio';
import {
  countByFacet,
  filterProjects,
  parseFacets,
  serializeFacets,
  toggleFacet,
  WORK_FACETS,
  type WorkFacet,
} from '../../src/features/work/facets';

describe('parseFacets', () => {
  it('reads a comma-separated list', () => {
    expect(parseFacets('built,contributed')).toEqual(['built', 'contributed']);
  });

  it('drops unknown slugs instead of failing, so a stale link still works', () => {
    expect(parseFacets('built,nonsense,contributed')).toEqual([
      'built',
      'contributed',
    ]);
    expect(parseFacets('nonsense')).toEqual([]);
  });

  it('ignores whitespace, duplicates, and non-string input', () => {
    expect(parseFacets(' built , built ,building')).toEqual([
      'built',
      'building',
    ]);
    expect(parseFacets(undefined)).toEqual([]);
    expect(parseFacets(['built'])).toEqual([]);
    expect(parseFacets('')).toEqual([]);
  });

  it('normalises order, so one selection has exactly one URL', () => {
    expect(parseFacets('contributed,built')).toEqual(
      parseFacets('built,contributed')
    );
  });
});

describe('serializeFacets', () => {
  it('round-trips through parseFacets', () => {
    const selection: WorkFacet[] = ['built', 'contributed'];
    expect(parseFacets(serializeFacets(selection))).toEqual(selection);
  });

  it('returns undefined for an empty selection, keeping the URL bare', () => {
    expect(serializeFacets([])).toBeUndefined();
  });

  it('always emits canonical order', () => {
    expect(serializeFacets(['contributed', 'built'])).toBe('built,contributed');
  });
});

describe('toggleFacet', () => {
  it('adds, removes, and keeps canonical order', () => {
    expect(toggleFacet([], 'building')).toEqual(['building']);
    expect(toggleFacet(['building'], 'built')).toEqual(['built', 'building']);
    expect(toggleFacet(['built', 'building'], 'built')).toEqual(['building']);
  });
});

describe('filterProjects', () => {
  it('shows everything when nothing is selected', () => {
    expect(filterProjects(projects, [])).toHaveLength(projects.length);
  });

  it('matches a project holding any selected facet', () => {
    const built = filterProjects(projects, ['built']);
    expect(built.length).toBeGreaterThan(0);
    expect(built.every((project) => project.facets.includes('built'))).toBe(
      true
    );
  });

  it('unions rather than intersects, so two facets never show less than one', () => {
    const built = filterProjects(projects, ['built']);
    const both = filterProjects(projects, ['built', 'contributed']);
    expect(both.length).toBeGreaterThanOrEqual(built.length);
  });
});

describe('countByFacet', () => {
  const counts = countByFacet(projects);

  it('counts every facet a project carries', () => {
    for (const facet of WORK_FACETS) {
      expect(counts[facet]).toBe(filterProjects(projects, [facet]).length);
    }
  });

  it('never shows a chip that filters to nothing', () => {
    // A zero count next to a clickable chip is a dead end; if this fails, the
    // facet belongs on a project or off the list.
    for (const facet of WORK_FACETS) {
      expect(counts[facet], facet).toBeGreaterThan(0);
    }
  });
});

describe('project data', () => {
  it('gives every project at least one facet, so none is unreachable', () => {
    for (const project of projects) {
      expect(project.facets.length, project.id).toBeGreaterThan(0);
    }
  });

  it('uses only known facets', () => {
    for (const project of projects) {
      for (const facet of project.facets) {
        expect(WORK_FACETS).toContain(facet);
      }
    }
  });
});
