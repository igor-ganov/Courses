/**
 * The block registry: the platform's single extension point for content.
 *
 * A block definition bundles everything the platform needs to know about one
 * kind of content: how to validate its props, how to render it, what it costs
 * in study minutes, and whether it can report a score. Adding a new interactive
 * widget — a simulation, a 3D scene, a drag-and-drop diagram, a mini-game — is
 * therefore a two-step job: write the component, call `defineBlock`, register
 * it. Course files then reference it by `type` string and nothing else changes.
 */

import type { ComponentType } from 'react';
import { err, ok, type Result, type Schema, type ValidationIssue } from '@/core/schema';
import type { BlockCategory, BlockNode } from './model';

/** Handed to every block component. */
export interface BlockViewProps<P = Record<string, unknown>> {
  /** Validated props from the course file. */
  props: P;
  /** The node's id, stable across renders; unique inside a lecture. */
  blockId: string;
  /** Children blocks, already rendered by the host. */
  children?: React.ReactNode;
  /** Context the host injects: where we are and how to report progress. */
  ctx: BlockContext;
}

export interface BlockContext {
  courseId: string;
  topicId: string;
  level: number;
  /**
   * Report that the learner did something worth crediting inside the block —
   * ran the simulation to its goal, solved the puzzle, watched the animation
   * through. The host converts this into XP and mastery.
   */
  reportInteraction(payload: BlockInteraction): void;
  /** Whether this block has already been credited. */
  isCompleted(blockId: string): boolean;
}

export interface BlockInteraction {
  blockId: string;
  /** 0..1 — how well it went; 1 for plain "done". */
  score?: number;
  /** Free-form detail kept for the learner's own review. */
  detail?: Record<string, unknown>;
}

export interface BlockDefinition<P = any> {
  type: string;
  category: BlockCategory;
  schema: Schema<P>;
  component: ComponentType<BlockViewProps<P>>;
  /** Human label for authoring tools and the block gallery. */
  label?: string;
  /** One-line description of what the block teaches or affords. */
  description?: string;
  /** Study minutes, fixed or derived from props. */
  cost?: number | ((props: P) => number);
  /** True when the block can emit a score (mini-games, simulations with goals). */
  scorable?: boolean;
  /** Layout blocks nest other blocks. */
  acceptsChildren?: boolean;
  /**
   * Heavy blocks (3D scenes) are code-split; the loader keeps them out of the
   * critical bundle while the service worker still precaches the chunk so they
   * work offline.
   */
  heavy?: boolean;
}

/**
 * Identity helper that pins the prop type of `component` to the schema's output,
 * so a mismatch between what a block validates and what it renders is a compile
 * error rather than a runtime surprise.
 */
export function defineBlock<P>(def: BlockDefinition<P>): BlockDefinition<P> {
  return def;
}

export class BlockRegistry {
  private definitions = new Map<string, BlockDefinition<any>>();

  register(def: BlockDefinition<any>, opts: { override?: boolean } = {}): this {
    if (this.definitions.has(def.type) && !opts.override) {
      throw new Error(
        `Block type "${def.type}" is already registered. Pass { override: true } if that is intended.`,
      );
    }
    this.definitions.set(def.type, def);
    return this;
  }

  registerAll(defs: readonly BlockDefinition<any>[], opts: { override?: boolean } = {}): this {
    for (const def of defs) this.register(def, opts);
    return this;
  }

  get(type: string): BlockDefinition<any> | undefined {
    return this.definitions.get(type);
  }

  has(type: string): boolean {
    return this.definitions.has(type);
  }

  list(): BlockDefinition<any>[] {
    return [...this.definitions.values()];
  }

  byCategory(category: BlockCategory): BlockDefinition<any>[] {
    return this.list().filter((d) => d.category === category);
  }

  /** A detached copy — used by tests and by plugin sandboxes. */
  clone(): BlockRegistry {
    const copy = new BlockRegistry();
    copy.definitions = new Map(this.definitions);
    return copy;
  }

  /** Validate one node's props against its definition, applying defaults. */
  parse(node: BlockNode): Result<{ node: BlockNode; def: BlockDefinition<any>; props: any }> {
    const def = this.definitions.get(node.type);
    if (!def) {
      return err([
        {
          path: node.id,
          message: `unknown block type "${node.type}" — register a definition for it first`,
          code: 'type',
        },
      ]);
    }
    const parsed = def.schema.parse(node.props ?? {}, node.id);
    if (!parsed.ok) return err(parsed.errors);
    return ok({ node, def, props: parsed.value });
  }

  /** Validate a whole lecture tree; returns every issue found. */
  validateTree(blocks: readonly BlockNode[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const seen = new Set<string>();

    const walk = (nodes: readonly BlockNode[]) => {
      for (const node of nodes) {
        if (seen.has(node.id)) {
          issues.push({ path: node.id, message: `duplicate block id "${node.id}"`, code: 'custom' });
        }
        seen.add(node.id);

        const res = this.parse(node);
        if (!res.ok) {
          issues.push(...res.errors);
          continue;
        }
        const { def } = res.value;
        if (node.children?.length) {
          if (!def.acceptsChildren) {
            issues.push({
              path: node.id,
              message: `block type "${node.type}" does not accept children`,
              code: 'custom',
            });
          }
          walk(node.children);
        }
      }
    };

    walk(blocks);
    return issues;
  }

  /** Rough study time for a tree, in whole minutes. */
  estimateMinutes(blocks: readonly BlockNode[]): number {
    let total = 0;
    const walk = (nodes: readonly BlockNode[]) => {
      for (const node of nodes) {
        const res = this.parse(node);
        if (res.ok) {
          const { def, props } = res.value;
          total += typeof def.cost === 'function' ? def.cost(props) : (def.cost ?? 0);
        }
        if (node.children) walk(node.children);
      }
    };
    walk(blocks);
    return Math.round(total);
  }

  /** Every scorable block id in a tree — the denominator for level completion. */
  scorableBlockIds(blocks: readonly BlockNode[]): string[] {
    const out: string[] = [];
    const walk = (nodes: readonly BlockNode[]) => {
      for (const node of nodes) {
        if (this.definitions.get(node.type)?.scorable) out.push(node.id);
        if (node.children) walk(node.children);
      }
    };
    walk(blocks);
    return out;
  }
}
