/**
 * Application entry point: build the platform, then hand it to the shell.
 *
 * Everything is constructed here and injected, so tests can assemble the same
 * platform with a different course, a smaller block registry or an in-memory
 * progress store without touching component code.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { CurriculumGraph } from './content/graph';
import { createBlockRegistry } from './content/blocks';
import { createQuestionRegistry } from './engine/questions';
import { ProgressStore, browserStorage } from './engine/progress';
import { courses } from './courses';
import './ui/styles.css';

const graph = new CurriculumGraph(courses);
const blocks = createBlockRegistry();
const questions = createQuestionRegistry();

const progress = new ProgressStore({
  storage: browserStorage(),
  badgeContext: () => ({
    spirals: Object.fromEntries(graph.courses.map((course) => [course.id, graph.spiralPath(course.id)])),
  }),
});

// Authoring safety net: in development a broken cross-reference or an invalid
// block prop is reported loudly in the console. In production the renderer
// degrades gracefully per block, so a mistake never blanks the page.
if (import.meta.env.DEV) {
  const issues = graph.validate();
  for (const course of courses) {
    for (const topic of course.topics) {
      for (const level of topic.levels) {
        for (const issue of blocks.validateTree(level.lecture.blocks)) {
          issues.push({ ...issue, path: `${course.id}/${topic.id}@${level.level}.${issue.path}` });
        }
      }
    }
  }
  if (issues.length > 0) {
    console.error(`Курс содержит ${issues.length} проблем(ы):`);
    for (const issue of issues) console.error(`  • ${issue.path}: ${issue.message}`);
  }
}

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App platform={{ graph, blocks, questions, progress }} />
  </StrictMode>,
);
