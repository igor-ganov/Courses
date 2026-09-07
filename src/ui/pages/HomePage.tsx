/**
 * The entry screen: what to study now, and how far along you are.
 */

import { Link } from 'react-router-dom';
import { usePlatform, useProgress } from '@/app/platform';
import { rankFromXp } from '@/engine/progress';

export function HomePage() {
  const { graph, progress } = usePlatform();
  const state = useProgress();
  const completed = progress.completedLevels();
  const rank = rankFromXp(state.xp);
  const due = progress.dueForReview();

  return (
    <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
      <section className="course-hero">
        <div>
          <span className="pill pill--accent">офлайн-первая платформа</span>
          <h1 style={{ marginTop: 14 }}>Кибернетика как набор инструментов, а не как история идей</h1>
          <p className="prose prose--lead" style={{ maxWidth: '62ch' }}>
            Обратная связь, разнообразие, информация, устойчивость и эмерджентность — пять понятий, которые
            описывают термостат, живой организм, рынок и разговор одними и теми же словами. Здесь их не
            пересказывают: их крутят руками в симуляциях, ломают в мини-играх и собирают заново.
          </p>
          <div className="widget__actions" style={{ marginTop: 18 }}>
            {graph.courses.map((course) => {
              const next = graph.nextLevel(course.id, completed);
              const entry = next ? graph.entry(next) : null;
              return entry ? (
                <Link
                  key={course.id}
                  className="btn btn--primary"
                  to={`/course/${entry.courseId}/${entry.topicId}/${entry.level.level}`}
                >
                  {completed.size === 0 ? 'Начать курс' : 'Продолжить'} → {entry.topic.title}
                </Link>
              ) : (
                <Link key={course.id} className="btn btn--primary" to={`/course/${course.id}`}>
                  Курс пройден — к карте
                </Link>
              );
            })}
            <Link className="btn" to="/progress">
              Мой прогресс
            </Link>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <Stat label="Ранг" value={rank.title} note={`${state.xp} опыта`} />
          <Stat label="Уровней пройдено" value={String(completed.size)} note={`из ${graph.allLevelKeys().length}`} />
          <Stat label="Дней подряд" value={String(state.streak.current)} note={`рекорд ${state.streak.longest}`} />
          <Stat label="Наград" value={String(state.badges.length)} note="за практику" />
        </div>
      </section>

      {due.length > 0 && (
        <section className="card">
          <h2 style={{ marginBottom: 8 }}>Пора повторить</h2>
          <p className="muted">
            Интервальное повторение: эти уровни пора освежить, пока они не выветрились.
          </p>
          <div className="widget__actions">
            {due.slice(0, 4).map((key) => {
              const entry = graph.entry(key);
              if (!entry) return null;
              return (
                <Link
                  key={key}
                  className="btn btn--sm"
                  to={`/course/${entry.courseId}/${entry.topicId}/${entry.level.level}`}
                >
                  {entry.topic.title} · уровень {entry.level.level}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2>Курсы</h2>
        <div className="grid grid--courses">
          {graph.courses.map((course) => {
            const path = graph.spiralPath(course.id);
            const doneCount = path.filter((key) => completed.has(key)).length;
            const percent = path.length ? (doneCount / path.length) * 100 : 0;
            return (
              <Link key={course.id} className="topic-card" to={`/course/${course.id}`}>
                <span className="pill pill--signal">{course.level === 'intro' ? 'вводный' : course.level}</span>
                <span className="topic-card__title">{course.title}</span>
                <span className="topic-card__tagline">{course.subtitle}</span>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
                </div>
                <span className="faint" style={{ fontSize: '0.85rem' }}>
                  {doneCount} из {path.length} уровней · {course.topics.length} тем
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Как устроено обучение</h2>
        <div className="compare">
          <div className="compare__col">
            <div className="compare__head">Спираль, а не лестница</div>
            <ul className="compare__list">
              <li>Сначала каждая тема проходится на первом уровне глубины.</li>
              <li>Второй виток возвращается к тем же понятиям с новым аппаратом.</li>
              <li>Каждый уровень явно наследует цели предыдущих и связанных тем.</li>
            </ul>
          </div>
          <div className="compare__col compare__col--alt">
            <div className="compare__head">Практика вместо пересказа</div>
            <ul className="compare__list">
              <li>Симуляции, 3D-сцены и мини-игры засчитываются в прогресс.</li>
              <li>Проверки допускают частичный балл и неограниченные попытки.</li>
              <li>Владение темой — скользящее среднее, а не единственная оценка.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="readout__label">{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 650, marginTop: 4 }}>{value}</div>
      <div className="faint" style={{ fontSize: '0.85rem' }}>
        {note}
      </div>
    </div>
  );
}
