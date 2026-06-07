import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import {
  DISCORD_CHANGELOG_IMAGE_URLS_COMMITTED,
  trimImageUrl,
} from './scripts/discordChangelogImageUrls';
import {
  repoHasGit,
  updateToolDevPlugin,
} from './tools/release/updateToolDevPlugin';

export default defineConfig(({ command }) => {
  const root = __dirname;
  const env = loadEnv('development', root, '');

  const updateDevEnabled = env['update.dev'] === 'true';

  const devPlugins = [];
  if (command === 'serve' && repoHasGit(root) && updateDevEnabled) {
    const img = DISCORD_CHANGELOG_IMAGE_URLS_COMMITTED;
    devPlugins.push(
      updateToolDevPlugin({
        toolToken: env.SHAREMII_UPDATE_TOOL_TOKEN,
        discordWebhookUrl: env.DISCORD_WEBHOOK_URL_CHANGELOG,
        discordChangelogHeaderImageUrl: trimImageUrl(img.headerImageUrl),
        discordChangelogMainEmbedImageUrl: trimImageUrl(img.mainEmbedImageUrl),
        discordChangelogFooterImageUrl: trimImageUrl(img.footerImageUrl),
        discordChangelogEmbedColor: env.DISCORD_CHANGELOG_EMBED_COLOR,
      }),
    );
  }

  return {
  plugins: devPlugins,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@tensorflow')) return 'tensorflow';
          if (id.includes('node_modules/miijs')) return 'miijs';
          if (id.includes('/src/pages/admin/')) return 'admin';
          if (id.includes('/src/pages/Create')) return 'mii-maker';
          if (id.includes('/src/components/MiiMaker/')) return 'mii-maker';
        },
      },
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
  };
});
