import { describe, expect, it } from 'vitest';
import {
  averageLength,
  bitsOf,
  channelCapacity,
  entropy,
  hammingDecode,
  hammingEncode,
  huffman,
  maxEntropy,
  noisyChannel,
  redundancy,
  toProbabilities,
} from './informazione';

/* Числа здесь считаются по определению. Виджет, который показывает «примерно
   энтропию», учит примерно неправде: читатель запомнит именно это число. */

describe('энтропия', () => {
  it('честная монета — ровно бит, четыре равных исхода — ровно два', () => {
    expect(entropy([0.5, 0.5])).toBe(1);
    expect(entropy([0.25, 0.25, 0.25, 0.25])).toBe(2);
  });

  it('определённость — ноль бит: сообщение, которое известно заранее, ничего не сообщает', () => {
    expect(entropy([1])).toBe(0);
    expect(entropy([1, 0])).toBe(0);
  });

  it('перекос уменьшает энтропию и растит избыточность', () => {
    const ровно = entropy([0.5, 0.5]);
    const косо = entropy([0.9, 0.1]);
    expect(косо).toBeLessThan(ровно);
    expect(косо).toBeCloseTo(0.469, 3);
    expect(redundancy([0.9, 0.1])).toBeCloseTo(0.531, 3);
  });

  it('равномерное распределение — максимум, и это log₂n', () => {
    expect(maxEntropy(8)).toBe(3);
    expect(entropy(toProbabilities([1, 1, 1, 1, 1, 1, 1, 1]))).toBeCloseTo(3, 12);
  });

  it('нормировка отбрасывает нули и делит на сумму', () => {
    expect(toProbabilities([2, 0, 2])).toEqual([0.5, 0.5]);
    expect(toProbabilities([0, 0])).toEqual([]);
  });
});

describe('код Хаффмана', () => {
  const набор = [
    { symbol: 'а', weight: 45 },
    { symbol: 'б', weight: 13 },
    { symbol: 'в', weight: 12 },
    { symbol: 'г', weight: 16 },
    { symbol: 'д', weight: 9 },
    { symbol: 'е', weight: 5 },
  ];

  it('частому символу — короткий код, редкому — длинный', () => {
    const код = huffman(набор);
    const по = new Map(код.map((c) => [c.symbol, c.code.length]));
    expect(по.get('а')!).toBeLessThan(по.get('е')!);
    expect(по.get('а')).toBe(1);
  });

  it('ни один код не является началом другого — иначе поток не разобрать', () => {
    const коды = huffman(набор).map((c) => c.code);
    for (const a of коды) {
      for (const b of коды) {
        if (a !== b) expect(b.startsWith(a)).toBe(false);
      }
    }
  });

  it('средняя длина лежит между энтропией и энтропией плюс бит — теорема Шеннона', () => {
    const код = huffman(набор);
    const H = entropy(код.map((c) => c.probability));
    const L = averageLength(код);
    expect(L).toBeGreaterThanOrEqual(H - 1e-12);
    expect(L).toBeLessThan(H + 1);
  });

  it('одинаковый набор даёт одинаковый код: задание должно быть разрешимым', () => {
    expect(huffman(набор)).toEqual(huffman([...набор]));
  });

  it('вырожденные случаи не роняют', () => {
    expect(huffman([])).toEqual([]);
    expect(huffman([{ symbol: 'а', weight: 3 }])).toEqual([
      { symbol: 'а', probability: 1, code: '0' },
    ]);
  });
});

describe('канал с шумом', () => {
  it('без шума ничего не меняет, при p=1 переворачивает всё', () => {
    const биты = [1, 0, 1, 1, 0];
    expect(noisyChannel(биты, 0, 1)).toEqual(биты);
    expect(noisyChannel(биты, 1, 1)).toEqual([0, 1, 0, 0, 1]);
  });

  it('доля перевёрнутых бит близка к заданной вероятности', () => {
    const биты = Array.from({ length: 20000 }, () => 0);
    const вышло = noisyChannel(биты, 0.1, 42);
    const доля = вышло.reduce((a, b) => a + b, 0) / биты.length;
    expect(доля).toBeGreaterThan(0.09);
    expect(доля).toBeLessThan(0.11);
  });

  it('одно зерно — один и тот же шум', () => {
    const биты = bitsOf('связь');
    expect(noisyChannel(биты, 0.2, 5)).toEqual(noisyChannel(биты, 0.2, 5));
    expect(noisyChannel(биты, 0.2, 5)).not.toEqual(noisyChannel(биты, 0.2, 6));
  });

  it('пропускная способность падает до нуля при p=1/2 — канал перестаёт что-либо передавать', () => {
    expect(channelCapacity(0)).toBe(1);
    expect(channelCapacity(0.5)).toBe(0);
    expect(channelCapacity(0.11)).toBeCloseTo(0.5, 2);
  });
});

describe('код Хэмминга', () => {
  it('семь бит из четырёх, и данные читаются обратно', () => {
    for (const d of [
      [0, 0, 0, 0],
      [1, 0, 1, 1],
      [1, 1, 1, 1],
      [0, 1, 0, 1],
    ]) {
      const слово = hammingEncode(d);
      expect(слово).toHaveLength(7);
      const назад = hammingDecode(слово);
      expect(назад.data).toEqual(d);
      expect(назад.errorAt).toBe(0);
    }
  });

  it('одна ошибка в любой позиции находится и исправляется', () => {
    const d = [1, 0, 1, 1];
    const слово = hammingEncode(d);
    for (let i = 0; i < 7; i += 1) {
      const битое = [...слово];
      битое[i] = битое[i]! ^ 1;
      const назад = hammingDecode(битое);
      expect(назад.errorAt, `позиция ${i + 1}`).toBe(i + 1);
      expect(назад.corrected).toBe(true);
      expect(назад.data, `позиция ${i + 1}`).toEqual(d);
    }
  });

  it('две ошибки исправить нельзя — и это цена, а не недоработка', () => {
    const d = [1, 0, 1, 1];
    const слово = hammingEncode(d);
    const битое = [...слово];
    битое[0] = битое[0]! ^ 1;
    битое[1] = битое[1]! ^ 1;
    expect(hammingDecode(битое).data).not.toEqual(d);
  });
});

describe('текст в биты', () => {
  it('восемь бит на знак, старший первым', () => {
    expect(bitsOf('A')).toEqual([0, 1, 0, 0, 0, 0, 0, 1]);
    expect(bitsOf('AB')).toHaveLength(16);
  });
});
