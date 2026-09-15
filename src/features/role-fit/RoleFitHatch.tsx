import { useEffect, useRef, useState } from 'react';

import type { FitStageId } from './stages';

type HatchMode = 'css' | 'gpu';

type GpuSession = {
  destroy: () => void;
  setDensity: (density: FitStageId) => void;
  setPaused: (paused: boolean) => void;
};

const PAPER_RGB = [243 / 255, 246 / 255, 247 / 255] as const;
const INK_RGB = [21 / 255, 25 / 255, 29 / 255] as const;

function readCssRgb(
  styles: CSSStyleDeclaration,
  name: string,
  fallback: readonly [number, number, number]
): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(styles.getPropertyValue(name).trim());
  if (!match) {
    return [...fallback];
  }

  const hex = match[1]!;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

async function startGpuHatch(
  canvas: HTMLCanvasElement,
  stage: FitStageId
): Promise<GpuSession> {
  const [
    { clock, effect, frameLoop, init, surface },
    { default: hatchSource },
  ] = await Promise.all([import('vgpu'), import('./hatch.wgsl')]);

  const gpu = await init();

  try {
    const canvasSurface = surface(gpu, canvas, {
      alphaMode: 'opaque',
      clearColor: [PAPER_RGB[0], PAPER_RGB[1], PAPER_RGB[2], 1],
      dpr: [1, 2],
      label: 'role-fit-hatch',
    });
    const styles = getComputedStyle(canvas);
    const paper = readCssRgb(styles, '--paper', PAPER_RGB);
    const ink = readCssRgb(styles, '--ink', INK_RGB);
    const hatch = effect(gpu, hatchSource, {
      label: 'role-fit-hatch-field',
      set: {
        params: {
          density: stage,
          height: canvasSurface.size[1],
          ink: [...ink, 1],
          paper: [...paper, 1],
          time: 0,
          width: canvasSurface.size[0],
        },
      },
    });

    await hatch.compile(canvasSurface);

    const time = clock(gpu);
    let density: FitStageId = stage;
    let loop: { stop: () => void } | null = null;
    let paused = false;
    let destroyed = false;

    const unsubscribeResize = canvasSurface.onResize(({ width, height }) => {
      hatch.set({ params: { width, height } });
    });

    const startLoop = () => {
      if (destroyed || paused || loop) {
        return;
      }

      loop = frameLoop(
        gpu,
        (frame) => {
          hatch.set({ params: { density, time: time.time } });
          frame.pass(canvasSurface, hatch);
        },
        { fps: 30 }
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
      setDensity: (next) => {
        density = next;
        hatch.set({ params: { density: next } });
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
 * Tiny wait-skin hatch: WebGPU via vgpu when available; CSS hatch (or a static
 * steel rule under prefers-reduced-motion) otherwise.
 */
export function RoleFitHatch({ stage }: { stage: FitStageId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<GpuSession | null>(null);
  const stageRef = useRef(stage);
  const [mode, setMode] = useState<HatchMode>('css');
  stageRef.current = stage;

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled = false;
    let visible = true;

    const syncPause = () => {
      sessionRef.current?.setPaused(document.hidden || !visible);
    };
    const onMotionChange = () => {
      if (!motion.matches) return;
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
    motion.addEventListener('change', onMotionChange);

    const hasWebGpu = 'gpu' in navigator && navigator.gpu != null;
    if (canvas && hasWebGpu && !motion.matches) {
      void startGpuHatch(canvas, stageRef.current)
        .then((session) => {
          if (cancelled || motion.matches) {
            session.destroy();
            return;
          }
          sessionRef.current = session;
          syncPause();
          setMode('gpu');
        })
        .catch(() => {
          if (!cancelled) setMode('css');
        });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', syncPause);
      motion.removeEventListener('change', onMotionChange);
      observer.disconnect();
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    sessionRef.current?.setDensity(stage);
  }, [stage]);

  return (
    <div
      ref={rootRef}
      className={`role-fit__hatch role-fit__hatch--${mode}`}
      data-hatch={mode}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="role-fit__hatch-canvas" />
    </div>
  );
}
