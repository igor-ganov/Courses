/**
 * Question views.
 *
 * Graders live in `assessment.ts` and know nothing about React; these are the
 * matching views. They share one convention: before submission they collect an
 * answer, after submission they become a review of what happened — right answer
 * marked, chosen answer marked, and the author's explanation shown whether the
 * learner was right or wrong. Getting it right without knowing why is also a
 * gap worth closing.
 */

import { useMemo, type ComponentType } from 'react';
import { Inline } from '@/content/inline';
import { QuestionRegistry, standardQuestionTypes, type Grade, type QuestionViewProps } from './assessment';

// ------------------------------------------------------------- single choice

function SingleChoice({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  return (
    <div className="options" role="radiogroup">
      {props.options.map((option: string, index: number) => {
        const picked = answer === index;
        const state = !revealed
          ? picked
            ? ' option--picked'
            : ''
          : index === props.correct
            ? ' option--right'
            : picked
              ? ' option--wrong'
              : '';
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={picked}
            disabled={revealed}
            className={`option${state}`}
            onClick={() => onAnswer(index)}
          >
            <span className="option__marker" aria-hidden="true">
              {revealed && index === props.correct ? '✓' : picked ? '●' : String.fromCharCode(1040 + index)}
            </span>
            <span>
              <Inline text={option} />
              {revealed && props.why?.[index] && (
                <span className="muted" style={{ display: 'block', fontSize: '0.88rem', marginTop: 4 }}>
                  {props.why[index]}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// ----------------------------------------------------------- multiple choice

function MultiChoice({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  const picked: number[] = Array.isArray(answer) ? answer : [];
  const toggle = (index: number) =>
    onAnswer(picked.includes(index) ? picked.filter((i) => i !== index) : [...picked, index]);

  return (
    <div className="options">
      {props.options.map((option: string, index: number) => {
        const chosen = picked.includes(index);
        const isRight = props.correct.includes(index);
        const state = !revealed
          ? chosen
            ? ' option--picked'
            : ''
          : isRight
            ? ' option--right'
            : chosen
              ? ' option--wrong'
              : '';
        return (
          <button
            key={index}
            type="button"
            role="checkbox"
            aria-checked={chosen}
            disabled={revealed}
            className={`option option--multi${state}`}
            onClick={() => toggle(index)}
          >
            <span className="option__marker" aria-hidden="true">
              {revealed ? (isRight ? '✓' : chosen ? '×' : '') : chosen ? '✓' : ''}
            </span>
            <span>
              <Inline text={option} />
            </span>
          </button>
        );
      })}
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// -------------------------------------------------------------------- numeric

function NumericQuestion({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="number-input"
          type="text"
          inputMode="decimal"
          disabled={revealed}
          value={typeof answer === 'string' || typeof answer === 'number' ? String(answer) : ''}
          placeholder={props.placeholder ?? 'число'}
          aria-label="Ответ"
          onChange={(event) => onAnswer(event.target.value)}
        />
        {props.unit && <span className="muted">{props.unit}</span>}
      </div>
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// ------------------------------------------------------------------- ordering

function OrderQuestion({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  // The initial order is a fixed shuffle: stable across re-renders, and never
  // accidentally the correct answer already.
  const initial = useMemo<number[]>(() => {
    const indices = props.items.map((_: string, index: number) => index);
    return indices.length > 2 ? [...indices.slice(1), indices[0]].reverse() : [...indices].reverse();
  }, [props.items]);

  const order: number[] = Array.isArray(answer) && answer.length === props.items.length ? answer : initial;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    onAnswer(next);
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {props.caption && <p className="muted" style={{ margin: 0 }}>{props.caption}</p>}
      <ol className="order-list">
        {order.map((itemIndex, position) => (
          <li key={itemIndex} className="order-item">
            <span className="order-item__grip" aria-hidden="true">
              {position + 1}
            </span>
            <span>
              <Inline text={props.items[itemIndex]} />
            </span>
            {revealed && (
              <span className="pill" style={{ marginLeft: 8 }}>
                верное место: {itemIndex + 1}
              </span>
            )}
            <span className="order-item__moves">
              <button
                type="button"
                className="order-item__btn"
                aria-label={`Переместить «${props.items[itemIndex]}» выше`}
                disabled={revealed || position === 0}
                onClick={() => move(position, position - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="order-item__btn"
                aria-label={`Переместить «${props.items[itemIndex]}» ниже`}
                disabled={revealed || position === order.length - 1}
                onClick={() => move(position, position + 1)}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// ------------------------------------------------------------------- matching

function MatchQuestion({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  const current: Record<string, number> = (answer as Record<string, number>) ?? {};
  const rights = props.pairs.map((pair: { right: string }) => pair.right);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="match-grid">
        {props.pairs.map((pair: { left: string }, index: number) => {
          const chosen = current[String(index)];
          const right = revealed && chosen === index;
          const wrong = revealed && chosen !== undefined && chosen !== index;
          return (
            <div key={pair.left} className="match-row">
              <span style={{ color: right ? 'var(--ok)' : wrong ? 'var(--danger)' : undefined }}>
                <Inline text={pair.left} />
              </span>
              <select
                disabled={revealed}
                aria-label={`Соответствие для «${pair.left}»`}
                value={chosen === undefined ? '' : String(chosen)}
                onChange={(event) =>
                  onAnswer({ ...current, [String(index)]: Number(event.target.value) })
                }
              >
                <option value="">— выберите —</option>
                {rights.map((rightText: string, rightIndex: number) => (
                  <option key={rightText} value={rightIndex}>
                    {rightText}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// ----------------------------------------------------------------- short text

function ShortText({ props, answer, onAnswer, revealed, grade }: QuestionViewProps<any>) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input
        className="text-input"
        type="text"
        disabled={revealed}
        value={typeof answer === 'string' ? answer : ''}
        placeholder={props.placeholder ?? 'ответ одним словом'}
        aria-label="Ответ"
        onChange={(event) => onAnswer(event.target.value)}
      />
      {grade && <Feedback grade={grade} />}
    </div>
  );
}

// ------------------------------------------------------------------- feedback

function Feedback({ grade }: { grade: Grade }) {
  return (
    <div className={`feedback feedback--${grade.correct ? 'right' : 'wrong'}`} role="status">
      <strong>{grade.correct ? 'Верно.' : grade.answered ? 'Не совсем.' : 'Без ответа.'}</strong>{' '}
      {grade.feedback}
    </div>
  );
}

/**
 * Views for the standard question types. The `goal` type has no standalone view:
 * it is answered by an embedded widget, which the quiz runner mounts itself.
 */
export const questionComponents: Record<string, ComponentType<QuestionViewProps<any>>> = {
  'choice.single': SingleChoice,
  'choice.multi': MultiChoice,
  numeric: NumericQuestion,
  order: OrderQuestion,
  match: MatchQuestion,
  'text.short': ShortText,
};

/** The registry the app uses: standard graders wired to the views above. */
export function createQuestionRegistry(): QuestionRegistry {
  const registry = new QuestionRegistry();
  for (const type of standardQuestionTypes) {
    registry.register({ ...type, component: questionComponents[type.type] ?? type.component });
  }
  return registry;
}
