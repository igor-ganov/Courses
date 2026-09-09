import { describe, expect, it } from 'vitest';
import * as s from '~/core/schema';
import { blockDefinitions, blockKinds, blocks, renderBlocks, type Block } from '~/content/registry';
import './index';
import { ESEMPI } from './esempi';

describe('примеры блоков', () => {
  it('есть на каждый зарегистрированный вид — и ни на один лишний', () => {
    expect(Object.keys(ESEMPI).sort()).toEqual(blockKinds().sort());
  });

  it('каждый пример проходит схему своего вида', () => {
    for (const определение of blockDefinitions()) {
      const пример = ESEMPI[определение.kind]!;
      const r = определение.schema.check(пример, определение.kind);
      expect(r.ok ? [] : r.issues, определение.kind).toEqual([]);
    }
  });

  it('пример помечен своим видом и проходит общую схему блока', () => {
    const схема = blocks();
    for (const [kind, пример] of Object.entries(ESEMPI)) {
      expect(пример.kind).toBe(kind);
      expect(() => s.parse(схема, пример, kind), kind).not.toThrow();
    }
  });

  it('галерея рисуется целиком и без потерь', () => {
    const html = renderBlocks(Object.values(ESEMPI) as Block[], { base: '/', course: 'cibernetica' }, 'галерея');
    /* Ни один вид не должен превратиться в карточку беды. */
    expect(html).not.toContain('class="guasto"');
    /* Каждый прибор стоит на странице своим элементом. */
    for (const о of blockDefinitions()) if (о.tag) expect(html).toContain(`<${о.tag} class="isola"`);
  });
});
