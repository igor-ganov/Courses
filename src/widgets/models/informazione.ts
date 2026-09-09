/**
 * ИНФОРМАЦИЯ — энтропия, код Хаффмана, канал с шумом и код Хэмминга.
 *
 * Всё считается по определению, а не «примерно»: энтропия — это −Σp·log₂p, и
 * если виджет показывает другое число, читатель запомнит другое число.
 *
 * Здесь же то место курса, где кибернетика смыкается с теорией связи: мера
 * разнообразия у Эшби и мера информации у Шеннона — это один и тот же логарифм,
 * и увидеть это можно только на общих числах.
 */

/* ── энтропия ───────────────────────────────────────────────────────── */

/** Нормировать частоты в вероятности, отбросив нули. */
export function toProbabilities(weights: readonly number[]): number[] {
  const positive = weights.filter((w) => w > 0);
  const total = positive.reduce((a, b) => a + b, 0);
  return total > 0 ? positive.map((w) => w / total) : [];
}

/** H = −Σ p·log₂p, в битах. Нулевая вероятность вклада не даёт: 0·log0 = 0. */
export function entropy(probabilities: readonly number[]): number {
  /* Прибавленный ноль убирает минус-ноль: у определённости энтропия нулевая, а
     не «минус нулевая», и на экране это должно быть видно именно так. */
  return -probabilities.reduce((sum, p) => (p > 0 ? sum + p * Math.log2(p) : sum), 0) + 0;
}

/** Максимум энтропии для n исходов: равномерное распределение, log₂n. */
export const maxEntropy = (n: number): number => (n > 0 ? Math.log2(n) : 0);

/** Избыточность: насколько распределение не дотягивает до равномерного. */
export function redundancy(probabilities: readonly number[]): number {
  const max = maxEntropy(probabilities.length);
  return max > 0 ? 1 - entropy(probabilities) / max : 0;
}

/* ── код Хаффмана ───────────────────────────────────────────────────── */

export interface Symbol_ {
  readonly symbol: string;
  readonly weight: number;
}

export interface CodeWord {
  readonly symbol: string;
  readonly probability: number;
  readonly code: string;
}

interface Node {
  weight: number;
  symbol?: string;
  left?: Node;
  right?: Node;
  /** Номер появления — чтобы порядок при равных весах был определённым. */
  order: number;
}

/**
 * Код Хаффмана. Порядок при равных весах зафиксирован, иначе один и тот же
 * набор даёт разные (одинаково хорошие, но разные) коды — и задание с ответом
 * «какой код у буквы А» становится неразрешимым.
 */
export function huffman(symbols: readonly Symbol_[]): CodeWord[] {
  const positive = symbols.filter((s) => s.weight > 0);
  if (positive.length === 0) return [];
  const total = positive.reduce((a, b) => a + b.weight, 0);

  if (positive.length === 1) {
    return [{ symbol: positive[0]!.symbol, probability: 1, code: '0' }];
  }

  let counter = 0;
  const heap: Node[] = positive.map((s) => ({
    weight: s.weight,
    symbol: s.symbol,
    order: counter++,
  }));

  const takeSmallest = (): Node => {
    let best = 0;
    for (let i = 1; i < heap.length; i += 1) {
      const a = heap[i]!;
      const b = heap[best]!;
      if (a.weight < b.weight || (a.weight === b.weight && a.order < b.order)) best = i;
    }
    return heap.splice(best, 1)[0]!;
  };

  while (heap.length > 1) {
    const left = takeSmallest();
    const right = takeSmallest();
    heap.push({ weight: left.weight + right.weight, left, right, order: counter++ });
  }

  const out: CodeWord[] = [];
  const walk = (node: Node, code: string): void => {
    if (node.symbol !== undefined) {
      out.push({ symbol: node.symbol, probability: node.weight / total, code });
      return;
    }
    if (node.left) walk(node.left, `${code}0`);
    if (node.right) walk(node.right, `${code}1`);
  };
  walk(heap[0]!, '');
  return out.sort((a, b) => b.probability - a.probability || a.symbol.localeCompare(b.symbol));
}

/** Средняя длина кодового слова в битах на символ. */
export const averageLength = (code: readonly CodeWord[]): number =>
  code.reduce((sum, c) => sum + c.probability * c.code.length, 0);

/* ── канал с шумом ──────────────────────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Двоичный симметричный канал: каждый бит переворачивается с вероятностью p. */
export function noisyChannel(bits: readonly number[], p: number, seed: number): number[] {
  const rnd = mulberry32(seed);
  return bits.map((b) => (rnd() < p ? (b ^ 1) : b));
}

/** Пропускная способность двоичного симметричного канала: 1 − H(p). */
export const channelCapacity = (p: number): number =>
  p <= 0 || p >= 1 ? 1 : 1 - entropy([p, 1 - p]);

/* ── код Хэмминга (7,4) ─────────────────────────────────────────────── */

/**
 * Четыре бита данных превращаются в семь: три проверочных позволяют найти и
 * исправить одну ошибку. Это самый короткий способ показать, что избыточность
 * — не потеря, а плата за возможность заметить искажение.
 *
 * Позиции 1,2,4 — проверочные, 3,5,6,7 — данные (нумерация с единицы).
 */
export function hammingEncode(data: readonly number[]): number[] {
  const d = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
  const p1 = d[0]! ^ d[1]! ^ d[3]!;
  const p2 = d[0]! ^ d[2]! ^ d[3]!;
  const p3 = d[1]! ^ d[2]! ^ d[3]!;
  return [p1, p2, d[0]!, p3, d[1]!, d[2]!, d[3]!];
}

export interface HammingResult {
  readonly data: number[];
  /** Позиция найденной ошибки, 1…7; ноль — ошибок не найдено. */
  readonly errorAt: number;
  readonly corrected: boolean;
}

export function hammingDecode(word: readonly number[]): HammingResult {
  const w = [0, ...word.slice(0, 7)]; // единичная нумерация
  const s1 = w[1]! ^ w[3]! ^ w[5]! ^ w[7]!;
  const s2 = w[2]! ^ w[3]! ^ w[6]! ^ w[7]!;
  const s4 = w[4]! ^ w[5]! ^ w[6]! ^ w[7]!;
  const syndrome = s1 + s2 * 2 + s4 * 4;
  if (syndrome > 0 && syndrome <= 7) w[syndrome] = w[syndrome]! ^ 1;
  return {
    data: [w[3]!, w[5]!, w[6]!, w[7]!],
    errorAt: syndrome,
    corrected: syndrome > 0,
  };
}

/** Строка бит из текста — для наглядных прогонов по каналу. */
export const bitsOf = (text: string): number[] =>
  [...text].flatMap((ch) => {
    const code = ch.codePointAt(0)!;
    return [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (code >> i) & 1);
  });
