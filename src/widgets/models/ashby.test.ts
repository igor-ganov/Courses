import { describe, expect, it } from 'vitest';
import {
  BLACK_BOXES,
  canRegulate,
  createBox,
  evaluateAssignment,
  identifyBox,
  latinSquareOutcomes,
  minimumOutcomeVariety,
  probeSequence,
  varietyBits,
  varietyOf,
} from './ashby';

describe('variety', () => {
  it('counts distinct states, not occurrences', () => {
    expect(varietyOf(['a', 'b', 'a'])).toBe(2);
    expect(varietyOf([])).toBe(0);
  });

  it('measures variety in bits as the log of the state count', () => {
    expect(varietyBits(8)).toBeCloseTo(3);
    expect(varietyBits(1)).toBe(0);
    expect(varietyBits(0)).toBe(0);
  });
});

describe("Ashby's law of requisite variety", () => {
  // A Latin square is the hardest honest game: every disturbance needs its own
  // distinct response, so the regulator must match the environment exactly.
  const outcomes = (d: number, r: number) => latinSquareOutcomes(d, r);

  it('lets the regulator win when it has at least as many responses', () => {
    expect(canRegulate(outcomes(4, 4), 0)).toBe(true);
  });

  it('makes winning impossible when the regulator is outmatched', () => {
    expect(canRegulate(outcomes(4, 3), 0)).toBe(false);
    expect(canRegulate(outcomes(4, 1), 0)).toBe(false);
  });

  it('computes the residual variety only variety can destroy', () => {
    // log2(D) - log2(R), floored at zero: what the regulator cannot absorb.
    expect(minimumOutcomeVariety(8, 2)).toBeCloseTo(2);
    expect(minimumOutcomeVariety(8, 8)).toBe(0);
    expect(minimumOutcomeVariety(2, 8)).toBe(0);
  });

  it('scores a player assignment of responses to disturbances', () => {
    const table = outcomes(3, 3);
    const perfect = evaluateAssignment(table, [0, 1, 2], 0);
    expect(perfect.held).toBe(3);
    expect(perfect.score).toBe(1);
    expect(perfect.survived).toBe(true);

    const sloppy = evaluateAssignment(table, [0, 0, 0], 0);
    expect(sloppy.held).toBe(1);
    expect(sloppy.score).toBeCloseTo(1 / 3);
    expect(sloppy.survived).toBe(false);
  });

  it('treats a missing choice as a failed disturbance', () => {
    const result = evaluateAssignment(outcomes(3, 3), [0, null, 2], 0);
    expect(result.held).toBe(2);
    expect(result.failures).toEqual([1]);
  });
});

describe('the black box', () => {
  it('ships several boxes with distinct behaviour', () => {
    expect(BLACK_BOXES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(BLACK_BOXES.map((b) => b.id)).size).toBe(BLACK_BOXES.length);
  });

  it('a memoryless box gives the same answer to the same input', () => {
    const box = createBox('inverter');
    expect(box.step(0)).toBe(1);
    expect(box.step(1)).toBe(0);
    expect(box.step(0)).toBe(1);
  });

  it('a box with state can answer differently to the same input', () => {
    const box = createBox('toggle');
    const first = box.step(1);
    const second = box.step(1);
    expect(first).not.toBe(second);
  });

  it('the delay box repeats what it was told one step ago', () => {
    expect(probeSequence('delay', [1, 0, 0, 1])).toEqual([0, 1, 0, 0]);
  });

  it('the counter box fires every third pulse', () => {
    expect(probeSequence('counter3', [1, 1, 1, 1, 1, 1])).toEqual([0, 0, 1, 0, 0, 1]);
  });

  it('resetting returns a box to its initial state', () => {
    const box = createBox('toggle');
    box.step(1);
    box.reset();
    expect(box.step(1)).toBe(createBox('toggle').step(1));
  });

  it('identifies which boxes are still consistent with what was observed', () => {
    const observations = [
      { input: 1 as const, output: 0 as const },
      { input: 0 as const, output: 1 as const },
    ];
    const candidates = identifyBox(observations);
    expect(candidates).toContain('inverter');
    expect(candidates).not.toContain('identity');
  });

  it('narrows to a single candidate once the probing is thorough', () => {
    const inputs = [1, 1, 1, 0, 1, 1] as const;
    const outputs = probeSequence('counter3', [...inputs]);
    const observations = inputs.map((input, i) => ({ input, output: outputs[i] }));
    expect(identifyBox(observations)).toEqual(['counter3']);
  });

  it('returns no candidates for behaviour no box can produce', () => {
    expect(identifyBox([{ input: 0, output: 1 }, { input: 0, output: 1 }, { input: 0, output: 0 }])).toEqual([]);
  });
});
