import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
// Build id shown in playtest reports: short commit (with + when the tree has edits) and date.
const build = (() => {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim(),
      dirty = execSync('git status --porcelain').toString().trim() ? '+' : '';
    return `${hash}${dirty} ${new Date().toISOString().slice(0, 10)}`;
  } catch {
    return 'unknown';
  }
})();
export default defineConfig({
  define: { __BUILD__: JSON.stringify(build) },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
