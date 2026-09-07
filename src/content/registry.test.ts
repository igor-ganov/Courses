import { describe, expect, it } from 'vitest';
import { s } from '@/core/schema';
import { BlockRegistry, defineBlock } from './registry';
import type { BlockNode } from './model';

const prose = defineBlock({
  type: 'prose',
  category: 'text',
  label: 'Текст',
  schema: s.object({ text: s.string({ min: 1 }) }),
  component: () => null,
  cost: 1,
});

const sim = defineBlock({
  type: 'sim.demo',
  category: 'simulation',
  label: 'Демо-симуляция',
  schema: s.object({ gain: s.withDefault(s.number(), 1) }),
  component: () => null,
  scorable: true,
  cost: (props) => (props.gain > 5 ? 6 : 3),
});

const makeRegistry = () => {
  const registry = new BlockRegistry();
  registry.register(prose);
  registry.register(sim);
  return registry;
};

describe('BlockRegistry', () => {
  it('registers and looks up block definitions', () => {
    const registry = makeRegistry();
    expect(registry.has('prose')).toBe(true);
    expect(registry.get('sim.demo')?.category).toBe('simulation');
    expect(registry.list().map((d) => d.type).sort()).toEqual(['prose', 'sim.demo']);
  });

  it('refuses to silently shadow an existing type', () => {
    const registry = makeRegistry();
    expect(() => registry.register(prose)).toThrow(/already registered/i);
    expect(() => registry.register({ ...prose, label: 'other' }, { override: true })).not.toThrow();
    expect(registry.get('prose')?.label).toBe('other');
  });

  it('lists definitions by category for authoring tools', () => {
    const registry = makeRegistry();
    expect(registry.byCategory('simulation').map((d) => d.type)).toEqual(['sim.demo']);
  });

  it('parses a node, applying schema defaults', () => {
    const registry = makeRegistry();
    const res = registry.parse({ id: 'b1', type: 'sim.demo' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.props).toEqual({ gain: 1 });
  });

  it('reports an unknown block type instead of throwing', () => {
    const registry = makeRegistry();
    const res = registry.parse({ id: 'b1', type: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].message).toMatch(/unknown block type "nope"/);
  });

  it('reports prop errors with the block id in the path', () => {
    const registry = makeRegistry();
    const res = registry.parse({ id: 'intro', type: 'prose', props: { text: '' } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0].path).toBe('intro.text');
  });

  it('validates a whole tree including children', () => {
    const registry = makeRegistry();
    registry.register(
      defineBlock({
        type: 'columns',
        category: 'layout',
        schema: s.object({}),
        component: () => null,
        acceptsChildren: true,
      }),
    );
    const tree: BlockNode[] = [
      {
        id: 'row',
        type: 'columns',
        children: [
          { id: 'a', type: 'prose', props: { text: 'ok' } },
          { id: 'b', type: 'prose', props: { text: 42 } },
        ],
      },
    ];
    const issues = registry.validateTree(tree);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('b.text');
  });

  it('rejects children on a block that does not accept them', () => {
    const registry = makeRegistry();
    const issues = registry.validateTree([
      { id: 'p', type: 'prose', props: { text: 'x' }, children: [{ id: 'q', type: 'prose', props: { text: 'y' } }] },
    ]);
    expect(issues.some((i) => /does not accept children/.test(i.message))).toBe(true);
  });

  it('flags duplicate block ids within a tree', () => {
    const registry = makeRegistry();
    const issues = registry.validateTree([
      { id: 'dup', type: 'prose', props: { text: 'a' } },
      { id: 'dup', type: 'prose', props: { text: 'b' } },
    ]);
    expect(issues.some((i) => /duplicate block id/.test(i.message))).toBe(true);
  });

  it('estimates reading time from static and computed costs', () => {
    const registry = makeRegistry();
    const minutes = registry.estimateMinutes([
      { id: 'a', type: 'prose', props: { text: 'x' } },
      { id: 'b', type: 'sim.demo', props: { gain: 9 } },
    ]);
    expect(minutes).toBe(7);
  });

  it('can be cloned so a test or a plugin sandbox does not mutate the global one', () => {
    const registry = makeRegistry();
    const clone = registry.clone();
    clone.register(defineBlock({ type: 'extra', category: 'text', schema: s.object({}), component: () => null }));
    expect(clone.has('extra')).toBe(true);
    expect(registry.has('extra')).toBe(false);
  });
});
