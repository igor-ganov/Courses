/**
 * Wire the loop yourself.
 *
 * Recognising a diagram is not the same as being able to draw one. Here the
 * boxes are given and the arrows are not: the learner clicks a source and then a
 * target to lay a connection, and the validator answers with the specific
 * consequence of what is missing ("the sensor measures nothing", "the loop is
 * open") rather than a red cross. Score is proportional, so a nearly-right
 * answer reads as nearly right.
 */

import { useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { Readout, WidgetShell, useGoal } from './common';
import {
  CANONICAL_LOOP,
  PALETTE,
  addEdge,
  removeEdge,
  validateLoop,
  type LoopEdge,
} from './models/loopBuilder';

const schema = s.object({
  title: s.withDefault(s.string(), 'Соберите контур'),
  hint: s.optional(s.string()),
  goalText: s.withDefault(s.string(), 'замкнуть контур управления правильными связями'),
  /** Start with some connections already made, e.g. for a partial exercise. */
  preset: s.withDefault(s.array(s.string()), () => []),
});

type Props = Infer<typeof schema>;

const SCALE = { x: 21, y: 46, offX: 9, offY: 14 };
const BOX_W = 17;
const BOX_H = 10;

const toPoint = (node: { x: number; y: number }) => ({
  x: SCALE.offX + node.x * SCALE.x,
  y: SCALE.offY + node.y * SCALE.y,
});

function LoopBuilder({ props, ctx, blockId }: BlockViewProps<Props>) {
  const nodes = CANONICAL_LOOP.nodes;
  const [edges, setEdges] = useState<LoopEdge[]>(() =>
    props.preset
      .map((raw) => {
        const [from, to] = raw.split('>');
        return { from, to };
      })
      .filter((e) => e.from && e.to),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const { done, reach } = useGoal(ctx, blockId);

  const result = useMemo(() => validateLoop(nodes, edges), [nodes, edges]);

  const pick = (id: string) => {
    setChecked(false);
    if (pending === null) {
      setPending(id);
      return;
    }
    if (pending === id) {
      setPending(null);
      return;
    }
    const edge = { from: pending, to: id };
    const exists = edges.some((e) => e.from === edge.from && e.to === edge.to);
    setEdges(exists ? removeEdge(edges, edge) : addEdge(edges, edge));
    setPending(null);
  };

  const check = () => {
    setChecked(true);
    if (result.closed) reach(1, { edges });
    else if (result.score > 0) reach(result.score, { edges });
  };

  const palette = new Map(PALETTE.map((p) => [p.kind, p]));

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Нажмите на источник, затем на приёмник — появится стрелка. Повторное нажатие удаляет связь.'}
      goal={{ text: props.goalText, done: done || result.closed }}
      badge={<span className={`pill pill--${result.closed ? 'ok' : 'accent'}`}>связей: {edges.length}</span>}
      readouts={
        <>
          <Readout label="Правильных связей" value={`${CANONICAL_LOOP.edges.length - result.missing.length} из ${CANONICAL_LOOP.edges.length}`} />
          <Readout label="Лишних" value={result.extra.length} tone={result.extra.length ? 'warn' : 'good'} />
          <Readout
            label="Контур"
            value={result.closed ? 'замкнут' : 'разомкнут'}
            tone={result.closed ? 'good' : 'warn'}
          />
        </>
      }
      note={
        checked ? (
          result.closed ? (
            <span style={{ color: 'var(--ok)' }}>
              Контур замкнут. Сигнал идёт по кругу: цель задаёт норму, датчик приносит факт, компаратор превращает
              разницу в действие — и так без конца, пока разница не исчезнет.
            </span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {result.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )
        ) : (
          pending
            ? `Выбран «${nodes.find((n) => n.id === pending)?.label}». Теперь укажите, куда идёт сигнал.`
            : palette.get(nodes[0].kind)?.description
        )
      }
      controls={
        <div className="widget__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={check}>
            Проверить
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => { setEdges([]); setChecked(false); setPending(null); }}>
            Очистить
          </button>
        </div>
      }
    >
      <svg
        className="widget__canvas"
        viewBox="0 0 105 130"
        role="group"
        aria-label="Холст для сборки контура управления"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="lb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#7c6cff" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.from);
          const to = nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          const a = toPoint(from);
          const b = toPoint(to);
          const wrong = checked && result.extra.some((e) => e.from === edge.from && e.to === edge.to);
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + (a.y === b.y ? -9 : 0)} ${b.x} ${b.y}`}
              fill="none"
              stroke={wrong ? '#ff6b6b' : '#7c6cff'}
              strokeWidth={0.9}
              markerEnd="url(#lb-arrow)"
              opacity={0.9}
            />
          );
        })}

        {checked &&
          result.missing.map((edge) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            const a = toPoint(from);
            const b = toPoint(to);
            return (
              <path
                key={`missing-${edge.from}-${edge.to}`}
                d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                stroke="#ffb545"
                strokeWidth={0.5}
                strokeDasharray="1.5 1.5"
                opacity={0.5}
                fill="none"
              />
            );
          })}

        {nodes.map((node) => {
          const point = toPoint(node);
          const item = palette.get(node.kind);
          const selected = pending === node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${point.x - BOX_W / 2} ${point.y - BOX_H / 2})`}
              onClick={() => pick(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  pick(node.id);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${node.label}. ${item?.description ?? ''}`}
              aria-pressed={selected}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={BOX_W}
                height={BOX_H}
                rx={2.2}
                fill={selected ? '#241f4d' : '#121a2c'}
                stroke={selected ? '#7c6cff' : '#2a3550'}
                strokeWidth={selected ? 0.9 : 0.5}
              />
              <text x={BOX_W / 2} y={4.6} textAnchor="middle" fontSize={3.4} fill="#8b96b5" style={{ pointerEvents: 'none' }}>
                {item?.glyph}
              </text>
              <text x={BOX_W / 2} y={8.2} textAnchor="middle" fontSize={2.7} fill="#dbe2f2" style={{ pointerEvents: 'none' }}>
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </WidgetShell>
  );
}

export const loopBuilderBlock = defineBlock({
  type: 'builder.control-loop',
  category: 'game',
  label: 'Сборка контура',
  description: 'Учащийся сам соединяет блоки регулятора; валидатор объясняет последствия каждой ошибки.',
  schema,
  component: LoopBuilder,
  scorable: true,
  cost: 5,
});
