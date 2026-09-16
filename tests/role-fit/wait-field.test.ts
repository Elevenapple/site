import { describe, expect, it } from 'vitest';
import { effect, init, target } from 'vgpu/mock';

import waitFieldSource from '../../src/features/role-fit/wait-field.wgsl';
import { FIT_STAGE_IDS } from '../../src/features/role-fit/stages';

const PALETTE = {
  drafting: [244 / 255, 173 / 255, 33 / 255, 1],
  matching: [36 / 255, 87 / 255, 230 / 255, 1],
  reading: [94 / 255, 107 / 255, 115 / 255, 1],
};

describe('role-fit wait field', () => {
  it('compiles and draws for every stage', async () => {
    const gpu = await init();
    const errors: unknown[] = [];
    const releaseErrorListener = gpu.onError((error) => errors.push(error));
    const output = target(gpu, { size: [256, 96], format: 'rgba8unorm' });
    const field = effect(gpu, waitFieldSource, {
      set: {
        params: {
          ...PALETTE,
          height: 96,
          stage: 1,
          time: 0,
          width: 256,
        },
      },
    });

    try {
      for (const stage of FIT_STAGE_IDS) {
        field.set({ params: { stage, time: stage * 0.4 } });
        field.draw(output);
      }
      await gpu.settled();
      expect(errors).toEqual([]);
    } finally {
      releaseErrorListener();
      gpu.dispose();
    }
  });

  it('draws the fractional stages the client eases through', async () => {
    // The client never jumps 1 → 2; it eases, so the shader is asked for every
    // value in between and must not read outside its colour stops.
    const gpu = await init();
    const errors: unknown[] = [];
    const releaseErrorListener = gpu.onError((error) => errors.push(error));
    const output = target(gpu, { size: [128, 48], format: 'rgba8unorm' });
    const field = effect(gpu, waitFieldSource, {
      set: {
        params: { ...PALETTE, height: 48, stage: 1, time: 0, width: 128 },
      },
    });

    try {
      for (const stage of [0.5, 1, 1.37, 2, 2.81, 3, 3.5]) {
        field.set({ params: { stage } });
        field.draw(output);
      }
      await gpu.settled();
      expect(errors).toEqual([]);
    } finally {
      releaseErrorListener();
      gpu.dispose();
    }
  });
});
