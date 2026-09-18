import { describe, expect, it } from 'vitest';

import {
  FitHydrationError,
  hydrateFitBrief,
} from '../../server/role-fit/hydration';
import {
  modelFitBriefSchema,
  type ModelFitBrief,
} from '../../server/role-fit/model-contract';

const roleText = `Senior Product Engineer at Example
You will build React and TypeScript applications for customer-facing workflows.
Experience taking products from prototype through live testing is required.
Experience with Kubernetes in production is preferred.`;

function modelBrief(): ModelFitBrief {
  return {
    role: {
      title: 'Senior Product Engineer',
      company: 'Example',
      requirements: [
        {
          id: 'react-typescript',
          sourceExcerpt:
            'build React and TypeScript applications for customer-facing workflows',
          priority: 'required',
        },
        {
          id: 'prototype-live-testing',
          sourceExcerpt: 'prototype through live testing is required',
          priority: 'required',
        },
        {
          id: 'kubernetes',
          sourceExcerpt: 'Kubernetes in production is preferred',
          priority: 'preferred',
        },
      ],
    },
    matches: [
      {
        requirementId: 'react-typescript',
        relationship: 'direct',
        claimIds: ['appnovation-product-engineering'],
      },
      {
        requirementId: 'prototype-live-testing',
        relationship: 'direct',
        claimIds: ['builder-internal-ai-gtm'],
      },
    ],
    unknowns: [
      {
        requirementId: 'kubernetes',
        reason: 'no-public-evidence',
      },
    ],
  };
}

describe('fit brief hydration', () => {
  it('resolves claim IDs into server-owned evidence and metadata', () => {
    const result = hydrateFitBrief(modelBrief(), roleText, {
      requestId: 'request-123',
      generatedAt: '2026-08-27T12:00:00.000Z',
    });

    expect(result.matches[0]?.evidence[0]).toMatchObject({
      id: 'appnovation-product-engineering',
      organization: 'Appnovation',
    });
    expect(result.role.requirements[0]?.label).toBe(
      'build React and TypeScript applications for customer-facing workflows'
    );
    expect(result.matches[0]?.evidence[0]?.sources[0]).toMatchObject({
      id: 'ahmed-public-portfolio',
      provenance: 'ahmed-published-claim',
    });
    expect(result.summary).toBe(
      "Of the 3 role requirements identified, 2 were mapped to Ahmed's published claims and links as direct overlap and 1 is not covered on this site. A missing public record is a question to investigate, not proof that the experience is absent."
    );
    expect(result.matches[0]?.rationale).toBe(
      'This comparison mapped the published claims below as direct overlap.'
    );
    expect(result.unknowns[0]?.explanation).toBe(
      "Ahmed's published claims and links do not cover this requirement. That leaves a question to ask, not a conclusion about his experience."
    );
    expect(result.interviewQuestions).toHaveLength(3);
    expect(
      result.interviewQuestions.every(
        (question) => question.resolvesRequirementIds.length > 0
      )
    ).toBe(true);
    expect(result.interviewQuestions[0]).toMatchObject({
      resolvesRequirementIds: ['kubernetes'],
      testsClaimIds: [],
    });
    expect(result.meta).toMatchObject({
      requestId: 'request-123',
      evidenceVersion: '2026-08-27.7',
    });
  });

  it('nulls title and company values not present in the role text', () => {
    const value = modelBrief();
    value.role.title = 'Invented Staff Architect';
    value.role.company = 'Invented Corp';

    const result = hydrateFitBrief(value, roleText, {
      requestId: 'request-123',
      generatedAt: '2026-08-27T12:00:00.000Z',
    });

    expect(result.role.title).toBeNull();
    expect(result.role.company).toBeNull();
  });

  it('returns canonical title, company, and excerpt text from the submitted role', () => {
    const value = modelBrief();
    value.role.title = 'senior product engineer';
    value.role.company = 'example';
    value.role.requirements[0]!.sourceExcerpt =
      'BUILD react AND typescript APPLICATIONS FOR customer-facing WORKFLOWS';

    const result = hydrateFitBrief(value, roleText, {
      requestId: 'request-123',
      generatedAt: '2026-08-27T12:00:00.000Z',
    });

    expect(result.role.title).toBe('Senior Product Engineer');
    expect(result.role.company).toBe('Example');
    expect(result.role.requirements[0]?.sourceExcerpt).toBe(
      'build React and TypeScript applications for customer-facing workflows'
    );
  });

  it('rejects whitespace-only role fields', () => {
    const whitespaceTitle = modelBrief();
    whitespaceTitle.role.title = '   ';
    const whitespaceCompany = modelBrief();
    whitespaceCompany.role.company = '\n\t ';
    const whitespaceExcerpt = modelBrief();
    whitespaceExcerpt.role.requirements[0]!.sourceExcerpt = '          ';

    expect(modelFitBriefSchema.safeParse(whitespaceTitle).success).toBe(false);
    expect(modelFitBriefSchema.safeParse(whitespaceCompany).success).toBe(
      false
    );
    expect(modelFitBriefSchema.safeParse(whitespaceExcerpt).success).toBe(
      false
    );
  });

  it('fails closed for an unknown claim ID', () => {
    const value = modelBrief();
    value.matches[0]!.claimIds = ['invented-claim'];

    expect(() =>
      hydrateFitBrief(value, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
  });

  it('fails closed for unknown requirements and fabricated excerpts', () => {
    const unknownRequirement = modelBrief();
    unknownRequirement.matches[0]!.requirementId = 'missing-requirement';

    const fabricatedExcerpt = modelBrief();
    fabricatedExcerpt.role.requirements[0]!.sourceExcerpt =
      'This wording never appeared in the submitted role';

    expect(() =>
      hydrateFitBrief(unknownRequirement, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
    expect(() =>
      hydrateFitBrief(fabricatedExcerpt, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
  });

  it('requires matches and unknowns to partition every requirement', () => {
    const omitted = modelBrief();
    omitted.unknowns = [];

    const classifiedTwice = modelBrief();
    classifiedTwice.unknowns[0]!.requirementId = 'react-typescript';

    expect(() =>
      hydrateFitBrief(omitted, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
    expect(() =>
      hydrateFitBrief(classifiedTwice, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
  });

  it('rejects duplicate normalized source excerpts under different IDs', () => {
    const value = modelBrief();
    value.role.requirements[1]!.sourceExcerpt =
      'BUILD   REACT and TypeScript applications for customer-facing workflows';

    expect(() =>
      hydrateFitBrief(value, roleText, {
        requestId: 'request-123',
        generatedAt: '2026-08-27T12:00:00.000Z',
      })
    ).toThrow(FitHydrationError);
  });

  it('rejects free-form comparison prose and more than six requirements', () => {
    const smuggled = {
      ...modelBrief(),
      summary: 'Ahmed increased revenue by 900 percent.',
    };
    expect(modelFitBriefSchema.safeParse(smuggled).success).toBe(false);

    const smuggledLabel = modelBrief() as unknown as {
      role: { requirements: Array<Record<string, unknown>> };
    };
    smuggledLabel.role.requirements[0]!.label =
      'Ahmed generated one billion dollars';
    expect(modelFitBriefSchema.safeParse(smuggledLabel).success).toBe(false);

    const tooMany = modelBrief();
    tooMany.role.requirements = Array.from({ length: 7 }, (_, index) => ({
      id: `requirement-${index}`,
      sourceExcerpt: 'Experience with Kubernetes in production is preferred',
      priority: 'preferred' as const,
    }));
    expect(modelFitBriefSchema.safeParse(tooMany).success).toBe(false);
  });
});
