import { useEffect, useRef, useState } from 'react';

import type { FitStageId } from './stages';

type FieldMode = 'css' | 'gpu';

type FieldSession = {
  destroy: () => void;
  setStage: (stage: FitStageId) => void;
  setPaused: (paused: boolean) => void;
};

const READING: Rgb = [94 / 255, 107 / 255, 115 / 255];
const MATCHING: Rgb = [36 / 255, 87 / 255, 230 / 255];
const DRAFTING: Rgb = [244 / 255, 173 / 255, 33 / 255];

type Rgb = [number, number, number];

function readCssRgb(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: Rgb
): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(styles.getPropertyValue(name).trim());
  if (!match) return [...fallback];

  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

async function startField(
  canvas: HTMLCanvasElement,
  stage: FitStageId
): Promise<FieldSession> {
  const [{ clock, effect, frameLoop, init, surface }, { default: source }] =
    await Promise.all([import('vgpu'), import('./wait-field.wgsl')]);

  const gpu = await init();

  try {
    const canvasSurface = surface(gpu, canvas, {
      // Premultiplied over a transparent clear, so the plate's own CSS tint is
      // the base colour and this pass only adds the moving light.
      alphaMode: 'premultiplied',
      clearColor: [0, 0, 0, 0],
      dpr: [1, 2],
      label: 'role-fit-wait-field',
    });

    const styles = getComputedStyle(canvas);
    const field = effect(gpu, source, {
      label: 'role-fit-wait-field-effect',
      set: {
        params: {
          drafting: [...readCssRgb(styles, '--checkpoint', DRAFTING), 1],
          height: canvasSurface.size[1],
          matching: [...readCssRgb(styles, '--route', MATCHING), 1],
          reading: [...readCssRgb(styles, '--steel', READING), 1],
          stage,
          time: 0,
          width: canvasSurface.size[0],
        },
      },
    });

    // Warm the pipeline against the canvas format rather than the surface:
    // vgpu only permits surface passes inside a frame, so compiling against the
    // surface itself throws VGPU-SURFACE-NOT-IN-FRAME and drops the whole GPU
    // path. A wrong signature here costs nothing — the real pass compiles
    // lazily on first draw either way — so a failed warm-up is not fatal.
    try {
      await field.compile({
        colors: [navigator.gpu.getPreferredCanvasFormat()],
      });
    } catch (error) {
      if (import.meta.env.DEV)
        console.warn('wait field warm-up skipped:', error);
    }

    if (import.meta.env.DEV) {
      gpu.onError((error: unknown) =>
        console.error('wait field gpu error:', error)
      );
    }

    const time = clock(gpu);
    let target: number = stage;
    let eased: number = stage;
    let loop: { stop: () => void } | null = null;
    let paused = false;
    let destroyed = false;

    const unsubscribeResize = canvasSurface.onResize(({ width, height }) => {
      field.set({ params: { width, height } });
    });

    const startLoop = () => {
      if (destroyed || paused || loop) return;

      loop = frameLoop(
        gpu,
        (frame) => {
          // Ease toward the stage rather than snapping, so the colour change
          // is something you watch happen rather than a cut between frames.
          eased += (target - eased) * 0.045;
          field.set({ params: { stage: eased, time: time.time } });
          frame.pass(canvasSurface, field);
        },
        { fps: 60 }
      );
    };

    startLoop();

    return {
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        loop?.stop();
        loop = null;
        unsubscribeResize();
        canvasSurface.dispose();
        gpu.dispose();
      },
      setStage: (next) => {
        target = next;
      },
      setPaused: (next) => {
        paused = next;
        if (next) {
          loop?.stop();
          loop = null;
        } else {
          startLoop();
        }
      },
    };
  } catch (error) {
    gpu.dispose();
    throw error;
  }
}

/**
 * The gradient behind the wait plate. WebGPU through vgpu where it exists, a
 * CSS gradient everywhere else, and a flat plate under prefers-reduced-motion.
 *
 * The loop stops whenever the tab is hidden or the plate scrolls away: an idle
 * GPU context still costs, and nobody is watching it.
 */
export function WaitField({ stage }: { stage: FitStageId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<FieldSession | null>(null);
  const stageRef = useRef(stage);
  const [mode, setMode] = useState<FieldMode>('css');
  stageRef.current = stage;

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let visible = true;

    const syncPause = () => {
      sessionRef.current?.setPaused(document.hidden || !visible);
    };

    const onMotionChange = () => {
      if (!reduceMotion.matches) return;
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setMode('css');
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        syncPause();
      },
      { threshold: 0.05 }
    );

    if (root) observer.observe(root);
    document.addEventListener('visibilitychange', syncPause);
    reduceMotion.addEventListener('change', onMotionChange);

    const hasWebGpu = 'gpu' in navigator && navigator.gpu != null;
    if (canvas && hasWebGpu && !reduceMotion.matches) {
      void startField(canvas, stageRef.current)
        .then((session) => {
          if (cancelled || reduceMotion.matches) {
            session.destroy();
            return;
          }
          sessionRef.current = session;
          syncPause();
          setMode('gpu');
        })
        .catch((error: unknown) => {
          // The CSS gradient covers this, but a silent GPU failure is
          // impossible to diagnose from a screenshot.
          if (import.meta.env.DEV) console.warn('wait field fell back:', error);
          if (!cancelled) setMode('css');
        });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', syncPause);
      reduceMotion.removeEventListener('change', onMotionChange);
      observer.disconnect();
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    sessionRef.current?.setStage(stage);
  }, [stage]);

  return (
    <div
      ref={rootRef}
      className={`wait-plate__field wait-plate__field--${mode}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="wait-plate__canvas" />
    </div>
  );
}
