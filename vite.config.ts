import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'docs',
    emptyOutDir: false, // Don't delete docs/ entirely (preserve other files)
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'Storie',
      fileName: (format) => `storie.${format}.js`,
      formats: ['es', 'umd']
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
  },
  server: {
    port: 3000,
    open: false,
    root: 'site',
    fs: {
      // Allow serving files from project root
      allow: ['..']
    }
  },
  // Exclude old project directories
  optimizeDeps: {
    exclude: ['@endo/init']
  }
});
