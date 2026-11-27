import { defineConfig } from 'vite';
import mapSaver from './vite.mapSaver.js';

export default defineConfig({
  base: './',
  plugins: [mapSaver()],
  server: {
    port: 5174,
    open: false,
  },
});
