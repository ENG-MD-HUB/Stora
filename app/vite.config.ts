import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output goes to ../beta so GitHub Pages serves it at /Stora/beta/
export default defineConfig({
  plugins: [react()],
  base: '/Stora/beta/',
  build: { outDir: '../beta', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
