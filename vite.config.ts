import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

const isLandingBuild = process.env.BUILD_TARGET === 'landing';

export default defineConfig({
  plugins: [
    react(),
    ...(isLandingBuild
      ? [
          {
            name: 'create-nojekyll',
            writeBundle() {
              fs.writeFileSync('docs/.nojekyll', '');
              if (fs.existsSync('CNAME')) {
                fs.copyFileSync('CNAME', 'docs/CNAME');
              }
              const indexContent = fs.readFileSync('docs/index.html', 'utf-8');
              fs.writeFileSync('docs/404.html', indexContent);
            },
          },
        ]
      : []),
  ],
  base: './',
  build: {
    outDir: isLandingBuild ? 'docs' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: isLandingBuild ? 'landing.html' : 'index.html',
      },
    },
  },
});
