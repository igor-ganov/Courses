/**
 * Schemas for the 3D blocks live apart from their components.
 *
 * The registry needs a block's schema eagerly — to validate a lecture, estimate
 * its length and report authoring errors — but three.js is 600 kB that a text
 * lecture should not pay for. Splitting the schema out lets the definition be
 * registered at startup while the component arrives through `lazy`.
 */

import { s, type Infer } from '@/core/schema';

export const phaseSpaceSchema = s.object({
  title: s.withDefault(s.string(), 'Аттрактор Лоренца'),
  hint: s.optional(s.string()),
  showTwin: s.withDefault(s.boolean(), true),
  maxPoints: s.withDefault(s.number({ min: 500, max: 12000, int: true }), 4200),
});

export const landscapeSchema = s.object({
  title: s.withDefault(s.string(), 'Ландшафт устойчивости'),
  hint: s.optional(s.string()),
  resolution: s.withDefault(s.number({ min: 24, max: 96, int: true }), 60),
});

export type PhaseSpaceProps = Infer<typeof phaseSpaceSchema>;
export type LandscapeProps = Infer<typeof landscapeSchema>;
