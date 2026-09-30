import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the build work on GitHub Pages (or any host) without
// knowing the final URL path.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The whole game is one small bundle (~160 KB gzipped), so skip the size warning.
  build: { chunkSizeWarningLimit: 800 },
});
