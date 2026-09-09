/**
 * МАНИФЕСТ — то, чем тетрадь представляется системе при установке.
 *
 * Он собирается, а не лежит файлом, по одной причине: `start_url` и `scope`
 * зависят от префикса сайта, а тот на GitHub Pages не корень. Файл пришлось
 * бы править руками при каждом переезде, и однажды его бы забыли —
 * установленное приложение открывалось бы на 404, а заметили бы это нескоро.
 *
 * Значки — PNG: SVG в манифесте понимает не всякая система, а TWA требует
 * растр прямо. Они рисуются из `icona.svg` при сборке, поэтому источник
 * правды всё равно один.
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const base = import.meta.env.BASE_URL;

  const манифест = {
    name: 'Тетрадь по кибернетике',
    short_name: 'Кибернетика',
    description:
      'Курс по кибернетике с приборами, которые крутятся руками. Работает без сети; прогресс хранится на устройстве.',
    id: base,
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait-primary',
    lang: 'ru',
    dir: 'ltr',
    background_color: '#f3efe4',
    theme_color: '#f3efe4',
    categories: ['education', 'science'],
    icons: [
      { src: `${base}icona-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icona-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icona-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}icona.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Повторение', url: `${base}ripasso/`, description: 'Витки, чей срок повторения настал' },
    ],
  };

  return new Response(JSON.stringify(манифест, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};
