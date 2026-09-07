/**
 * A single turn of the spiral: one level of one topic.
 *
 * Objectives up front (own ones, and the inherited ones the recap block can
 * expand), then the lecture itself, then the level's assessment. Every block
 * that reports an interaction credits progress immediately, so a learner who
 * plays with the simulations and never reaches the quiz is still visibly making
 * headway — because they are.
 */

import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePlatform, useProgress } from '@/app/platform';
import { BlockRenderer } from '@/content/BlockRenderer';
import { levelKey } from '@/content/model';
import type { BlockContext } from '@/content/registry';
import { Quiz } from '@/engine/Quiz';
import { NotFoundPage } from './NotFoundPage';

export function LevelPage() {
  const { courseId = '', topicId = '', level = '1' } = useParams();
  const { graph, progress, blocks } = usePlatform();
  const state = useProgress();

  const key = levelKey(courseId, topicId, Number(level));
  const entry = graph.entry(key);

  const reportInteraction = useCallback<BlockContext['reportInteraction']>(
    ({ blockId, score }) => progress.completeBlock(key, blockId, score === undefined ? {} : { score }),
    [progress, key],
  );

  const levelState = state.levels[key];
  const isCompleted = useCallback(
    (blockId: string) => Boolean(levelState?.blocksDone.includes(blockId)),
    [levelState],
  );

  const ctx = useMemo<BlockContext>(
    () => ({
      courseId,
      topicId,
      level: Number(level),
      reportInteraction,
      isCompleted,
    }),
    [courseId, topicId, level, reportInteraction, isCompleted],
  );

  if (!entry) return <NotFoundPage />;

  const { topic, level: levelData } = entry;
  const completed = progress.completedLevels();
  const unlocked = graph.isUnlocked(key, completed);
  const inherited = graph.resolveInheritance(key);
  const spiral = graph.spiralPath(courseId);
  const position = spiral.indexOf(key);
  const previous = position > 0 ? spiral[position - 1] : null;
  const next = position >= 0 && position < spiral.length - 1 ? spiral[position + 1] : null;
  const blocksDone = levelState?.blocksDone.length ?? 0;
  const totalScorable = blocks.scorableBlockIds(levelData.lecture.blocks).length;

  return (
    <article>
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link to="/">Курсы</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/course/${courseId}`}>{graph.course(courseId)?.title}</Link>
        <span aria-hidden="true">/</span>
        <span>{topic.title}</span>
        <span aria-hidden="true">/</span>
        <span>уровень {levelData.level}</span>
      </nav>

      {!unlocked && (
        <div className="offline-note" style={{ marginBottom: 18 }} role="note">
          Этот уровень открывается после предыдущих — но никто не мешает прочитать его сейчас, если хочется забежать
          вперёд.
        </div>
      )}

      <header className="lecture">
        <div className="chips" style={{ marginBottom: 12 }}>
          <span className="pill pill--accent">уровень глубины {levelData.level}</span>
          {topic.tags?.map((tag) => (
            <span key={tag} className="pill">
              {tag}
            </span>
          ))}
          {levelData.estimatedMinutes && <span className="pill">≈ {levelData.estimatedMinutes} мин</span>}
          {levelState && (
            <span className={`pill pill--${levelState.status === 'mastered' ? 'signal' : levelState.status === 'passed' ? 'ok' : 'accent'}`}>
              {statusLabel(levelState.status)}
            </span>
          )}
        </div>

        <h1>{topic.title}: {levelData.title}</h1>
        <p className="prose prose--lead">{levelData.summary}</p>

        <div className="recap">
          <div className="recap__head">Чему учит этот уровень</div>
          <ul className="recap__list">
            {levelData.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          {inherited.inheritedObjectives.length > 0 && (
            <div className="recap__group">
              <div className="recap__head">Опирается на</div>
              <ul className="recap__list">
                {inherited.inheritedObjectives.slice(0, 5).map((objective) => (
                  <li key={objective} className="faint">
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      <div className="lecture" style={{ marginTop: 34 }}>
        <BlockRenderer nodes={levelData.lecture.blocks} registry={blocks} ctx={ctx} />
      </div>

      {levelData.assessment && (
        <div className="lecture" style={{ marginTop: 44 }}>
          <h2>Проверка уровня</h2>
          <p className="muted">
            Частичный балл засчитывается, попытки не ограничены, а владение темой считается как скользящее среднее по
            попыткам — так что имеет смысл вернуться сюда через несколько дней.
          </p>
          <Quiz
            assessment={levelData.assessment}
            location={{ courseId, topicId, level: Number(level) }}
            onSubmit={(result) =>
              progress.submitAssessment(key, {
                ratio: result.ratio,
                passed: result.passed,
                weakConcepts: result.weakConcepts,
              })
            }
          />
        </div>
      )}

      <div className="lecture">
        <div className="level-nav">
          {previous ? (
            <Link className="btn" to={pathOf(graph, previous)}>
              ← {graph.entry(previous)?.topic.title}
            </Link>
          ) : (
            <span />
          )}
          <span className="faint" style={{ fontSize: '0.86rem' }}>
            блоков пройдено: {blocksDone}
            {totalScorable > 0 ? ` · интерактивных: ${totalScorable}` : ''}
          </span>
          {next ? (
            <Link className="btn btn--primary" to={pathOf(graph, next)}>
              {graph.entry(next)?.topic.title} · уровень {graph.entry(next)?.level.level} →
            </Link>
          ) : (
            <Link className="btn btn--primary" to={`/course/${courseId}`}>
              К карте курса
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'mastered':
      return 'усвоено';
    case 'passed':
      return 'зачтено';
    case 'in-progress':
      return 'в работе';
    default:
      return 'открыто';
  }
}

function pathOf(graph: ReturnType<typeof usePlatform>['graph'], key: string): string {
  const entry = graph.entry(key);
  return entry ? `/course/${entry.courseId}/${entry.topicId}/${entry.level.level}` : '/';
}
