/**
 * The platform context: the four registries/services every screen needs.
 *
 * Keeping these in context rather than importing singletons is what lets tests
 * mount a single lecture with a three-block registry and a memory-backed
 * progress store, and lets a future "author preview" mode swap the curriculum
 * for a draft without touching component code.
 */

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { CurriculumGraph } from '@/content/graph';
import type { BlockRegistry } from '@/content/registry';
import type { QuestionRegistry } from '@/engine/assessment';
import type { ProgressState, ProgressStore } from '@/engine/progress';

export interface Platform {
  graph: CurriculumGraph;
  blocks: BlockRegistry;
  questions: QuestionRegistry;
  progress: ProgressStore;
}

const PlatformContext = createContext<Platform | null>(null);

export function PlatformProvider({ value, children }: { value: Platform; children: ReactNode }) {
  const memo = useMemo(() => value, [value]);
  return <PlatformContext.Provider value={memo}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): Platform {
  const platform = useContext(PlatformContext);
  if (!platform) throw new Error('usePlatform must be used inside <PlatformProvider>');
  return platform;
}

/** Subscribe a component to the progress store. */
export function useProgress(): ProgressState {
  const { progress } = usePlatform();
  return useSyncExternalStore(progress.subscribe, progress.getSnapshot, progress.getSnapshot);
}
