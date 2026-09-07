import { describe, expect, it } from 'vitest';
import { s, type Infer } from './schema';

describe('schema primitives', () => {
  it('accepts a well-formed string and rejects the wrong type', () => {
    expect(s.string().parse('hello')).toEqual({ ok: true, value: 'hello' });
    const bad = s.string().parse(42);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]).toMatchObject({ code: 'type', path: '' });
  });

  it('enforces string length and pattern constraints', () => {
    expect(s.string({ min: 3 }).parse('ab').ok).toBe(false);
    expect(s.string({ max: 2 }).parse('abc').ok).toBe(false);
    expect(s.string({ pattern: /^[a-z-]+$/ }).parse('Ok!').ok).toBe(false);
    expect(s.string({ min: 1, pattern: /^[a-z-]+$/ }).parse('feedback-loop').ok).toBe(true);
  });

  it('validates numbers with range and integer constraints', () => {
    expect(s.number().parse(1.5).ok).toBe(true);
    expect(s.number({ int: true }).parse(1.5).ok).toBe(false);
    expect(s.number({ min: 0, max: 1 }).parse(1.2).ok).toBe(false);
    expect(s.number().parse(Number.NaN).ok).toBe(false);
    expect(s.number().parse('3').ok).toBe(false);
  });

  it('validates booleans, literals and enums', () => {
    expect(s.boolean().parse(false).ok).toBe(true);
    expect(s.literal('a').parse('a').ok).toBe(true);
    expect(s.literal('a').parse('b').ok).toBe(false);
    const kind = s.enum(['prereq', 'seeAlso'] as const);
    expect(kind.parse('prereq').ok).toBe(true);
    const bad = kind.parse('nope');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].message).toContain('prereq');
  });
});

describe('schema composites', () => {
  const point = s.object({ x: s.number(), y: s.number() });

  it('parses nested objects and reports the failing path', () => {
    const shape = s.object({ name: s.string(), at: point });
    const bad = shape.parse({ name: 'p', at: { x: 1, y: 'nope' } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].path).toBe('at.y');
  });

  it('rejects unknown keys so typos in content are caught early', () => {
    const bad = point.parse({ x: 1, y: 2, z: 3 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].code).toBe('unknown_key');
  });

  it('supports optional fields and defaults', () => {
    const shape = s.object({ a: s.optional(s.string()), b: s.withDefault(s.number(), 7) });
    const res = shape.parse({});
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual({ b: 7 });
  });

  it('validates arrays with element paths and size bounds', () => {
    const list = s.array(s.number(), { min: 1 });
    expect(list.parse([]).ok).toBe(false);
    const bad = list.parse([1, 'x']);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].path).toBe('[1]');
  });

  it('validates records keyed by string', () => {
    const rec = s.record(s.number());
    expect(rec.parse({ a: 1, b: 2 }).ok).toBe(true);
    const bad = rec.parse({ a: 'x' });
    if (!bad.ok) expect(bad.errors[0].path).toBe('a');
  });

  it('picks the first matching branch of a union', () => {
    const u = s.union([s.number(), s.string()]);
    expect(u.parse(4).ok).toBe(true);
    expect(u.parse('four').ok).toBe(true);
    expect(u.parse(true).ok).toBe(false);
  });

  it('runs custom refinements after the base check', () => {
    const even = s.refine(s.number({ int: true }), (n) => (n % 2 === 0 ? null : 'must be even'));
    expect(even.parse(4).ok).toBe(true);
    const bad = even.parse(5);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0].message).toBe('must be even');
  });

  it('collects every error in an object rather than stopping at the first', () => {
    const shape = s.object({ a: s.string(), b: s.number() });
    const bad = shape.parse({ a: 1, b: 'x' });
    if (!bad.ok) expect(bad.errors).toHaveLength(2);
  });

  it('infers static types from a schema', () => {
    const shape = s.object({ title: s.string(), n: s.optional(s.number()) });
    const value: Infer<typeof shape> = { title: 'x' };
    expect(value.title).toBe('x');
  });

  it('exposes a human-readable description for authoring tools', () => {
    expect(s.object({ x: s.number() }).describe()).toContain('x');
    expect(s.array(s.string()).describe()).toBe('string[]');
  });
});
