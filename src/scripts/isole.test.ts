import { describe, expect, it } from 'vitest';
import '~/blocks';
import { blockDefinitions } from '~/content/registry';
import { ISOLE } from './isole';

/* Единственный сторож между реестром и списком островов. Список литеральный по
   необходимости — собиратель должен увидеть каждый import() глазами, — поэтому
   разъехаться он может только молча. Этот тест и есть шум, которого не хватает. */

describe('острова', () => {
  it('у каждого интерактивного блока есть строчка в списке загрузки', () => {
    const нужны = blockDefinitions().filter((d) => d.tag).map((d) => d.tag!);
    for (const tag of нужны) expect(Object.keys(ISOLE), tag).toContain(tag);
  });

  it('и наоборот: лишних строчек нет — иначе кусок собирается впустую', () => {
    const известны = new Set(blockDefinitions().filter((d) => d.tag).map((d) => d.tag!));
    for (const tag of Object.keys(ISOLE)) expect([...известны], tag).toContain(tag);
  });
});
