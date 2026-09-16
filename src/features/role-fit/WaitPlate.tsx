import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionConfig,
} from 'motion/react';
import { Layers, PenLine, ScanLine } from 'lucide-react';
import type { ComponentType } from 'react';

import { FIT_STAGE_IDS, type FitStageId } from './stages';
import { WaitField } from './WaitField';

const STAGE_ICONS: Record<
  FitStageId,
  ComponentType<{ 'aria-hidden': 'true' }>
> = {
  1: ScanLine,
  2: Layers,
  3: PenLine,
};

/**
 * The comparison takes about fifteen seconds across three named stages, which
 * is long enough that a spinner would be a shrug. So the plate says what is
 * happening, and the surface behind it changes colour as it moves on.
 *
 * The label morphs the way Family's transaction button does: the row animates
 * its own width while the old label leaves to the right and the new one enters
 * from the left. Both labels are `nowrap` and neither is ever scaled, which is
 * what stops the text going jelly — the box resizes, the text only travels.
 */
export function WaitPlate({
  stage,
  label,
  onCancel,
}: {
  stage: FitStageId;
  label: string;
  onCancel: () => void;
}) {
  const Icon = STAGE_ICONS[stage];

  return (
    <div className="wait-plate" data-stage={stage}>
      <WaitField stage={stage} />

      <div className="wait-plate__body">
        <LazyMotion features={domAnimation} strict>
          {/* reducedMotion="user" drops the transforms and keeps the crossfade,
              so the stage still changes visibly without anything travelling. */}
          <MotionConfig reducedMotion="user">
            <m.div layout className="wait-plate__pill" transition={PILL_LAYOUT}>
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={`icon-${stage}`}
                  className="wait-plate__icon"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <Icon aria-hidden="true" />
                </m.span>

                <m.span
                  key={`label-${stage}`}
                  className="wait-plate__label"
                  initial={{ opacity: 0, x: -22 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 22 }}
                  transition={LABEL_IN}
                >
                  {label}
                </m.span>
              </AnimatePresence>
            </m.div>
          </MotionConfig>
        </LazyMotion>

        <p className="wait-plate__count">
          <span>{stage}</span>
          <span aria-hidden="true">/</span>
          <span>{FIT_STAGE_IDS.length}</span>
        </p>
      </div>

      {/* Three discrete segments rather than a bar creeping to 100%. The work
          really is staged, and a fake percentage would be the dishonest
          version of the same reassurance. */}
      <ol className="wait-plate__track" aria-hidden="true">
        {FIT_STAGE_IDS.map((id) => (
          <li
            key={id}
            data-state={id < stage ? 'done' : id === stage ? 'live' : 'todo'}
          />
        ))}
      </ol>

      <button type="button" className="wait-plate__cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** Entrances get the spring; exits get out of the way. */
const LABEL_IN = { type: 'spring', duration: 0.55, bounce: 0.22 } as const;
const PILL_LAYOUT = { type: 'spring', duration: 0.5, bounce: 0.18 } as const;
