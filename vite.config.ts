import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const singleFile = process.env.VITE_SINGLE_FILE === 'true';
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA_DIR = path.resolve(rootDir, 'public/data');

function howfishSingleDataPlugin(): Plugin {
  const virtualId = 'virtual:howfish-single-data';
  const resolvedId = `\0${virtualId}`;

  return {
    name: 'howfish-single-data',
    resolveId(id) {
      return id === virtualId ? resolvedId : null;
    },
    load(id) {
      if (id !== resolvedId) {
        return null;
      }
      const readJson = (file: string): unknown =>
        JSON.parse(
          fs.readFileSync(path.join(PUBLIC_DATA_DIR, file), 'utf-8'),
        ) as unknown;
      const bundle = {
        species: readJson('species.json'),
        taxonomy: readJson('taxonomy.json'),
        traps: readJson('traps.json'),
        regions: readJson('regions.json'),
        redirects: readJson('id_redirects.json'),
        meta: readJson('meta.json'),
      };
      const packed = gzipSync(
        Buffer.from(JSON.stringify(bundle), 'utf-8'),
        { level: 9 },
      ).toString('base64');
      return `export const PACKED_DATA_B64 = ${JSON.stringify(packed)};`;
    },
  };
}

function renameOfflineBundle(): Plugin {
  return {
    name: 'howfish-rename-offline-bundle',
    apply: 'build',
    closeBundle() {
      const outDir = path.resolve(rootDir, 'dist-single');
      const source = path.join(outDir, 'index.html');
      const target = path.join(outDir, 'howfish-offline.html');
      if (fs.existsSync(source)) {
        fs.renameSync(source, target);
      }
    },
  };
}

const pwa = VitePWA({
  registerType: 'prompt',
  injectRegister: 'auto',
  includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
  manifest: {
    name: 'HowFish · 离线海产速查图鉴',
    short_name: 'HowFish',
    description: '中澳海产俗称、学名、时令与食用安全的离线速查图鉴',
    lang: 'zh-CN',
    theme_color: '#0B4F71',
    background_color: '#0B4F71',
    display: 'standalone',
    orientation: 'portrait-primary',
    start_url: './',
    scope: './',
    icons: [
      { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: './icons/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    cleanupOutdatedCaches: true,
    navigateFallback: 'index.html',
  },
});

export default defineConfig({
  base: './',
  resolve: singleFile
    ? undefined
    : {
        alias: {
          'virtual:howfish-single-data': path.resolve(
            rootDir,
            'src/services/singleFileDataStub.ts',
          ),
        },
      },
  plugins: singleFile
    ? [
        react(),
        howfishSingleDataPlugin(),
        viteSingleFile(),
        renameOfflineBundle(),
      ]
    : [react(), pwa],
  define: {
    'import.meta.env.VITE_SINGLE_FILE': JSON.stringify(singleFile ? 'true' : 'false'),
  },
  build: {
    outDir: singleFile ? 'dist-single' : 'dist',
    emptyOutDir: true,
    target: ['es2020', 'safari14'],
    sourcemap: false,
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100 * 1024 * 1024 : 4096,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
