/**
 * The learner's own dashboard.
 *
 * Rank and XP for momentum; mastery per level for honesty; the review queue for
 * retention; and export/import/reset, because progress that lives only on this
 * device should be movable off it — and erasable on request.
 */

import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlatform, useProgress } from '@/app/platform';
import { BADGES, DAY_MS, rankFromXp } from '@/engine/progress';

export function ProgressPage() {
  const { graph, progress } = usePlatform();
  const state = useProgress();
  const rank = rankFromXp(state.xp);
  const earned = new Set(state.badges.map((b) => b.id));
  const due = progress.dueForReview();
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const levels = Object.entries(state.levels)
    .map(([key, value]) => ({ key, value, entry: graph.entry(key) }))
    .filter((row) => row.entry)
    .sort((a, b) => b.value.mastery - a.value.mastery);

  const exportProgress = () => {
    const blob = new Blob([progress.export()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cybernetica-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Файл прогресса сохранён.');
  };

  const importProgress = async (file: File) => {
    const text = await file.text();
    setMessage(progress.import(text) ? 'Прогресс восстановлен.' : 'Не удалось прочитать файл прогресса.');
  };

  return (
    <div className="stack" style={{ '--gap': '26px' } as React.CSSProperties}>
      <section className="course-hero">
        <div>
          <span className="pill pill--accent">ранг {rank.rank} из 6</span>
          <h1 style={{ margin: '12px 0 4px' }}>{rank.title}</h1>
          <p className="muted">{rank.blurb}</p>
          <div className="progress-bar" style={{ maxWidth: 400 }}>
            <div
              className="progress-bar__fill"
              style={{ width: `${rank.needed > 0 ? (rank.into / rank.needed) * 100 : 100}%` }}
            />
          </div>
          <p className="faint" style={{ marginTop: 8, fontSize: '0.88rem' }}>
            {rank.needed > 0
              ? `${rank.into} / ${rank.needed} опыта до следующего ранга · всего ${state.xp}`
              : `Максимальный ранг · всего ${state.xp} опыта`}
          </p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <Metric label="Блоков изучено" value={state.totals.blocks} />
          <Metric label="Интерактивных запусков" value={state.totals.interactions} />
          <Metric label="Проверок пройдено" value={state.totals.assessments} />
          <Metric label="Дней подряд" value={state.streak.current} note={`рекорд ${state.streak.longest}`} />
        </div>
      </section>

      {due.length > 0 && (
        <section className="card">
          <h2>Очередь повторения</h2>
          <p className="muted">
            Интервалы растут после каждого успешного повторения и сбрасываются после неудачи — так материал
            закрепляется, а не заучивается на один раз.
          </p>
          <div className="widget__actions">
            {due.map((key) => {
              const entry = graph.entry(key);
              if (!entry) return null;
              return (
                <Link key={key} className="btn btn--sm" to={`/course/${entry.courseId}/${entry.topicId}/${entry.level.level}`}>
                  {entry.topic.title} · ур. {entry.level.level}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2>Награды</h2>
        <div className="badge-grid">
          {BADGES.map((badge) => (
            <div key={badge.id} className={`badge${earned.has(badge.id) ? '' : ' badge--locked'}`}>
              <span className="badge__glyph" aria-hidden="true">
                {badge.glyph}
              </span>
              <span className="badge__title">{badge.title}</span>
              <span className="badge__desc">{badge.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Владение темами</h2>
        {levels.length === 0 ? (
          <p className="muted">Пока пусто. Пройдите первый уровень — и здесь появится карта владения.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Тема</th>
                  <th>Уровень</th>
                  <th>Состояние</th>
                  <th>Владение</th>
                  <th>Лучший результат</th>
                  <th>Повторить</th>
                </tr>
              </thead>
              <tbody>
                {levels.map(({ key, value, entry }) => (
                  <tr key={key}>
                    <td>
                      <Link to={`/course/${entry!.courseId}/${entry!.topicId}/${entry!.level.level}`}>
                        {entry!.topic.title}
                      </Link>
                    </td>
                    <td className="mono">{entry!.level.level}</td>
                    <td>{value.status}</td>
                    <td>
                      <div className="progress-bar" style={{ minWidth: 90 }}>
                        <div className="progress-bar__fill" style={{ width: `${value.mastery * 100}%` }} />
                      </div>
                    </td>
                    <td className="mono">{Math.round(value.bestRatio * 100)}%</td>
                    <td className="mono faint">{formatDue(value.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Данные</h2>
        <p className="muted">
          Весь прогресс хранится только на этом устройстве — ни один байт не уходит на сервер. Перенести его на
          другое устройство можно файлом.
        </p>
        <div className="widget__actions">
          <button type="button" className="btn btn--sm" onClick={exportProgress}>
            Сохранить в файл
          </button>
          <button type="button" className="btn btn--sm" onClick={() => fileInput.current?.click()}>
            Загрузить из файла
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            aria-label="Файл прогресса"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importProgress(file);
            }}
          />
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              if (window.confirm('Удалить весь прогресс? Это действие необратимо.')) {
                progress.reset();
                setMessage('Прогресс сброшен.');
              }
            }}
          >
            Сбросить прогресс
          </button>
        </div>
        {message && (
          <p className="pill pill--ok" style={{ marginTop: 12 }} role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="readout__label">{label}</div>
      <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 2 }}>
        {value}
      </div>
      {note && <div className="faint" style={{ fontSize: '0.82rem' }}>{note}</div>}
    </div>
  );
}

function formatDue(dueAt?: number): string {
  if (!dueAt) return '—';
  const days = Math.round((dueAt - Date.now()) / DAY_MS);
  if (days <= 0) return 'сейчас';
  if (days === 1) return 'завтра';
  return `через ${days} дн.`;
}
