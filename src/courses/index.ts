/**
 * The course catalogue.
 *
 * Adding a course means writing its data and listing it here. Everything else —
 * routing, the map, the spiral, unlock gating, progress, the review queue — is
 * derived from the curriculum graph.
 */

import type { Course } from '@/content/model';
import { cybernetics101 } from './cybernetics-101';

export const courses: readonly Course[] = [cybernetics101];
