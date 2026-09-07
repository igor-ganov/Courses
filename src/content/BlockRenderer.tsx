/**
 * Renders a lecture tree.
 *
 * The renderer is deliberately forgiving: a block with bad props degrades into a
 * visible authoring error card and the rest of the lecture still renders. A
 * learner offline on a train should never lose a whole page to one typo, and an
 * author should see exactly which prop is wrong.
 */

import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { formatIssues, type ValidationIssue } from '@/core/schema';
import type { BlockNode } from './model';
import type { BlockContext, BlockRegistry } from './registry';

export interface BlockRendererProps {
  nodes: readonly BlockNode[];
  registry: BlockRegistry;
  ctx: BlockContext;
}

export function BlockRenderer({ nodes, registry, ctx }: BlockRendererProps) {
  return (
    <>
      {nodes.map((node) => (
        <BlockSlot key={node.id} node={node} registry={registry} ctx={ctx} />
      ))}
    </>
  );
}

function BlockSlot({ node, registry, ctx }: { node: BlockNode; registry: BlockRegistry; ctx: BlockContext }) {
  const parsed = registry.parse(node);
  if (!parsed.ok) return <AuthoringError blockId={node.id} issues={parsed.errors} />;

  const { def, props } = parsed.value;
  const Component_ = def.component;
  const children = node.children?.length ? (
    <BlockRenderer nodes={node.children} registry={registry} ctx={ctx} />
  ) : undefined;

  const element = (
    <Component_ props={props} blockId={node.id} ctx={ctx}>
      {children}
    </Component_>
  );

  return (
    <BlockErrorBoundary blockId={node.id}>
      {def.heavy ? <Suspense fallback={<BlockSkeleton label={def.label ?? def.type} />}>{element}</Suspense> : element}
    </BlockErrorBoundary>
  );
}

function AuthoringError({ blockId, issues }: { blockId: string; issues: ValidationIssue[] }) {
  return (
    <div className="block-error" role="alert">
      <strong>Блок «{blockId}» не отрисован</strong>
      <pre>{formatIssues(issues)}</pre>
    </div>
  );
}

function BlockSkeleton({ label }: { label: string }) {
  return (
    <div className="block-skeleton" aria-busy="true" aria-label={`Загружается: ${label}`}>
      <span className="block-skeleton__pulse" />
      <span>Загружается {label}…</span>
    </div>
  );
}

/** One misbehaving widget must not take down the lecture around it. */
class BlockErrorBoundary extends Component<
  { blockId: string; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Block "${this.props.blockId}" crashed`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="block-error" role="alert">
          <strong>Блок «{this.props.blockId}» упал при отрисовке</strong>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
