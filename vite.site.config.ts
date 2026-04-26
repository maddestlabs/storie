import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'docs',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/site-entry.ts'),
      name: 'StorieSite',
      fileName: () => 'storie-site.js',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {}
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false
      }
    }
  }
});