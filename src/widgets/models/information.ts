/**
 * Shannon's side of cybernetics: uncertainty, codes, channels and redundancy.
 *
 * The course uses these to make one point concrete — information is a measure of
 * *how surprised you are*, and a regulator's job is to spend variety in order to
 * absorb it. Every function here is pure so the widgets can recompute live while
 * the learner drags a probability bar.
 */

export type Bit = 0 | 1;

const LOG2 = Math.log(2);
const log2 = (x: number) => Math.log(x) / LOG2;

/** Turn arbitrary non-negative weights into a probability distribution. */
export function normalize(weights: readonly number[]): number[] {
  const safe = weights.map((w) => Math.max(0, w));
  const total = safe.reduce((a, b) => a + b, 0);
  if (total === 0) return safe.map(() => 1 / safe.length);
  return safe.map((w) => w / total);
}

/** Shannon entropy in bits. Zero-probability outcomes contribute nothing. */
export function entropy(probs: readonly number[]): number {
  let sum = 0;
  for (const p of probs) if (p > 0) sum -= p * log2(p);
  return sum;
}

export function maxEntropy(alphabetSize: number): number {
  return alphabetSize > 0 ? log2(alphabetSize) : 0;
}

/** How many bits an ideal code would spend on a symbol of this probability. */
export function idealCodeLength(p: number): number {
  return p > 0 ? -log2(p) : Infinity;
}

/** 1 − H/H_max: the share of the channel that carries no news. */
export function redundancy(probs: readonly number[]): number {
  const max = maxEntropy(probs.length);
  if (max === 0) return 0;
  return 1 - entropy(probs) / max;
}

/**
 * Huffman code lengths, in the input's order. We only need the lengths — the
 * widget draws bars, not bit strings — which keeps this to a simple merge loop.
 */
export function huffmanLengths(probs: readonly number[]): number[] {
  if (probs.length === 0) return [];
  if (probs.length === 1) return [1];

  interface Node {
    weight: number;
    leaves: number[];
  }
  let nodes: Node[] = probs.map((weight, index) => ({ weight, leaves: [index] }));
  const lengths = new Array(probs.length).fill(0);

  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight);
    const [first, second] = nodes.splice(0, 2);
    for (const leaf of [...first.leaves, ...second.leaves]) lengths[leaf] += 1;
    nodes.push({ weight: first.weight + second.weight, leaves: [...first.leaves, ...second.leaves] });
  }
  return lengths;
}

export function meanCodeLength(probs: readonly number[], lengths: readonly number[]): number {
  return probs.reduce((sum, p, index) => sum + p * (lengths[index] ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Binary symmetric channel
// ---------------------------------------------------------------------------

/** Capacity of a binary symmetric channel with bit-flip probability p. */
export function channelCapacity(p: number): number {
  const clamped = Math.min(1, Math.max(0, p));
  return 1 - entropy([clamped, 1 - clamped]);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Push bits through a noisy channel; seeded so a demo can be replayed. */
export function transmit(bits: readonly Bit[] | readonly number[], flipProbability: number, seed = 1): Bit[] {
  const rand = mulberry32(seed);
  return [...bits].map((bit) => {
    const value = (bit ? 1 : 0) as Bit;
    return (rand() < flipProbability ? (value ^ 1) : value) as Bit;
  });
}

export function bitErrorRate(sent: readonly number[], received: readonly number[]): number {
  if (sent.length === 0) return 0;
  let errors = 0;
  for (let i = 0; i < sent.length; i += 1) if (sent[i] !== received[i]) errors += 1;
  return errors / sent.length;
}

/** The bluntest possible error-correcting code: say everything n times. */
export function encodeRepetition(bits: readonly number[], times: number): Bit[] {
  const out: Bit[] = [];
  for (const bit of bits) for (let i = 0; i < times; i += 1) out.push((bit ? 1 : 0) as Bit);
  return out;
}

/** Majority vote over each group of n. */
export function decodeRepetition(bits: readonly number[], times: number): Bit[] {
  const out: Bit[] = [];
  for (let i = 0; i < bits.length; i += times) {
    const group = bits.slice(i, i + times);
    const ones = group.reduce((sum, b) => sum + (b ? 1 : 0), 0);
    out.push((ones * 2 > group.length ? 1 : 0) as Bit);
  }
  return out;
}

/** Even parity: the bit that makes the number of ones even. */
export function parityBit(bits: readonly number[]): Bit {
  return (bits.reduce((sum, b) => sum + (b ? 1 : 0), 0) % 2) as Bit;
}
