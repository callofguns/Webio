import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base: './' makes the build work on GitHub Pages (or any host) without
// knowing the final URL path.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Makes the game installable (a PWA) and playable offline after the first visit.
    VitePWA({
      // Ask the player before switching to a new version, so a save isn't interrupted.
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Webio — Agency Simulator',
        short_name: 'Webio',
        description: 'Run your own web design agency. Cold call, close deals, build sites, hire a team.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f7f9',
        theme_color: '#4f46e5',
        categories: ['games', 'simulation', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Keep the Google fonts around so the game looks right offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // The whole game is one small bundle (~160 KB gzipped), so skip the size warning.
  build: { chunkSizeWarningLimit: 800 },
});
