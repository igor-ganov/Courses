import { describe, expect, it } from 'vitest';
import { blocks, renderBlocks, blockDefinitions } from '~/content/registry';
import * as T from './testo';

/* Блоки текста рисуются разметкой, и вся эта разметка строится из данных с
   экранированием. Проверяется здесь именно это: что автор не может — даже
   случайно — вписать в лекцию тег, и что незнакомый блок остаётся видимым. */

const ctx = { base: '/', course: 'cyb' };

/* Реестр глобален и заполняется при загрузке модуля блоков, поэтому здесь он
   не сбрасывается: сброс отрезал бы renderBlocks от тех самых регистраций.
   Каждый файл тестов работает в своей среде, так что соседям это не мешает. */

describe('набор', () => {
  it('абзац разбирает строчную разметку', () => {
    const html = renderBlocks([T.prose({ text: 'Это **связь** и `код`' })], ctx);
    expect(html).toBe('<p>Это <b class="termine">связь</b> и <code>код</code></p>');
  });

  it('заголовок получает якорь, читаемый в адресе', () => {
    const html = renderBlocks([T.heading({ text: 'Обратная связь' })], ctx);
    expect(html).toBe('<h2 id="obratnaya-svyaz">Обратная связь</h2>');
  });

  it('перечень бывает нумерованным', () => {
    expect(renderBlocks([T.list({ items: ['раз', 'два'], ordered: true })], ctx)).toBe(
      '<ol class="elenco"><li>раз</li><li>два</li></ol>',
    );
  });

  it('таблица требует, чтобы строки совпадали с шапкой', () => {
    const схема = blocks();
    const хорошо = T.table({ head: ['а', 'б'], rows: [['1', '2']] });
    expect(схема.check(хорошо).ok).toBe(true);
    const плохо = схема.check({ kind: 'table', head: ['а', 'б'], rows: [['1']] }, 'l[0]');
    expect(!плохо.ok && плохо.issues[0]?.message).toMatch(/столько же ячеек/);
  });

  it('врезка содержит блоки и рисует их тем же способом', () => {
    const html = renderBlocks(
      [T.callout({ title: 'Из истории', body: [T.prose({ text: 'Винер, 1948.' })] })],
      ctx,
    );
    expect(html).toContain('<p class="titolo-strumento">Из истории</p>');
    expect(html).toContain('<p>Винер, 1948.</p>');
  });
});

describe('безопасность разметки', () => {
  it('автор не может вписать тег в абзац, в подпись, в ячейку', () => {
    const опасно = '<img src=x onerror=alert(1)>';
    for (const блок of [
      T.prose({ text: опасно }),
      T.note({ text: опасно }),
      T.define({ term: опасно, text: опасно }),
      T.quote({ text: опасно, source: опасно }),
      T.code({ code: опасно }),
      T.table({ head: [опасно], rows: [[опасно]] }),
    ]) {
      const html = renderBlocks([блок], ctx);
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    }
  });

  it('схема с обработчиком событий не проходит проверку', () => {
    const плохо = blocks().check(
      { kind: 'figure', svg: '<svg onload="alert(1)"></svg>', alt: 'a' },
      'l[0]',
    );
    expect(!плохо.ok && плохо.issues[0]?.message).toMatch(/скриптов/);
    expect(blocks().check({ kind: 'figure', svg: '<svg><circle/></svg>', alt: 'a' }).ok).toBe(true);
  });
});

describe('отсылки', () => {
  it('ведут на страницу витка', () => {
    const html = renderBlocks([T.crossref({ ref: 'control:2', text: 'подробнее' })], ctx);
    expect(html).toContain('href="/cyb/control/2/"');
  });

  it('битая отсылка видна, а не проглочена', () => {
    const html = renderBlocks([{ kind: 'crossref', ref: 'ерунда', text: 'т' }], ctx);
    expect(html).toContain('guasto');
  });
});

describe('незнакомый блок', () => {
  it('превращается в видимую карточку с адресом, а не роняет лекцию', () => {
    const html = renderBlocks([{ kind: 'выдумка' }], ctx, 'lecture');
    expect(html).toContain('guasto');
    expect(html).toContain('lecture[0]');
    expect(html).toContain('выдумка');
  });
});

describe('галерея', () => {
  it('каждый зарегистрированный блок объявляет ровно один способ отрисовки', () => {
    for (const d of blockDefinitions()) {
      const статический = typeof d.html === 'function';
      const интерактивный = typeof d.tag === 'string';
      expect(статический !== интерактивный, `${d.kind}`).toBe(true);
      expect(d.label.length, `${d.kind}`).toBeGreaterThan(0);
    }
  });
});
