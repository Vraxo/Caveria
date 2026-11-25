import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs let the same build run over HTTP and Electron's file protocol.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
