/**
 * Offline status.
 *
 * The whole platform is precached, so losing connectivity changes nothing about
 * what the learner can do — which is exactly why it is worth saying out loud.
 * Silence would read as breakage; a calm "офлайн — всё работает" reads as a
 * promise kept.
 */

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <span className="pill pill--warn" role="status">
      офлайн — всё работает
    </span>
  );
}
