/**
 * The prose-level block library.
 *
 * These are the blocks a lecture is mostly made of. They are intentionally
 * semantic rather than presentational — `definition`, `key-idea`, `history`,
 * `paradox` — because the point of authoring content as data is that the
 * platform can later do something with the meaning: build a glossary, collect
 * every key idea into a revision sheet, or render the same lecture differently
 * on a small screen.
 */

import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockDefinition } from '../registry';
import { Inline } from '../inline';

// --------------------------------------------------------------------- prose

const proseSchema = s.object({
  text: s.string({ min: 1 }),
  lead: s.withDefault(s.boolean(), false),
});

const prose = defineBlock({
  type: 'prose',
  category: 'text',
  label: 'Абзац',
  schema: proseSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof proseSchema> }) => (
    <p className={`prose${props.lead ? ' prose--lead' : ''}`}>
      <Inline text={props.text} />
    </p>
  ),
});

const headingSchema = s.object({
  text: s.string({ min: 1 }),
  level: s.withDefault(s.number({ min: 2, max: 4, int: true }), 2),
});

const heading = defineBlock({
  type: 'heading',
  category: 'text',
  label: 'Заголовок',
  schema: headingSchema,
  component: ({ props, blockId }: { props: Infer<typeof headingSchema>; blockId: string }) => {
    const Tag = `h${props.level}` as 'h2' | 'h3' | 'h4';
    return <Tag id={blockId}>{props.text}</Tag>;
  },
});

const listSchema = s.object({
  items: s.array(s.string({ min: 1 }), { min: 1 }),
  ordered: s.withDefault(s.boolean(), false),
});

const list = defineBlock({
  type: 'list',
  category: 'text',
  label: 'Список',
  schema: listSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof listSchema> }) => {
    const Tag = props.ordered ? 'ol' : 'ul';
    return (
      <Tag className="prose" style={{ display: 'grid', gap: 7, paddingLeft: 22 }}>
        {props.items.map((item, index) => (
          <li key={index}>
            <Inline text={item} />
          </li>
        ))}
      </Tag>
    );
  },
});

// ------------------------------------------------------------------ emphasis

const CALLOUT_LABELS: Record<string, { label: string; glyph: string }> = {
  idea: { label: 'Мысль', glyph: '◆' },
  history: { label: 'История', glyph: '⌛' },
  warning: { label: 'Осторожно', glyph: '⚠' },
  paradox: { label: 'Парадокс', glyph: '↻' },
  note: { label: 'Замечание', glyph: '✎' },
};

const calloutSchema = s.object({
  kind: s.withDefault(s.enum(['idea', 'history', 'warning', 'paradox', 'note'] as const), 'note'),
  title: s.optional(s.string()),
  text: s.string({ min: 1 }),
});

const callout = defineBlock({
  type: 'callout',
  category: 'text',
  label: 'Врезка',
  schema: calloutSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof calloutSchema> }) => {
    const meta = CALLOUT_LABELS[props.kind];
    return (
      <aside className={`callout callout--${props.kind}`}>
        <div className="callout__label">
          <span aria-hidden="true">{meta.glyph}</span>
          {props.title ?? meta.label}
        </div>
        <p style={{ margin: 0 }}>
          <Inline text={props.text} />
        </p>
      </aside>
    );
  },
});

const keyIdeaSchema = s.object({ text: s.string({ min: 1 }), label: s.withDefault(s.string(), 'Ключевая идея') });

const keyIdea = defineBlock({
  type: 'key-idea',
  category: 'text',
  label: 'Ключевая идея',
  schema: keyIdeaSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof keyIdeaSchema> }) => (
    <div className="key-idea">
      <div className="key-idea__label">{props.label}</div>
      <div>
        <Inline text={props.text} />
      </div>
    </div>
  ),
});

const definitionSchema = s.object({
  term: s.string({ min: 1 }),
  /** Original-language form, e.g. the Greek or the English term. */
  original: s.optional(s.string()),
  text: s.string({ min: 1 }),
});

const definition = defineBlock({
  type: 'definition',
  category: 'text',
  label: 'Определение',
  schema: definitionSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof definitionSchema> }) => (
    <div className="definition">
      <span className="definition__term">{props.term}</span>
      {props.original && <span className="definition__original"> · {props.original}</span>}
      <div className="definition__body">
        <Inline text={props.text} />
      </div>
    </div>
  ),
});

const quoteSchema = s.object({
  text: s.string({ min: 1 }),
  author: s.optional(s.string()),
  source: s.optional(s.string()),
});

const quote = defineBlock({
  type: 'quote',
  category: 'text',
  label: 'Цитата',
  schema: quoteSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof quoteSchema> }) => (
    <blockquote className="quote">
      <Inline text={props.text} />
      {(props.author || props.source) && (
        <cite className="quote__author">
          {props.author}
          {props.source ? `, ${props.source}` : ''}
        </cite>
      )}
    </blockquote>
  ),
});

const formulaSchema = s.object({
  expr: s.string({ min: 1 }),
  where: s.optional(s.array(s.object({ sym: s.string({ min: 1 }), meaning: s.string({ min: 1 }) }))),
  caption: s.optional(s.string()),
});

const formula = defineBlock({
  type: 'formula',
  category: 'text',
  label: 'Формула',
  schema: formulaSchema,
  cost: 2,
  component: ({ props }: { props: Infer<typeof formulaSchema> }) => (
    <figure className="formula">
      <div className="formula__expr">{props.expr}</div>
      {props.where && (
        <div className="formula__where">
          {props.where.map((entry) => (
            <div key={entry.sym}>
              <span className="formula__sym">{entry.sym}</span>
              <Inline text={entry.meaning} />
            </div>
          ))}
        </div>
      )}
      {props.caption && <figcaption className="formula__caption">{props.caption}</figcaption>}
    </figure>
  ),
});

// ----------------------------------------------------------------- structure

const stepsSchema = s.object({
  items: s.array(s.object({ title: s.string({ min: 1 }), text: s.optional(s.string()) }), { min: 2 }),
});

const steps = defineBlock({
  type: 'steps',
  category: 'text',
  label: 'Шаги',
  schema: stepsSchema,
  cost: 2,
  component: ({ props }: { props: Infer<typeof stepsSchema> }) => (
    <ol className="steps">
      {props.items.map((item, index) => (
        <li key={index} className="steps__item">
          <div>
            <div className="steps__title">
              <Inline text={item.title} />
            </div>
            {item.text && (
              <div className="muted">
                <Inline text={item.text} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  ),
});

const timelineSchema = s.object({
  items: s.array(
    s.object({ year: s.string({ min: 1 }), title: s.string({ min: 1 }), note: s.optional(s.string()) }),
    { min: 2 },
  ),
});

const timeline = defineBlock({
  type: 'timeline',
  category: 'text',
  label: 'Хронология',
  schema: timelineSchema,
  cost: 2,
  component: ({ props }: { props: Infer<typeof timelineSchema> }) => (
    <div className="timeline">
      {props.items.map((item) => (
        <div key={`${item.year}-${item.title}`} className="timeline__row">
          <span className="timeline__year">{item.year}</span>
          <div>
            <div className="timeline__title">
              <Inline text={item.title} />
            </div>
            {item.note && (
              <div className="timeline__note">
                <Inline text={item.note} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  ),
});

const compareSchema = s.object({
  columns: s.array(s.object({ head: s.string({ min: 1 }), items: s.array(s.string({ min: 1 }), { min: 1 }) }), {
    min: 2,
    max: 3,
  }),
});

const compare = defineBlock({
  type: 'compare',
  category: 'text',
  label: 'Сравнение',
  schema: compareSchema,
  cost: 2,
  component: ({ props }: { props: Infer<typeof compareSchema> }) => (
    <div className="compare">
      {props.columns.map((column, index) => (
        <div key={column.head} className={`compare__col${index > 0 ? ' compare__col--alt' : ''}`}>
          <div className="compare__head">{column.head}</div>
          <ul className="compare__list">
            {column.items.map((item, i) => (
              <li key={i}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ),
});

const tableSchema = s.object({
  head: s.array(s.string(), { min: 1 }),
  rows: s.array(s.array(s.string()), { min: 1 }),
  caption: s.optional(s.string()),
});

const table = defineBlock({
  type: 'table',
  category: 'text',
  label: 'Таблица',
  schema: tableSchema,
  cost: 2,
  component: ({ props }: { props: Infer<typeof tableSchema> }) => (
    <figure className="figure">
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {props.head.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, i) => (
                  <td key={i}>
                    <Inline text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.caption && <figcaption>{props.caption}</figcaption>}
    </figure>
  ),
});

const detailsSchema = s.object({
  summary: s.string({ min: 1 }),
  text: s.string({ min: 1 }),
});

const details = defineBlock({
  type: 'details',
  category: 'layout',
  label: 'Свёрнутое углубление',
  schema: detailsSchema,
  cost: 1,
  component: ({ props }: { props: Infer<typeof detailsSchema> }) => (
    <details className="details">
      <summary>{props.summary}</summary>
      <div className="details__body prose">
        <Inline text={props.text} />
      </div>
    </details>
  ),
});

const exerciseSchema = s.object({
  prompt: s.string({ min: 1 }),
  /** Shown only after the learner has had a go. */
  answer: s.optional(s.string()),
  label: s.withDefault(s.string(), 'Подумайте'),
});

const exercise = defineBlock({
  type: 'exercise',
  category: 'text',
  label: 'Упражнение на размышление',
  schema: exerciseSchema,
  cost: 3,
  component: ({ props }: { props: Infer<typeof exerciseSchema> }) => (
    <div className="exercise">
      <div className="exercise__label">{props.label}</div>
      <p style={{ marginBottom: props.answer ? 12 : 0 }}>
        <Inline text={props.prompt} />
      </p>
      {props.answer && (
        <details className="details" style={{ background: 'transparent' }}>
          <summary>Показать разбор</summary>
          <div className="details__body">
            <Inline text={props.answer} />
          </div>
        </details>
      )}
    </div>
  ),
});

const columnsSchema = s.object({ gap: s.withDefault(s.number({ min: 0, max: 48 }), 16) });

const columns = defineBlock({
  type: 'columns',
  category: 'layout',
  label: 'Колонки',
  schema: columnsSchema,
  acceptsChildren: true,
  component: ({ props, children }: { props: Infer<typeof columnsSchema>; children?: React.ReactNode }) => (
    <div style={{ display: 'grid', gap: props.gap, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {children}
    </div>
  ),
});

export const textBlocks: readonly BlockDefinition<any>[] = [
  prose,
  heading,
  list,
  callout,
  keyIdea,
  definition,
  quote,
  formula,
  steps,
  timeline,
  compare,
  table,
  details,
  exercise,
  columns,
];
