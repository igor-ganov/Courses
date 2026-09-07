/**
 * The quiz runner.
 *
 * One screen, all questions, one submit — not a one-question-per-page drip. A
 * learner should be able to look over the whole check, change their mind about
 * question 2 after reading question 5, and get every explanation at once. After
 * submitting they can retry: mastery here is a moving average, not a single
 * verdict, and re-earning a level is meant to be normal.
 *
 * Interactive `goal` questions embed a widget from the block registry, so a
 * check can ask the learner to *tune a loop* rather than to pick the sentence
 * that describes a tuned loop.
 */

import { useMemo, useState } from 'react';
import { usePlatform } from '@/app/platform';
import { BlockRenderer } from '@/content/BlockRenderer';
import { Inline } from '@/content/inline';
import type { Assessment, Question } from '@/content/model';
import type { BlockContext } from '@/content/registry';
import { gradeAssessment, type AssessmentResult } from './assessment';

export interface QuizProps {
  assessment: Assessment;
  /** Where this quiz lives, for reporting progress. */
  location: { courseId: string; topicId: string; level: number };
  onSubmit?(result: AssessmentResult): void;
  title?: string;
}

export function Quiz({ assessment, location, onSubmit, title }: QuizProps) {
  const { questions: registry } = usePlatform();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  const answeredCount = useMemo(
    () => assessment.questions.filter((q) => answers[q.id] !== undefined).length,
    [answers, assessment.questions],
  );

  const submit = () => {
    const graded = gradeAssessment(assessment, answers, registry);
    setResult(graded);
    onSubmit?.(graded);
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
    setAttempt((n) => n + 1);
  };

  return (
    <section className="quiz" aria-label={title ?? assessment.title ?? 'Проверка понимания'}>
      <header className="quiz__head">
        <span className="quiz__title">{title ?? assessment.title ?? 'Проверка понимания'}</span>
        <span className="quiz__progress">
          {result ? `${Math.round(result.ratio * 100)}%` : `${answeredCount} / ${assessment.questions.length}`}
        </span>
      </header>

      <div className="quiz__body">
        {assessment.questions.map((question, index) => (
          <QuestionView
            key={`${attempt}-${question.id}`}
            question={question}
            index={index}
            answer={answers[question.id]}
            grade={result?.perQuestion[question.id]}
            revealed={Boolean(result)}
            location={location}
            onAnswer={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
          />
        ))}
      </div>

      <footer className="quiz__foot">
        {result ? (
          <>
            <span className={`pill pill--${result.passed ? 'ok' : 'warn'}`}>
              {result.passed ? 'Зачтено' : 'Пока не зачтено'} · {Math.round(result.ratio * 100)}%
            </span>
            <button type="button" className="btn btn--sm" onClick={retry}>
              Пройти заново
            </button>
            {!result.passed && (
              <span className="muted" style={{ fontSize: '0.9rem' }}>
                Разберите объяснения выше и попробуйте ещё раз — попытки не штрафуются.
              </span>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={answeredCount === 0}
            >
              Проверить
            </button>
            <span className="muted" style={{ fontSize: '0.9rem' }}>
              Отвечено {answeredCount} из {assessment.questions.length}
            </span>
          </>
        )}
      </footer>
    </section>
  );
}

function QuestionView({
  question,
  index,
  answer,
  onAnswer,
  revealed,
  grade,
  location,
}: {
  question: Question;
  index: number;
  answer: unknown;
  onAnswer(value: unknown): void;
  revealed: boolean;
  grade?: ReturnType<typeof gradeAssessment>['perQuestion'][string];
  location: QuizProps['location'];
}) {
  const { questions: registry, blocks } = usePlatform();
  const definition = registry.get(question.type);
  const props = registry.propsFor(question);

  if (!definition || props === null) {
    return (
      <div className="block-error" role="alert">
        Вопрос «{question.id}» не может быть показан: неизвестный или некорректный тип «{question.type}».
      </div>
    );
  }

  const View = definition.component;

  return (
    <div className="question">
      <div className="question__prompt">
        <span className="question__index">{index + 1}.</span>
        <Inline text={question.prompt} />
      </div>
      {question.hint && !revealed && (
        <div className="question__hint">Подсказка: {question.hint}</div>
      )}

      {question.type === 'goal' ? (
        <GoalQuestion props={props as any} onAnswer={onAnswer} location={location} blocks={blocks} />
      ) : (
        <View
          question={question}
          props={props}
          answer={answer}
          onAnswer={onAnswer}
          revealed={revealed}
          grade={grade}
        />
      )}

      {revealed && question.explanation && (
        <div className="feedback__explanation">
          <Inline text={question.explanation} />
        </div>
      )}
    </div>
  );
}

/**
 * A question answered by using a widget. The widget's own `reportInteraction`
 * becomes the answer, so anything scorable in the block library can be an
 * assessment item without extra plumbing.
 */
function GoalQuestion({
  props,
  onAnswer,
  location,
  blocks,
}: {
  props: { widget: string; widgetProps?: Record<string, unknown>; caption?: string };
  onAnswer(value: unknown): void;
  location: QuizProps['location'];
  blocks: ReturnType<typeof usePlatform>['blocks'];
}) {
  const ctx: BlockContext = useMemo(
    () => ({
      courseId: location.courseId,
      topicId: location.topicId,
      level: location.level,
      reportInteraction: ({ score }) => onAnswer({ score: score ?? 1 }),
      isCompleted: () => false,
    }),
    [location, onAnswer],
  );

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {props.caption && <p className="muted" style={{ margin: 0 }}>{props.caption}</p>}
      <BlockRenderer
        registry={blocks}
        ctx={ctx}
        nodes={[{ id: `goal-${props.widget}`, type: props.widget, props: props.widgetProps ?? {} }]}
      />
    </div>
  );
}
