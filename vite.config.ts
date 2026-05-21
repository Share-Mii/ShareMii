import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      'miijs',
      'jsqr',
      '@supabase/supabase-js',
      '@tensorflow/tfjs',
      '@tensorflow-models/toxicity',
    ],
    exclude: ['ffl.js'],
  },
  appType: 'spa',
});
