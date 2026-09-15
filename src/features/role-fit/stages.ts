export const FIT_STAGE_IDS = [1, 2, 3] as const;

export type FitStageId = (typeof FIT_STAGE_IDS)[number];

/** Locked Site Copy — Compare status plate while running. */
export const FIT_STAGE_COPY = {
  1: 'Reading the role',
  2: 'Matching public claims',
  3: 'Drafting gaps and three questions',
} as const satisfies Record<FitStageId, string>;

/** Locked Site Copy — fail/cancel clears the brief. */
export const FIT_STOPPED_COPY = 'Comparison stopped — nothing saved.';

export function isFitStageId(value: unknown): value is FitStageId {
  return value === 1 || value === 2 || value === 3;
}
