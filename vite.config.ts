import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths, so the build works under any sub-path
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // three and the physics WASM rarely change between game patches, so
        // splitting them lets the browser keep them cached across rebuilds.
        // Same reasoning as the 2D template's `phaser` chunk.
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
