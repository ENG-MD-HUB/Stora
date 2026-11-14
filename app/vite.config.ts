import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built into app/dist; the workflow copies it to the repository root, served at /Stora/
export default defineConfig({
  plugins: [react()],
  base: '/Stora/',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
