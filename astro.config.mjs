// @ts-check
import { defineConfig } from 'astro/config';
import lit from '@astrojs/lit';

/* Платформа офлайн-первая, поэтому сборка статическая: ни одного обращения к
   сети во время работы. Lit — для интерактива; всё, что не интерактив, остаётся
   разметкой и не платит за гидратацию.

   base нужен из-за GitHub Pages: сайт живёт в подкаталоге /Courses/. */
export default defineConfig({
  site: 'https://igor-ganov.github.io',
  base: process.env.PAGES_BASE ?? '/',
  output: 'static',
  integrations: [lit()],
  build: { inlineStylesheets: 'auto' },
  vite: {
    resolve: {
      alias: { '~': new URL('./src', import.meta.url).pathname },
    },
  },
});
