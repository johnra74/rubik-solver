import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * cubejs/lib/solve.js starts with `Cube = this.Cube || require('./cube')`, which assumes a CommonJS `this`.
 * In an ES module `this` is undefined, so drop the global lookup and always use require().
 */
const CUBEJS_SOLVE = /cubejs[\\/]lib[\\/]solve\.js$/;
const fixCubejs = (code: string, id: string) =>
  CUBEJS_SOLVE.test(id) ? { code: code.replace('Cube = this.Cube || require(', 'Cube = require('), map: null } : null;

/** Applied to production builds (main bundle and worker). */
function cubejsThisFix(): Plugin {
  return { name: 'cubejs-this-fix', transform: fixCubejs };
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es', plugins: () => [cubejsThisFix()] },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  // The dev server pre-bundles dependencies with Rolldown, which doesn't run Vite `transform` hooks,
  // so the same fix is registered with the dependency optimizer too.
  optimizeDeps: { rolldownOptions: { plugins: [{ name: 'cubejs-this-fix-deps', transform: fixCubejs }] } },
  plugins: [
    cubejsThisFix(),
    VitePWA({
      // 'prompt' lets the app decide when to apply an update (never mid-solve); see src/ui/sw.ts.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "Rubik's Cube Solver",
        short_name: 'Cube Solver',
        description: "Enter your Rubik's Cube and follow step-by-step instructions to solve it. Works offline.",
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#1d2433',
        background_color: '#f4f5f8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
