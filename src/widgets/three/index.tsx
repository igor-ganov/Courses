/**
 * Lazy block definitions for the 3D scenes.
 *
 * The definitions (and their schemas) are registered at startup so validation
 * and time estimation work for every lecture; the three.js-bearing components
 * are fetched only when a lecture actually contains one. `heavy: true` makes the
 * renderer wrap them in Suspense, and the Workbox precache still includes the
 * chunk, so the first offline visit to a 3D lecture works.
 */

import { lazy } from 'react';
import { defineBlock } from '@/content/registry';
import { landscapeSchema, phaseSpaceSchema } from './schemas';

const PhaseSpace = lazy(() => import('./PhaseSpace'));
const Landscape = lazy(() => import('./Landscape'));

export const phaseSpaceBlock = defineBlock({
  type: 'three.phase-space',
  category: 'three-d',
  label: '3D: аттрактор Лоренца',
  description: 'Трёхмерная фазовая траектория и чувствительная зависимость от начальных условий.',
  schema: phaseSpaceSchema,
  component: PhaseSpace,
  scorable: true,
  heavy: true,
  cost: 6,
});

export const landscapeBlock = defineBlock({
  type: 'three.landscape',
  category: 'three-d',
  label: '3D: ландшафт устойчивости',
  description: 'Поверхность потенциала с впадинами: равновесия, бассейны притяжения, устойчивость.',
  schema: landscapeSchema,
  component: Landscape,
  scorable: true,
  heavy: true,
  cost: 6,
});

export const threeBlocks = [phaseSpaceBlock, landscapeBlock];
