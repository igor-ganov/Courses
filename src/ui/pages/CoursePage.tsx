/**
 * The course map.
 *
 * Modules in authored order, each with its topics; every topic shows its levels
 * as dots so the spiral is legible at a glance — which turns of which topics are
 * done, which is unlocked next, which is still out of reach and why.
 */

import { Link, useParams } from 'react-router-dom';
import { usePlatform, useProgress } from '@/app/platform';
import { levelKey } from '@/content/model';
import { NotFoundPage } from './NotFoundPage';

export function CoursePage() {
  const { courseId = '' } = useParams();
  const { graph, progress } = usePlatform();
  useProgress(); // re-render as progress changes
  const course = graph.course(courseId);

  if (!course) return <NotFoundPage />;

  const completed = progress.completedLevels();
  const path = graph.spiralPath(course.id);
  const doneCount = path.filter((key) => completed.has(key)).length;
  const next = graph.nextLevel(course.id, completed);

  return (
    <div>
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link to="/">Курсы</Link>
        <span aria-hidden="true">/</span>
        <span>{course.title}</span>
      </nav>

      <section className="course-hero">
        <div>
          <h1 style={{ marginBottom: 6 }}>{course.title}</h1>
          <p className="prose prose--lead" style={{ marginBottom: 12 }}>
            {course.subtitle}
          </p>
          <p className="muted" style={{ maxWidth: '64ch' }}>
            {course.description}
          </p>
          <div className="progress-bar" style={{ maxWidth: 420 }}>
            <div className="progress-bar__fill" style={{ width: `${path.length ? (doneCount / path.length) * 100 : 0}%` }} />
          </div>
          <p className="faint" style={{ marginTop: 8, fontSize: '0.88rem' }}>
            Пройдено {doneCount} из {path.length} уровней спирали
          </p>
          {next && (
            <Link className="btn btn--primary" style={{ marginTop: 8 }} to={levelPath(graph, next)}>
              Продолжить: {graph.entry(next)?.topic.title}
            </Link>
          )}
        </div>
      </section>

      {course.modules.map((module) => (
        <section key={module.id}>
          <div className="module-head">
            <span className="module-head__glyph" aria-hidden="true">
              {module.glyph ?? '◆'}
            </span>
            <div>
              <h2 style={{ margin: 0 }}>{module.title}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {module.description}
              </p>
            </div>
          </div>

          <div className="grid">
            {graph.topicsOfModule(course.id, module.id).map((topic) => {
              const firstLevelKey = levelKey(course.id, topic.id, 1);
              const unlocked = graph.isUnlocked(firstLevelKey, completed);
              const target = topic.levels.find(
                (level) => !completed.has(levelKey(course.id, topic.id, level.level)),
              );
              const to = `/course/${course.id}/${topic.id}/${target?.level ?? 1}`;

              return (
                <Link key={topic.id} className={`topic-card${unlocked ? '' : ' topic-card--locked'}`} to={to}>
                  <span className="topic-card__title">{topic.title}</span>
                  <span className="topic-card__tagline">{topic.tagline}</span>

                  <div className="topic-card__levels" aria-label="Уровни глубины">
                    {topic.levels.map((level) => {
                      const key = levelKey(course.id, topic.id, level.level);
                      const state = progress.levelProgress(key);
                      const isNext = key === next;
                      const className = [
                        'level-dot',
                        state?.status === 'mastered' ? 'level-dot--mastered' : '',
                        state?.status === 'passed' ? 'level-dot--done' : '',
                        isNext ? 'level-dot--current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <span key={level.level} className={className} title={`Уровень ${level.level}: ${level.title}`}>
                          {level.level}
                        </span>
                      );
                    })}
                  </div>

                  {topic.prerequisites && topic.prerequisites.length > 0 && (
                    <span className="faint" style={{ fontSize: '0.82rem' }}>
                      после: {topic.prerequisites.map((id) => graph.topic(course.id, id)?.title ?? id).join(', ')}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function levelPath(graph: ReturnType<typeof usePlatform>['graph'], key: string): string {
  const entry = graph.entry(key);
  return entry ? `/course/${entry.courseId}/${entry.topicId}/${entry.level.level}` : '/';
}
