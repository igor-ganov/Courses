/* Печатает плитку зерна в PNG — на сборке, а не в браузере.
 *
 * Раньше её считал сам materia.js при запуске: полмиллиона синусов и
 * toDataURL, около 60 мс на телефоне и 54 КБ base64 в атрибуте стиля.
 * Картинка при этом всегда одна и та же, поэтому ей место в файле.
 *
 * Шум взят с обёрнутой решёткой (индексы по модулю периода), поэтому стык
 * плитки не виден. Пучки идут в двух направлениях, но слабо: если дать им
 * волю, бумага становится мешковиной — основной тон держит зерно. Само
 * зерно чуть тёплое: нейтрально-серое умножение выпивает из бумаги цвет.
 *
 *   node design/grana.mjs
 */

import { writeFileSync } from 'node:fs';
import { png } from './png.mjs';

const N = 128;
// Сорта отличаются силой пучков в полтора раза — это разница в прозрачности,
// а не в рисунке, поэтому плитка одна на всех и кэшируется между
// направлениями. Печатается по среднему сорту, остальное делает opacity.
const СОРТ = 0.06;

const hash = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const wrapped = (x, y, px, py) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const mod = (n, m) => ((n % m) + m) % m;
  const a = hash(mod(x0, px), mod(y0, py));
  const b = hash(mod(x0 + 1, px), mod(y0, py));
  const c = hash(mod(x0, px), mod(y0 + 1, py));
  const d = hash(mod(x0 + 1, px), mod(y0 + 1, py));
  const top = a + (b - a) * ux;
  return top + (c + (d - c) * ux - top) * uy;
};

const tessuto = (fibre) =>
  png(N, N, (x, y) => {
    const u = x / N;
    const v = y / N;
    const fa = wrapped(u * 5, v * 40, 5, 40);
    const fb = wrapped(u * 36, v * 5, 36, 5);
    const dark = (1 - fa) * fibre * 0.5 + (1 - fb) * fibre * 0.5 + (1 - hash(x, y)) * 0.035;
    const value = Math.round(255 * Math.max(0, 1 - dark));
    // Зерно чуть тёплое: нейтрально-серое умножение выпивает из бумаги цвет.
    return [Math.min(255, value + 4), value, Math.max(0, value - 5)];
  });

const data = tessuto(СОРТ);
writeFileSync('design/grana.png', data);
console.log('design/grana.png', Math.round(data.length / 1024) + ' КБ');
