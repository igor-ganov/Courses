/**
 * The application shell.
 *
 * Hash routing, deliberately: the app is deployed to GitHub Pages and installed
 * as a standalone/TWA app, and a hash route always resolves from the cache with
 * no server rewrite rules. That matters when the "server" is a service worker on
 * a train.
 */

import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { PlatformProvider, useProgress, type Platform } from './platform';
import { rankFromXp } from '@/engine/progress';
import { HomePage } from '@/ui/pages/HomePage';
import { CoursePage } from '@/ui/pages/CoursePage';
import { LevelPage } from '@/ui/pages/LevelPage';
import { ProgressPage } from '@/ui/pages/ProgressPage';
import { BlockGalleryPage } from '@/ui/pages/BlockGalleryPage';
import { NotFoundPage } from '@/ui/pages/NotFoundPage';
import { BadgeToasts } from '@/ui/BadgeToasts';
import { OfflineIndicator } from '@/ui/OfflineIndicator';

export function App({ platform }: { platform: Platform }) {
  return (
    <PlatformProvider value={platform}>
      <HashRouter>
        <div className="app">
          <TopBar />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/course/:courseId" element={<CoursePage />} />
              <Route path="/course/:courseId/:topicId/:level" element={<LevelPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/blocks" element={<BlockGalleryPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <BadgeToasts />
        </div>
      </HashRouter>
    </PlatformProvider>
  );
}

function TopBar() {
  const progress = useProgress();
  const rank = rankFromXp(progress.xp);
  const percent = rank.needed > 0 ? Math.min(100, (rank.into / rank.needed) * 100) : 100;

  return (
    <header className="topbar">
      <Link className="topbar__brand" to="/">
        <span className="topbar__mark" aria-hidden="true">
          ↻
        </span>
        Cybernetica
      </Link>

      <nav className="topbar__nav" aria-label="Основная навигация">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
        >
          Курсы
        </NavLink>
        <NavLink
          to="/blocks"
          className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
        >
          Компоненты
        </NavLink>
        <OfflineIndicator />
        {progress.streak.current > 0 && (
          <span className="xp__streak" title={`Дней подряд: ${progress.streak.current}`}>
            🔥 {progress.streak.current}
          </span>
        )}
        <Link className="xp" to="/progress" aria-label={`Прогресс: ${rank.title}, ${progress.xp} опыта`}>
          <span className="xp__rank" aria-hidden="true">
            {rank.rank}
          </span>
          <span className="xp__meta">
            <span className="xp__title">{rank.title}</span>
            <span className="xp__bar">
              <span className="xp__fill" style={{ width: `${percent}%` }} />
            </span>
          </span>
        </Link>
      </nav>
    </header>
  );
}
