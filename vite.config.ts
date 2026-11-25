import { defineConfig } from 'vite';

// Relative asset paths so the app works when served from a project
// page subpath (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
});
