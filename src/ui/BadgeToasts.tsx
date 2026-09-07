/**
 * Badge notifications.
 *
 * Progress that is invisible does not motivate. The store already knows the
 * moment a badge was earned; this watches for new ones and announces them, then
 * gets out of the way. Announced politely (`role="status"`) so a screen reader
 * hears it without losing the learner's place in the lecture.
 */

import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@/app/platform';
import { BADGES } from '@/engine/progress';

interface Toast {
  id: string;
  title: string;
  description: string;
  glyph: string;
}

const TOAST_MS = 6000;

export function BadgeToasts() {
  const progress = useProgress();
  const known = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const current = new Set(progress.badges.map((b) => b.id));

    // The first render establishes the baseline: badges earned in earlier
    // sessions must not all pop up at once when the app is reopened.
    if (known.current === null) {
      known.current = current;
      return;
    }

    const fresh = [...current].filter((id) => !known.current!.has(id));
    known.current = current;
    if (fresh.length === 0) return;

    const added = fresh
      .map((id) => BADGES.find((badge) => badge.id === id))
      .filter((badge): badge is (typeof BADGES)[number] => Boolean(badge))
      .map((badge) => ({ id: badge.id, title: badge.title, description: badge.description, glyph: badge.glyph }));

    setToasts((list) => [...list, ...added]);
    const timer = setTimeout(
      () => setToasts((list) => list.filter((toast) => !added.some((a) => a.id === toast.id))),
      TOAST_MS,
    );
    return () => clearTimeout(timer);
  }, [progress.badges]);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" role="status">
          <span className="toast__glyph" aria-hidden="true">
            {toast.glyph}
          </span>
          <span>
            <span className="toast__title">Награда: {toast.title}</span>
            <span className="toast__desc" style={{ display: 'block' }}>
              {toast.description}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
