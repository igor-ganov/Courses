import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plot, Slider, Switch, WidgetShell, niceTicks, useGoal } from './index';
import type { BlockContext } from '@/content/registry';

const ctx = (over: Partial<BlockContext> = {}): BlockContext => ({
  courseId: 'cyb',
  topicId: 't',
  level: 1,
  reportInteraction: vi.fn(),
  isCompleted: () => false,
  ...over,
});

describe('niceTicks', () => {
  it('produces round numbers inside the domain', () => {
    expect(niceTicks(0, 1, 4)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('survives a degenerate domain', () => {
    expect(niceTicks(3, 3, 4)).toEqual([3]);
    expect(niceTicks(Number.NaN, 1, 4)).toHaveLength(1);
  });
});

describe('WidgetShell', () => {
  it('labels the region and shows the title, hint and readouts', () => {
    render(
      <WidgetShell title="Контур" hint="Крутите ручки" readouts={<span>ошибка 0,1</span>}>
        <p>тело</p>
      </WidgetShell>,
    );
    expect(screen.getByRole('region', { name: 'Контур' })).toBeInTheDocument();
    expect(screen.getByText('Крутите ручки')).toBeInTheDocument();
    expect(screen.getByText('ошибка 0,1')).toBeInTheDocument();
  });

  it('announces goal state as a live region', () => {
    const { rerender } = render(
      <WidgetShell title="W" goal={{ text: 'удержать', done: false }}>
        <p />
      </WidgetShell>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Задача: удержать');
    rerender(
      <WidgetShell title="W" goal={{ text: 'удержать', done: true }}>
        <p />
      </WidgetShell>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Задача выполнена');
  });
});

describe('Slider', () => {
  it('reports changes and formats its value', () => {
    const onChange = vi.fn();
    render(
      <Slider label="Усиление" value={2} min={0} max={10} step={1} onChange={onChange} format={(v) => `${v}×`} />,
    );
    expect(screen.getByText('2×')).toBeInTheDocument();
    // jsdom does not implement arrow-key stepping on range inputs, so drive the
    // change event directly — the component contract is "parse and report".
    fireEvent.change(screen.getByLabelText('Усиление'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith(7);
  });
});

describe('Switch', () => {
  it('toggles', async () => {
    const onChange = vi.fn();
    render(<Switch label="Замкнуть контур" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText('Замкнуть контур'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Plot', () => {
  it('renders one polyline per series with an accessible label', () => {
    const { container } = render(
      <Plot
        ariaLabel="Переходный процесс"
        series={[
          { label: 'y', color: '#0f0', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
          { label: 'u', color: '#f00', points: [{ x: 0, y: 1 }, { x: 1, y: 0 }] },
        ]}
        xDomain={[0, 1]}
        yDomain={[0, 1]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Переходный процесс' })).toBeInTheDocument();
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
  });

  it('draws a reference line when one is given', () => {
    const { container } = render(
      <Plot
        ariaLabel="p"
        series={[]}
        xDomain={[0, 1]}
        yDomain={[0, 2]}
        reference={{ y: 1, label: 'уставка', band: 0.05 }}
      />,
    );
    expect(container.querySelector('text[fill="#4ade80"]')).toHaveTextContent('уставка');
  });
});

describe('useGoal', () => {
  const Probe = ({ context }: { context: BlockContext }) => {
    const { done, reach } = useGoal(context, 'b1');
    return (
      <button type="button" onClick={() => reach(0.9)}>
        {done ? 'готово' : 'достичь'}
      </button>
    );
  };

  it('reports the interaction once, no matter how often the goal is reached', async () => {
    const report = vi.fn();
    render(<Probe context={ctx({ reportInteraction: report })} />);
    const button = screen.getByRole('button');
    await userEvent.click(button);
    await userEvent.click(button);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ blockId: 'b1', score: 0.9, detail: undefined });
    expect(button).toHaveTextContent('готово');
  });

  it('starts done and stays silent when the block was completed earlier', async () => {
    const report = vi.fn();
    render(<Probe context={ctx({ isCompleted: () => true, reportInteraction: report })} />);
    expect(screen.getByRole('button')).toHaveTextContent('готово');
    await userEvent.click(screen.getByRole('button'));
    expect(report).not.toHaveBeenCalled();
  });
});
