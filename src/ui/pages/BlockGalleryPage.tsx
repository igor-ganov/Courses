/**
 * The component gallery.
 *
 * Every registered block, grouped by category, with its type string and the
 * shape of its props. This is the authoring documentation, generated from the
 * registry itself, so it cannot drift out of date: adding a block to the library
 * adds it here.
 */

import { useMemo, useState } from 'react';
import { usePlatform } from '@/app/platform';
import type { BlockCategory } from '@/content/model';

const CATEGORY_LABELS: Record<BlockCategory, string> = {
  text: 'Текст и структура',
  media: 'Медиа',
  diagram: 'Схемы и визуализации',
  simulation: 'Симуляции',
  game: 'Мини-игры',
  'three-d': '3D-сцены',
  assessment: 'Проверка',
  layout: 'Раскладка',
  meta: 'Связи с курсом',
};

const ORDER: BlockCategory[] = [
  'simulation',
  'game',
  'three-d',
  'diagram',
  'assessment',
  'text',
  'meta',
  'layout',
  'media',
];

export function BlockGalleryPage() {
  const { blocks } = usePlatform();
  const [open, setOpen] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<BlockCategory, ReturnType<typeof blocks.list>>();
    for (const definition of blocks.list()) {
      const list = map.get(definition.category) ?? [];
      list.push(definition);
      map.set(definition.category, list);
    }
    return map;
  }, [blocks]);

  return (
    <div>
      <h1>Библиотека компонентов</h1>
      <p className="prose prose--lead" style={{ maxWidth: '68ch' }}>
        Лекция — это дерево блоков. Каждый блок объявляет схему своих параметров, компонент отрисовки и стоимость в
        минутах изучения; курс ссылается на него строкой <code>type</code>. Чтобы добавить новый интерактив,
        достаточно написать компонент, вызвать <code>defineBlock</code> и внести его в список библиотеки — движок,
        роутинг и учёт прогресса менять не нужно.
      </p>

      <p className="muted">
        Всего зарегистрировано блоков: <strong>{blocks.list().length}</strong>, из них с зачётом в прогресс —{' '}
        <strong>{blocks.list().filter((d) => d.scorable).length}</strong>.
      </p>

      {ORDER.filter((category) => grouped.has(category)).map((category) => (
        <section key={category}>
          <div className="module-head">
            <div>
              <h2 style={{ margin: 0 }}>{CATEGORY_LABELS[category]}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {grouped.get(category)!.length} компонент(ов)
              </p>
            </div>
          </div>

          <div className="grid">
            {grouped.get(category)!.map((definition) => (
              <div key={definition.type} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{definition.label ?? definition.type}</strong>
                  {definition.scorable && <span className="pill pill--ok">зачёт</span>}
                  {definition.heavy && <span className="pill pill--warn">lazy</span>}
                </div>
                <code style={{ display: 'inline-block', margin: '8px 0' }}>{definition.type}</code>
                {definition.description && <p className="muted" style={{ marginBottom: 8 }}>{definition.description}</p>}
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  aria-expanded={open === definition.type}
                  onClick={() => setOpen(open === definition.type ? null : definition.type)}
                >
                  {open === definition.type ? 'Скрыть параметры' : 'Параметры'}
                </button>
                {open === definition.type && (
                  <pre
                    className="mono"
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background: 'var(--bg-deep)',
                      borderRadius: 8,
                      fontSize: '0.82rem',
                      whiteSpace: 'pre-wrap',
                      border: '1px solid var(--line)',
                    }}
                  >
                    {definition.schema.describe()}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
