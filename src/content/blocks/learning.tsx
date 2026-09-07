/**
 * Blocks that know about the curriculum.
 *
 * These are what make the spiral visible from inside a lecture rather than only
 * in the navigation: a recap assembled from the levels this one inherits, a
 * cross-reference list built from the graph (so it can never point at a level
 * that no longer exists), and an inline checkpoint that grades understanding at
 * the moment it is formed instead of at the end of the page.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { s, type Infer } from '@/core/schema';
import { usePlatform } from '@/app/platform';
import { Quiz } from '@/engine/Quiz';
import { levelKey, questionSchema, type Assessment } from '../model';
import { defineBlock, type BlockDefinition, type BlockViewProps } from '../registry';
import { Inline } from '../inline';

// -------------------------------------------------------------------- recap

const recapSchema = s.object({
  title: s.withDefault(s.string(), 'Откуда мы сюда пришли'),
  /** Hide the objectives list and show only the links. */
  compact: s.withDefault(s.boolean(), false),
});

function Recap({ props, ctx }: BlockViewProps<Infer<typeof recapSchema>>) {
  const { graph } = usePlatform();
  const key = levelKey(ctx.courseId, ctx.topicId, ctx.level);
  const resolved = graph.resolveInheritance(key);

  if (resolved.ancestors.length === 0) {
    return (
      <div className="recap">
        <div className="recap__head">{props.title}</div>
        <p className="muted" style={{ margin: 0 }}>
          Это первый виток спирали по данной теме — предыдущих уровней у неё пока нет.
        </p>
      </div>
    );
  }

  return (
    <div className="recap">
      <div className="recap__head">{props.title}</div>
      <div className="refs">
        {resolved.ancestors.map((ancestor) => {
          const entry = graph.entry(ancestor);
          if (!entry) return null;
          return (
            <Link key={ancestor} className="ref" to={`/course/${entry.courseId}/${entry.topicId}/${entry.level.level}`}>
              <span className="ref__kind">уровень {entry.level.level}</span>
              <span>
                <span className="ref__title">{entry.topic.title}: {entry.level.title}</span>
                <span className="ref__note" style={{ display: 'block' }}>{entry.level.summary}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {!props.compact && resolved.inheritedObjectives.length > 0 && (
        <div className="recap__group">
          <div className="recap__head">Что уже должно быть в руках</div>
          <ul className="recap__list">
            {resolved.inheritedObjectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const recap = defineBlock({
  type: 'recap',
  category: 'meta',
  label: 'Связь с предыдущими уровнями',
  description: 'Автоматически собирается из графа наследования уровней.',
  schema: recapSchema,
  component: Recap,
  cost: 2,
});

// --------------------------------------------------------------- references

const REFERENCE_LABELS: Record<string, string> = {
  prereq: 'нужно раньше',
  deepens: 'углубляет',
  seeAlso: 'см. также',
  foreshadows: 'будет дальше',
  external: 'вне платформы',
};

const referencesSchema = s.object({
  title: s.withDefault(s.string(), 'Связанные материалы'),
  /** Restrict to certain kinds, e.g. only what comes later. */
  kinds: s.optional(s.array(s.enum(['prereq', 'deepens', 'seeAlso', 'foreshadows', 'external'] as const))),
});

function References({ props, ctx }: BlockViewProps<Infer<typeof referencesSchema>>) {
  const { graph } = usePlatform();
  const key = levelKey(ctx.courseId, ctx.topicId, ctx.level);
  const all = graph.resolveReferences(key);
  const shown = props.kinds ? all.filter((ref) => props.kinds!.includes(ref.kind)) : all;

  if (shown.length === 0) return null;

  return (
    <div>
      <div className="recap__head">{props.title}</div>
      <div className="refs">
        {shown.map((ref) => {
          const label = ref.label ?? ref.title ?? ref.target;
          const body = (
            <>
              <span className="ref__kind">{REFERENCE_LABELS[ref.kind]}</span>
              <span>
                <span className="ref__title">
                  {ref.topicTitle ? `${ref.topicTitle}: ${label}` : label}
                </span>
                {ref.note && <span className="ref__note" style={{ display: 'block' }}>{ref.note}</span>}
              </span>
            </>
          );

          if (ref.broken) {
            return (
              <div key={ref.target} className="ref" style={{ opacity: 0.55 }}>
                {body}
              </div>
            );
          }
          if (ref.external || !ref.key) {
            return (
              <a key={ref.target} className="ref" href={ref.target} target="_blank" rel="noopener noreferrer">
                {body}
              </a>
            );
          }
          const entry = graph.entry(ref.key);
          return (
            <Link
              key={ref.target}
              className="ref"
              to={`/course/${entry?.courseId}/${entry?.topicId}/${entry?.level.level}`}
            >
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const references = defineBlock({
  type: 'references',
  category: 'meta',
  label: 'Перекрёстные ссылки',
  description: 'Список связей уровня, собранный и проверенный по графу курса.',
  schema: referencesSchema,
  component: References,
  cost: 1,
});

// --------------------------------------------------------------- checkpoint

const checkpointSchema = s.object({
  title: s.withDefault(s.string(), 'Проверьте себя'),
  intro: s.optional(s.string()),
  questions: s.array(questionSchema, { min: 1 }),
  passingScore: s.withDefault(s.number({ min: 0, max: 1 }), 0.7),
});

function Checkpoint({ props, ctx, blockId }: BlockViewProps<Infer<typeof checkpointSchema>>) {
  const [best, setBest] = useState(0);

  const assessment: Assessment = {
    id: blockId,
    title: props.title,
    passingScore: props.passingScore,
    questions: props.questions,
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {props.intro && (
        <p className="muted" style={{ margin: 0 }}>
          <Inline text={props.intro} />
        </p>
      )}
      <Quiz
        assessment={assessment}
        location={{ courseId: ctx.courseId, topicId: ctx.topicId, level: ctx.level }}
        onSubmit={(result) => {
          // Credit the best attempt: retries are for learning, not for grinding.
          if (result.ratio > best) {
            setBest(result.ratio);
            ctx.reportInteraction({ blockId, score: result.ratio, detail: { ratio: result.ratio } });
          }
        }}
      />
    </div>
  );
}

const checkpoint = defineBlock({
  type: 'checkpoint',
  category: 'assessment',
  label: 'Проверка по ходу лекции',
  description: 'Мини-проверка внутри материала, засчитывается в прогресс уровня.',
  schema: checkpointSchema,
  component: Checkpoint,
  scorable: true,
  cost: 4,
});

export const learningBlocks: readonly BlockDefinition<any>[] = [recap, references, checkpoint];
