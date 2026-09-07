/**
 * The wiring exercise: drag the parts of a control loop onto a canvas and
 * connect them until the loop closes.
 *
 * Naming the blocks of a feedback loop is easy; getting the *direction* of every
 * arrow right is where the understanding actually lives. A learner who wires the
 * sensor into the actuator has drawn a plausible-looking diagram that cannot
 * regulate anything, and the validator says exactly that.
 */

export type NodeKind =
  | 'goal'
  | 'comparator'
  | 'controller'
  | 'actuator'
  | 'plant'
  | 'sensor'
  | 'disturbance';

export interface LoopNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Canvas position in arbitrary units; the view scales them. */
  x: number;
  y: number;
}

export interface LoopEdge {
  from: string;
  to: string;
}

export interface PaletteItem {
  kind: NodeKind;
  label: string;
  glyph: string;
  description: string;
}

export const PALETTE: readonly PaletteItem[] = [
  {
    kind: 'goal',
    label: 'Уставка',
    glyph: '◎',
    description: 'Желаемое значение. Ни одна система не «стремится» никуда, пока цель не задана явно.',
  },
  {
    kind: 'comparator',
    label: 'Компаратор',
    glyph: '⊖',
    description: 'Вычитает измеренное из желаемого и выдаёт рассогласование — единственный вход контроллера.',
  },
  {
    kind: 'controller',
    label: 'Регулятор',
    glyph: '⚙',
    description: 'Превращает рассогласование в решение о действии. Здесь живут P, I и D.',
  },
  {
    kind: 'actuator',
    label: 'Исполнитель',
    glyph: '⤒',
    description: 'Переводит решение в физическое воздействие: нагреватель, клапан, мотор.',
  },
  {
    kind: 'plant',
    label: 'Объект',
    glyph: '▣',
    description: 'То, чем управляют: комната, тело, экономика. Обладает инерцией и своей динамикой.',
  },
  {
    kind: 'sensor',
    label: 'Датчик',
    glyph: '◉',
    description: 'Возвращает состояние объекта в контур. Врёт, шумит и запаздывает — и этим определяет предел управления.',
  },
  {
    kind: 'disturbance',
    label: 'Возмущение',
    glyph: '⚡',
    description: 'Внешнее воздействие на объект, которое контур не выбирает и обычно не видит напрямую.',
  },
];

export interface LoopSpec {
  nodes: LoopNode[];
  edges: LoopEdge[];
}

/** The reference answer: the textbook single-loop regulator. */
export const CANONICAL_LOOP: LoopSpec = {
  nodes: [
    { id: 'goal', kind: 'goal', label: 'Уставка', x: 0, y: 1 },
    { id: 'comparator', kind: 'comparator', label: 'Компаратор', x: 1, y: 1 },
    { id: 'controller', kind: 'controller', label: 'Регулятор', x: 2, y: 1 },
    { id: 'actuator', kind: 'actuator', label: 'Исполнитель', x: 3, y: 1 },
    { id: 'plant', kind: 'plant', label: 'Объект', x: 4, y: 1 },
    { id: 'sensor', kind: 'sensor', label: 'Датчик', x: 3, y: 2.2 },
    { id: 'disturbance', kind: 'disturbance', label: 'Возмущение', x: 4, y: 0 },
  ],
  edges: [
    { from: 'goal', to: 'comparator' },
    { from: 'comparator', to: 'controller' },
    { from: 'controller', to: 'actuator' },
    { from: 'actuator', to: 'plant' },
    { from: 'plant', to: 'sensor' },
    { from: 'sensor', to: 'comparator' },
  ],
};

/** Edges that are allowed but not required — they cost nothing if present. */
const OPTIONAL_EDGES: readonly LoopEdge[] = [{ from: 'disturbance', to: 'plant' }];

const sameEdge = (a: LoopEdge, b: LoopEdge) => a.from === b.from && a.to === b.to;

export function addEdge(edges: readonly LoopEdge[], edge: LoopEdge): LoopEdge[] {
  if (edge.from === edge.to) return [...edges];
  if (edges.some((e) => sameEdge(e, edge))) return [...edges];
  return [...edges, edge];
}

export function removeEdge(edges: readonly LoopEdge[], edge: LoopEdge): LoopEdge[] {
  return edges.filter((e) => !sameEdge(e, edge));
}

export interface LoopValidation {
  closed: boolean;
  issues: string[];
  /** 0..1, suitable for grading the exercise as a `goal` question. */
  score: number;
  missing: LoopEdge[];
  extra: LoopEdge[];
}

/** Diagnostics keyed by the required edge that is missing. */
const DIAGNOSTICS: Record<string, string> = {
  'goal→comparator': 'Цель никуда не подана: компаратору не с чем сравнивать.',
  'comparator→controller': 'Рассогласование не доходит до регулятора — он управляет вслепую.',
  'controller→actuator': 'Решение регулятора не превращается в действие.',
  'actuator→plant': 'Исполнитель ни на что не воздействует.',
  'plant→sensor': 'Датчик ничего не измеряет: состояние объекта в контур не попадает.',
  'sensor→comparator': 'Контур разомкнут: обратная связь не возвращается в компаратор.',
};

export function validateLoop(
  nodes: readonly LoopNode[],
  edges: readonly LoopEdge[],
  target: LoopSpec = CANONICAL_LOOP,
): LoopValidation {
  const present = new Set(nodes.map((n) => n.id));
  const required = target.edges.filter((e) => present.has(e.from) && present.has(e.to));

  const missing = required.filter((req) => !edges.some((e) => sameEdge(e, req)));
  const allowed = [...target.edges, ...OPTIONAL_EDGES];
  const extra = edges.filter((e) => !allowed.some((a) => sameEdge(a, e)));

  const issues: string[] = [];
  for (const edge of missing) {
    issues.push(DIAGNOSTICS[`${edge.from}→${edge.to}`] ?? `Не хватает связи ${edge.from} → ${edge.to}.`);
  }
  if (extra.length > 0) {
    issues.push(
      `Лишние связи: ${extra.map((e) => `${e.from} → ${e.to}`).join(', ')}. В рабочем контуре сигнал ходит по одному кругу.`,
    );
  }

  const hits = required.length - missing.length;
  const denominator = required.length + extra.length;
  const score = denominator === 0 ? 0 : Math.max(0, hits / denominator);

  return { closed: missing.length === 0 && extra.length === 0, issues, score, missing, extra };
}

/**
 * Walk the loop from the goal for the travelling-signal animation, stopping at
 * the first break or when the loop closes back on the comparator.
 */
export function describeSignalPath(edges: readonly LoopEdge[], start = 'goal'): string[] {
  const path: string[] = [start];
  const visited = new Set<string>();
  let current = start;

  for (let i = 0; i < 32; i += 1) {
    const next = edges.find((e) => e.from === current);
    if (!next) break;
    path.push(next.to);
    if (visited.has(next.to)) break;
    visited.add(next.to);
    current = next.to;
  }
  return path;
}
