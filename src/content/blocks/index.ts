/**
 * The block library, assembled.
 *
 * This is the one file that has to change when a new interactive component is
 * added to the platform: write the component, `defineBlock` it, list it here.
 * Course files then use it by `type` string, the renderer picks it up, the
 * validator checks its props, and progress accounting works — with no further
 * wiring anywhere.
 */

import { BlockRegistry, type BlockDefinition } from '../registry';
import { textBlocks } from './text';
import { learningBlocks } from './learning';
import { controlLoopLabBlock } from '@/widgets/ControlLoopLab';
import { feedbackDiagramBlock } from '@/widgets/FeedbackDiagram';
import { phasePlaneBlock } from '@/widgets/PhasePlane';
import { loopBuilderBlock } from '@/widgets/LoopBuilder';
import { blackBoxBlock, requisiteVarietyBlock, varietyExplosionBlock } from '@/widgets/AshbyWidgets';
import { channelLabBlock, entropyLabBlock } from '@/widgets/InformationWidgets';
import { automatonBlock, lifeBlock } from '@/widgets/EmergenceWidgets';
import { threeBlocks } from '@/widgets/three';

export const interactiveBlocks: readonly BlockDefinition<any>[] = [
  controlLoopLabBlock,
  feedbackDiagramBlock,
  phasePlaneBlock,
  loopBuilderBlock,
  requisiteVarietyBlock,
  blackBoxBlock,
  varietyExplosionBlock,
  entropyLabBlock,
  channelLabBlock,
  automatonBlock,
  lifeBlock,
  ...threeBlocks,
];

export const allBlocks: readonly BlockDefinition<any>[] = [
  ...textBlocks,
  ...learningBlocks,
  ...interactiveBlocks,
];

/** A fresh registry with the full library. Tests build their own. */
export function createBlockRegistry(): BlockRegistry {
  return new BlockRegistry().registerAll(allBlocks);
}
