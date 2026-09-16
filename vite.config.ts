import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';
import path from 'path';
import { execSync } from 'node:child_process';
import { devApiPlugin } from './dev-api-plugin';

/**
 * Vercel exposes the deployed commit at build time; a local build falls back to
 * git. Baked in with `define` rather than fetched from the GitHub API at
 * runtime, because the answer is identical for every visitor and a request per
 * page view to show seven characters is not worth it.
 */
function buildSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);

  try {
    return execSync('git rev-parse --short=7 HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ autoCodeSplitting: true }),
    react(),
    wgslVitePlugin(),
    devApiPlugin(),
  ],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL') return;
        warn(warning);
      },
    },
  },
});
