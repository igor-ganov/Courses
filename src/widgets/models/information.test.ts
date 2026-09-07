import { describe, expect, it } from 'vitest';
import {
  bitErrorRate,
  channelCapacity,
  decodeRepetition,
  encodeRepetition,
  entropy,
  huffmanLengths,
  idealCodeLength,
  maxEntropy,
  meanCodeLength,
  normalize,
  parityBit,
  redundancy,
  transmit,
} from './information';

describe('entropy', () => {
  it('is zero when the outcome is certain', () => {
    expect(entropy([1, 0, 0])).toBe(0);
  });

  it('is one bit for a fair coin and two for a fair four-sided die', () => {
    expect(entropy([0.5, 0.5])).toBeCloseTo(1);
    expect(entropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2);
  });

  it('matches the textbook value for a skewed distribution', () => {
    expect(entropy([0.5, 0.25, 0.25])).toBeCloseTo(1.5);
  });

  it('is maximised by the uniform distribution', () => {
    expect(entropy([0.4, 0.3, 0.2, 0.1])).toBeLessThan(entropy([0.25, 0.25, 0.25, 0.25]));
    expect(maxEntropy(8)).toBe(3);
  });

  it('ignores zero-probability outcomes rather than producing NaN', () => {
    expect(Number.isFinite(entropy([0.5, 0.5, 0]))).toBe(true);
  });

  it('normalises arbitrary weights into a distribution', () => {
    const probs = normalize([1, 1, 2]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(probs[2]).toBeCloseTo(0.5);
  });

  it('falls back to a uniform distribution when all weights are zero', () => {
    expect(normalize([0, 0])).toEqual([0.5, 0.5]);
  });

  it('reports redundancy as the unused share of the channel', () => {
    expect(redundancy([0.5, 0.5])).toBeCloseTo(0);
    expect(redundancy([0.99, 0.01])).toBeGreaterThan(0.9);
  });

  it('gives the ideal code length of a symbol as its surprise', () => {
    expect(idealCodeLength(0.25)).toBeCloseTo(2);
    expect(idealCodeLength(1)).toBeCloseTo(0);
  });
});

describe('huffman coding', () => {
  it('assigns shorter codes to more likely symbols', () => {
    const lengths = huffmanLengths([0.5, 0.25, 0.25]);
    expect(lengths).toEqual([1, 2, 2]);
  });

  it('never beats the Shannon bound but stays within one bit of it', () => {
    const probs = normalize([7, 5, 3, 2, 1]);
    const average = meanCodeLength(probs, huffmanLengths(probs));
    expect(average).toBeGreaterThanOrEqual(entropy(probs) - 1e-9);
    expect(average).toBeLessThan(entropy(probs) + 1);
  });

  it('handles the degenerate single-symbol alphabet', () => {
    expect(huffmanLengths([1])).toEqual([1]);
  });
});

describe('noisy channel', () => {
  it('capacity is one bit for a clean channel and zero at maximum confusion', () => {
    expect(channelCapacity(0)).toBeCloseTo(1);
    expect(channelCapacity(0.5)).toBeCloseTo(0);
    expect(channelCapacity(1)).toBeCloseTo(1);
  });

  it('flips roughly the requested share of bits, reproducibly', () => {
    const bits = Array.from({ length: 2000 }, () => 0);
    const a = transmit(bits, 0.1, 42);
    const b = transmit(bits, 0.1, 42);
    expect(a).toEqual(b);
    expect(bitErrorRate(bits, a)).toBeGreaterThan(0.06);
    expect(bitErrorRate(bits, a)).toBeLessThan(0.14);
  });

  it('leaves the message alone on a clean channel', () => {
    const bits = [1, 0, 1, 1];
    expect(transmit(bits, 0, 1)).toEqual(bits);
  });
});

describe('redundancy as error correction', () => {
  it('repetition coding recovers a single flipped bit', () => {
    const message = [1, 0, 1];
    const encoded = encodeRepetition(message, 3);
    expect(encoded).toHaveLength(9);
    encoded[1] = encoded[1] === 1 ? 0 : 1;
    expect(decodeRepetition(encoded, 3)).toEqual(message);
  });

  it('repetition coding fails when the majority itself is corrupted', () => {
    const encoded = encodeRepetition([1], 3);
    encoded[0] = 0;
    encoded[1] = 0;
    expect(decodeRepetition(encoded, 3)).toEqual([0]);
  });

  it('a parity bit detects an odd number of errors', () => {
    expect(parityBit([1, 0, 1])).toBe(0);
    expect(parityBit([1, 1, 1])).toBe(1);
  });
});
