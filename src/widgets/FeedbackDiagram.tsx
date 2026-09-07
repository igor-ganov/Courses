/**
 * A block diagram you can touch.
 *
 * Textbook control diagrams are static and, for a beginner, unreadable: six
 * boxes and some arrows, with all the meaning in the caption. Here each node is
 * a target — hover or tap it and the explanation appears in place, while a pulse
 * travels the loop so the *direction* of causation is visible rather than
 * implied. Clicking every node is what marks the block done: the learner has to
 * have looked at each part.
 */

import { useEffect, useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { WidgetShell, useAnimationFrame, useGoal } from './common';

const nodeSchema = s.object({
  id: s.string({ min: 1 }),
  label: s.string({ min: 1 }),
  detail: s.string({ min: 1 }),
  x: s.number(),
  y: s.number(),
  /** Visual emphasis: the comparator and the plant carry the argument. */
  accent: s.withDefault(s.boolean(), false),
});

const schema = s.object({
  title: s.withDefault(s.string(), 'Анатомия контура'),
  hint: s.optional(s.string()),
  nodes: s.optional(s.array(nodeSchema, { min: 2 })),
  /** Edges as `from>to`; `from>to!` marks the feedback path. */
  edges: s.optional(s.array(s.string({ min: 3 }))),
  animate: s.withDefault(s.boolean(), true),
});

type Props = Infer<typeof schema>;
type DiagramNode = Infer<typeof nodeSchema>;

/** The canonical single-loop regulator, laid out on a 100×46 grid. */
const DEFAULT_NODES: DiagramNode[] = [
  { id: 'goal', label: 'Уставка', detail: 'Значение, которое мы объявили желаемым. Без цели нет и рассогласования — система просто ведёт себя как ведёт.', x: 8, y: 14, accent: false },
  { id: 'comparator', label: 'Компаратор', detail: 'Вычитает измеренное из желаемого. Именно здесь рождается ошибка — единственная величина, на которую вообще реагирует регулятор.', x: 26, y: 14, accent: true },
  { id: 'controller', label: 'Регулятор', detail: 'Решает, что делать с ошибкой: реагировать пропорционально, учитывать накопленное или предсказывать по скорости изменения.', x: 46, y: 14, accent: true },
  { id: 'actuator', label: 'Исполнитель', detail: 'Превращает решение в физическое воздействие. У него есть предел: нагреватель не греет сильнее максимума, руль не поворачивается за упор.', x: 66, y: 14, accent: false },
  { id: 'plant', label: 'Объект', detail: 'То, чем управляют. Обладает инерцией: воздействие сегодня даёт эффект через некоторое время, и это время определяет всё поведение контура.', x: 86, y: 14, accent: true },
  { id: 'sensor', label: 'Датчик', detail: 'Возвращает состояние объекта обратно в контур. Он шумит и запаздывает, поэтому регулятор управляет не объектом, а своим представлением о нём.', x: 56, y: 38, accent: true },
  { id: 'disturbance', label: 'Возмущение', detail: 'Всё, что действует на объект помимо нас: открытое окно, встречный ветер, изменившийся спрос. Контур обычно не видит его напрямую — только его последствия.', x: 86, y: 2, accent: false },
];

const DEFAULT_EDGES = [
  'goal>comparator',
  'comparator>controller',
  'controller>actuator',
  'actuator>plant',
  'disturbance>plant',
  'plant>sensor!',
  'sensor>comparator!',
];

const NODE_W = 15;
const NODE_H = 9;

function FeedbackDiagram({ props, ctx, blockId }: BlockViewProps<Props>) {
  const nodes = props.nodes ?? DEFAULT_NODES;
  const edges = props.edges ?? DEFAULT_EDGES;

  const [active, setActive] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [pulse, setPulse] = useState(0);
  const { done, reach } = useGoal(ctx, blockId);

  useAnimationFrame((delta) => setPulse((p) => (p + delta / 5200) % 1), props.animate);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const parsedEdges = useMemo(
    () =>
      edges.map((raw) => {
        const feedback = raw.endsWith('!');
        const [from, to] = raw.replace(/!$/, '').split('>');
        return { from, to, feedback };
      }),
    [edges],
  );

  useEffect(() => {
    if (!done && seen.size === nodes.length) reach(1, { inspected: [...seen] });
  }, [seen, nodes.length, done, reach]);

  const inspect = (id: string) => {
    setActive(id);
    setSeen((current) => (current.has(id) ? current : new Set([...current, id])));
  };

  const detail = active ? byId.get(active) : null;

  // The travelling pulse walks the forward path then the feedback path.
  const loopPath = parsedEdges.filter((e) => byId.has(e.from) && byId.has(e.to));
  const segment = loopPath[Math.floor(pulse * loopPath.length) % Math.max(1, loopPath.length)];
  const segmentProgress = (pulse * loopPath.length) % 1;
  const pulsePoint = segment
    ? {
        x: lerp(byId.get(segment.from)!.x, byId.get(segment.to)!.x, segmentProgress),
        y: lerp(byId.get(segment.from)!.y, byId.get(segment.to)!.y, segmentProgress),
      }
    : null;

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Нажмите на каждый блок, чтобы узнать, за что он отвечает.'}
      badge={
        <span className={`pill pill--${seen.size === nodes.length ? 'ok' : 'accent'}`}>
          изучено {seen.size} из {nodes.length}
        </span>
      }
      note={
        detail ? (
          <>
            <strong>{detail.label}. </strong>
            {detail.detail}
          </>
        ) : (
          'Сигнал бежит по кругу: цель → рассогласование → решение → воздействие → объект → измерение → снова рассогласование.'
        )
      }
    >
      <svg
        className="widget__canvas"
        viewBox="0 0 100 48"
        role="group"
        aria-label="Схема контура управления с обратной связью"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="fd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a6a92" />
          </marker>
          <marker id="fd-arrow-fb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#35e0d0" />
          </marker>
        </defs>

        {parsedEdges.map(({ from, to, feedback }) => {
          const a = byId.get(from);
          const b = byId.get(to);
          if (!a || !b) return null;
          return (
            <path
              key={`${from}-${to}`}
              d={edgePath(a, b)}
              fill="none"
              stroke={feedback ? '#35e0d0' : '#5a6a92'}
              strokeWidth={0.55}
              strokeDasharray={feedback ? '1.6 1.1' : undefined}
              markerEnd={`url(#${feedback ? 'fd-arrow-fb' : 'fd-arrow'})`}
            />
          );
        })}

        {pulsePoint && props.animate && (
          <circle cx={pulsePoint.x} cy={pulsePoint.y} r={1.15} fill="#ffb545">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
          </circle>
        )}

        {nodes.map((node) => {
          const isActive = active === node.id;
          const isSeen = seen.has(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x - NODE_W / 2} ${node.y - NODE_H / 2})`}
              onPointerEnter={() => inspect(node.id)}
              onFocus={() => inspect(node.id)}
              onClick={() => inspect(node.id)}
              tabIndex={0}
              role="button"
              aria-label={`${node.label}: ${node.detail}`}
              aria-pressed={isActive}
              style={{ cursor: 'pointer' }}
            >
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={2}
                fill={isActive ? '#1f2a48' : node.accent ? '#151d33' : '#111827'}
                stroke={isActive ? '#7c6cff' : isSeen ? '#35e0d0' : '#2a3550'}
                strokeWidth={isActive ? 0.7 : 0.45}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 1.1}
                textAnchor="middle"
                fontSize={2.7}
                fill={isActive ? '#e8ecf7' : '#c3cce3'}
                style={{ pointerEvents: 'none' }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </WidgetShell>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Straight where possible, gently curved for the feedback path underneath. */
function edgePath(a: DiagramNode, b: DiagramNode): string {
  const sameRow = Math.abs(a.y - b.y) < 2;
  if (sameRow) {
    const from = a.x + NODE_W / 2;
    const to = b.x - NODE_W / 2;
    return `M ${from} ${a.y} L ${to} ${b.y}`;
  }
  const start = { x: a.x, y: a.y + (b.y > a.y ? NODE_H / 2 : -NODE_H / 2) };
  const end = { x: b.x, y: b.y + (b.y > a.y ? -NODE_H / 2 : NODE_H / 2) };
  const midY = (start.y + end.y) / 2;
  return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
}

export const feedbackDiagramBlock = defineBlock({
  type: 'diagram.feedback-loop',
  category: 'diagram',
  label: 'Тактильная схема контура',
  description: 'Блок-схема, где каждый узел раскрывает свою роль, а по контуру бежит сигнал.',
  schema,
  component: FeedbackDiagram,
  scorable: true,
  cost: 3,
});
