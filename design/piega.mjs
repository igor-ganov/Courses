/* Печатает карту прогиба — design/piega.png.
 *
 * Прогиб делается не тенью, а смещением самих пикселей страницы:
 * SVG-фильтр feDisplacementMap двигает то, что нарисовано, — буквы, линейки,
 * клетку, зерно. Двигает он на вектор, взятый из этой картинки: красный
 * канал — смещение по горизонтали, зелёный — по вертикали, 128 значит ноль.
 *
 * Поле берётся не круглое. Лист под пальцем ведёт себя как защемлённая по
 * краям пластина: прогиб идёт на всю ширину и спадает к краям, но бумага
 * неоднородна — вдоль волокон она жёстче, поэтому пятно вытянуто, а граница
 * прогиба рваная. Смещение пропорционально наклону поверхности, то есть
 * градиенту прогиба: там, где лист круче всего уходит вниз, картинка едет
 * сильнее всего, а на дне и по краям — почти стоит.
 *
 *   node design/piega.mjs
 */

import { writeFileSync } from 'node:fs';
import { png } from './png.mjs';

const N = 128;

const hash = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const noise = (x, y) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  const top = a + (b - a) * ux;
  return top + (c + (d - c) * ux - top) * uy;
};

/* Прогиб в точке (u, v), где центр нажатия — начало координат,
   а единица — половина ширины карты. */
const prof = (u, v) => {
  // Поперёк волокон лист проседает шире: пятно вытянуто, а не круг.
  const x = u;
  const y = v * 1.34;
  const r = Math.hypot(x, y);
  if (r > 1.4) return 0;
  const angolo = Math.atan2(y, x);
  // Рваная граница: радиус гуляет по углу, поэтому линия схода неровная.
  const R = 0.72 + 0.42 * noise(Math.cos(angolo) * 2.4 + 9, Math.sin(angolo) * 2.4 + 4);
  const t = Math.max(0, Math.min(1, 1 - r / R));
  const gladko = t * t * (3 - 2 * t);
  // Неровность самого прогиба: бумага мнётся не гладким колоколом.
  return gladko * (0.82 + 0.34 * noise(u * 3.6 + 21, v * 3.6 + 13));
};

const passo = 2 / N;
const grad = [];
let picco = 1e-6;
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1;
    const v = (j / (N - 1)) * 2 - 1;
    const gx = (prof(u + passo, v) - prof(u - passo, v)) / (2 * passo);
    const gy = (prof(u, v + passo) - prof(u, v - passo)) / (2 * passo);
    grad.push(gx, gy);
    picco = Math.max(picco, Math.abs(gx), Math.abs(gy));
  }
}

/* Знак. feDisplacementMap читает карту наоборот: пиксель результата берётся
   из точки источника, сдвинутой на вектор карты. Чтобы напечатанное съезжало
   к самой глубокой точке — как бумагу тянет к пальцу, — брать надо снаружи,
   то есть вектор смотрит от центра: это минус градиент прогиба. */
const данные = png(N, N, (x, y) => {
  const k = (y * N + x) * 2;
  const gx = -grad[k] / picco;
  const gy = -grad[k + 1] / picco;
  return [
    Math.round(128 + 127 * gx),
    Math.round(128 + 127 * gy),
    128,
  ];
});

writeFileSync('design/piega.png', данные);
console.log('design/piega.png', Math.round(данные.length / 1024) + ' КБ');
