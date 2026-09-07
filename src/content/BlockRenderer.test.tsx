import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { s } from '@/core/schema';
import { BlockRegistry, defineBlock, type BlockContext } from './registry';
import { BlockRenderer } from './BlockRenderer';

const ctx = (over: Partial<BlockContext> = {}): BlockContext => ({
  courseId: 'cyb',
  topicId: 'feedback',
  level: 1,
  reportInteraction: vi.fn(),
  isCompleted: () => false,
  ...over,
});

const registry = () =>
  new BlockRegistry()
    .register(
      defineBlock({
        type: 'prose',
        category: 'text',
        schema: s.object({ text: s.string({ min: 1 }) }),
        component: ({ props }) => <p>{props.text}</p>,
      }),
    )
    .register(
      defineBlock({
        type: 'group',
        category: 'layout',
        acceptsChildren: true,
        schema: s.object({ title: s.string() }),
        component: ({ props, children }) => (
          <section aria-label={props.title}>{children}</section>
        ),
      }),
    )
    .register(
      defineBlock({
        type: 'button',
        category: 'game',
        scorable: true,
        schema: s.object({}),
        component: ({ blockId, ctx: blockCtx }) => (
          <button onClick={() => blockCtx.reportInteraction({ blockId, score: 1 })}>go</button>
        ),
      }),
    );

describe('BlockRenderer', () => {
  it('renders a flat list of blocks', () => {
    render(
      <BlockRenderer
        registry={registry()}
        ctx={ctx()}
        nodes={[
          { id: 'a', type: 'prose', props: { text: 'первое' } },
          { id: 'b', type: 'prose', props: { text: 'второе' } },
        ]}
      />,
    );
    expect(screen.getByText('первое')).toBeInTheDocument();
    expect(screen.getByText('второе')).toBeInTheDocument();
  });

  it('renders children inside layout blocks', () => {
    render(
      <BlockRenderer
        registry={registry()}
        ctx={ctx()}
        nodes={[
          {
            id: 'g',
            type: 'group',
            props: { title: 'Раздел' },
            children: [{ id: 'a', type: 'prose', props: { text: 'внутри' } }],
          },
        ]}
      />,
    );
    expect(screen.getByRole('region', { name: 'Раздел' })).toContainElement(screen.getByText('внутри'));
  });

  it('shows an authoring error for an unknown block type instead of crashing', () => {
    render(<BlockRenderer registry={registry()} ctx={ctx()} nodes={[{ id: 'x', type: 'mystery' }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/mystery/);
  });

  it('shows an authoring error for invalid props', () => {
    render(
      <BlockRenderer registry={registry()} ctx={ctx()} nodes={[{ id: 'x', type: 'prose', props: {} }]} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/text/);
  });

  it('passes the block context through so a widget can report an interaction', async () => {
    const report = vi.fn();
    render(
      <BlockRenderer registry={registry()} ctx={ctx({ reportInteraction: report })} nodes={[{ id: 'g1', type: 'button' }]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(report).toHaveBeenCalledWith({ blockId: 'g1', score: 1 });
  });

  it('keeps rendering later blocks when one is broken', () => {
    render(
      <BlockRenderer
        registry={registry()}
        ctx={ctx()}
        nodes={[
          { id: 'x', type: 'mystery' },
          { id: 'ok', type: 'prose', props: { text: 'всё ещё здесь' } },
        ]}
      />,
    );
    expect(screen.getByText('всё ещё здесь')).toBeInTheDocument();
  });
});
