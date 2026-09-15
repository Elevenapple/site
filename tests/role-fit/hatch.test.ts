import { describe, expect, it } from 'vitest';
import { effect, init, target } from 'vgpu/mock';

import hatchSource from '../../src/features/role-fit/hatch.wgsl';

describe('role-fit vgpu hatch', () => {
  it('compiles and draws the custom WGSL for every streamed density', async () => {
    const gpu = await init();
    const errors: unknown[] = [];
    const releaseErrorListener = gpu.onError((error) => errors.push(error));
    const output = target(gpu, { size: [96, 32], format: 'rgba8unorm' });
    const hatch = effect(gpu, hatchSource, {
      set: {
        params: {
          density: 1,
          height: 32,
          ink: [21 / 255, 25 / 255, 29 / 255, 1],
          paper: [243 / 255, 246 / 255, 247 / 255, 1],
          time: 0,
          width: 96,
        },
      },
    });

    try {
      for (const density of [1, 2, 3]) {
        hatch.set({ params: { density } });
        hatch.draw(output);
      }
      await gpu.settled();
      expect(errors).toEqual([]);
    } finally {
      releaseErrorListener();
      gpu.dispose();
    }
  });
});
