import { defineConfig } from 'vite';
import mapSaver from './vite.mapSaver.js';

export default defineConfig({
  plugins: [mapSaver()],
  server: {
    port: 5174,
    open: false,
  },
});
