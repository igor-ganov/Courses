/**
 * The phase plane: three qualitatively different worlds, one number apart.
 *
 * A damped oscillator drawn as a trajectory rather than as a time series. One
 * slider controls the damping, and its *sign* decides everything: positive
 * spirals inward to rest, zero holds a closed orbit, negative spirals out until
 * something breaks. Seeing the three regimes as three shapes — and watching the
 * shape change continuously as the number crosses zero — is the fastest way to
 * make "stability" mean something geometric instead of verbal.
 *
 * Several starting points are drawn at once, so the picture also shows what a
 * *basin* is: every trajectory ends up in the same place, whatever it started as.
 */

import { useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { Readout, Slider, WidgetShell, useGoal } from './common';
import { spiralTrajectory, type Vec2 } from './models/dynamics';

const schema = s.object({
  title: s.withDefault(s.string(), 'Фазовая плоскость'),
  hint: s.optional(s.string()),
  /** Starting damping; the learner moves it through zero. */
  damping: s.withDefault(s.number({ min: -1, max: 1 }), 0.35),
  frequency: s.withDefault(s.number({ min: 0.2, max: 4 }), 1.4),
});

type Props = Infer<typeof schema>;

const STARTS: Vec2[] = [
  { x: 3.2, y: 0 },
  { x: -2.4, y: 1.6 },
  { x: 1.1, y: -2.8 },
];

const STEPS = 900;
const DT = 0.02;
const EXTENT = 5;

const regimeOf = (damping: number) =>
  damping > 0.02 ? 'stable' : damping < -0.02 ? 'unstable' : 'marginal';

function PhasePlane({ props, ctx, blockId }: BlockViewProps<Props>) {
  const [damping, setDamping] = useState(props.damping);
  const [omega, setOmega] = useState(props.frequency);
  // The regime on screen at mount counts: the learner is already looking at it.
  const [seenRegimes, setSeenRegimes] = useState<Set<string>>(() => new Set([regimeOf(props.damping)]));
  const { done, reach } = useGoal(ctx, blockId);

  const regime = regimeOf(damping);

  const trajectories = useMemo(
    () => STARTS.map((start) => spiralTrajectory(start, damping, omega, STEPS, DT)),
    [damping, omega],
  );

  const changeDamping = (value: number) => {
    setDamping(value);
    const next = regimeOf(value);
    setSeenRegimes((current) => {
      if (current.has(next)) return current;
      const updated = new Set([...current, next]);
      // Meeting all three regimes is the point of the exercise.
      if (updated.size === 3 && !done) reach(1, { regimes: [...updated] });
      return updated;
    });
  };

  const project = (point: Vec2) => ({
    x: 50 + (point.x / EXTENT) * 44,
    y: 50 - (point.y / EXTENT) * 44,
  });

  const finalRadius = Math.hypot(
    trajectories[0][STEPS - 1].x,
    trajectories[0][STEPS - 1].y,
  );

  return (
    <WidgetShell
      title={props.title}
      hint={
        props.hint ??
        'Каждая линия — одна и та же система, запущенная из разной начальной точки. Двигайте затухание через ноль.'
      }
      goal={{ text: 'побывать во всех трёх режимах устойчивости', done: done || seenRegimes.size === 3 }}
      badge={
        <span className={`pill pill--${regime === 'stable' ? 'ok' : regime === 'unstable' ? 'warn' : 'accent'}`}>
          {regime === 'stable' ? 'устойчиво' : regime === 'unstable' ? 'неустойчиво' : 'на границе'}
        </span>
      }
      readouts={
        <>
          <Readout label="Затухание" value={damping.toFixed(2)} tone={regime === 'unstable' ? 'bad' : 'neutral'} />
          <Readout
            label="Радиус в конце"
            value={finalRadius > 50 ? '→ ∞' : finalRadius.toFixed(2)}
            tone={finalRadius < 0.3 ? 'good' : finalRadius > 6 ? 'bad' : 'warn'}
          />
          <Readout
            label="Тип равновесия"
            value={regime === 'stable' ? 'устойчивый фокус' : regime === 'unstable' ? 'неустойчивый фокус' : 'центр'}
          />
          <Readout label="Режимов увидено" value={`${seenRegimes.size} из 3`} />
        </>
      }
      controls={
        <>
          <Slider
            label="Затухание"
            value={damping}
            min={-0.5}
            max={0.8}
            step={0.01}
            onChange={changeDamping}
            format={(v) => v.toFixed(2)}
            note="Отрицательное — система накачивает сама себя"
          />
          <Slider
            label="Собственная частота"
            value={omega}
            min={0.4}
            max={3.5}
            step={0.1}
            onChange={setOmega}
            format={(v) => v.toFixed(1)}
            note="Меняет частоту вращения, но не устойчивость"
          />
        </>
      }
      note="Обратите внимание: частота меняет форму спирали, но не решает судьбу системы. Судьбу решает знак затухания — и именно поэтому в теории управления смотрят не на то, как быстро система колеблется, а на то, растёт амплитуда или спадает."
    >
      <svg
        className="widget__canvas"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Фазовый портрет: затухание ${damping.toFixed(2)}, режим — ${regime}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ maxHeight: 420 }}
      >
        <rect width={100} height={100} fill="#05080f" />

        {[10, 20, 30, 40].map((r) => (
          <circle key={r} cx={50} cy={50} r={r} fill="none" stroke="#141d31" strokeWidth={0.3} />
        ))}
        <line x1={6} y1={50} x2={94} y2={50} stroke="#243050" strokeWidth={0.4} />
        <line x1={50} y1={6} x2={50} y2={94} stroke="#243050" strokeWidth={0.4} />
        <text x={95} y={53.5} fontSize={3} fill="#6f7c9c" textAnchor="end">
          положение
        </text>
        <text x={52} y={9} fontSize={3} fill="#6f7c9c">
          скорость
        </text>

        {trajectories.map((path, index) => (
          <polyline
            key={index}
            fill="none"
            stroke={['#35e0d0', '#7c6cff', '#ffb545'][index]}
            strokeWidth={0.55}
            strokeLinejoin="round"
            opacity={0.9}
            points={path
              .filter((p) => Math.abs(p.x) < 60 && Math.abs(p.y) < 60)
              .map((p) => {
                const q = project(p);
                return `${q.x.toFixed(2)},${q.y.toFixed(2)}`;
              })
              .join(' ')}
          />
        ))}

        {STARTS.map((start, index) => {
          const q = project(start);
          return <circle key={index} cx={q.x} cy={q.y} r={0.9} fill={['#35e0d0', '#7c6cff', '#ffb545'][index]} />;
        })}

        <circle cx={50} cy={50} r={1.1} fill="none" stroke="#4ade80" strokeWidth={0.5} />
      </svg>
    </WidgetShell>
  );
}

export const phasePlaneBlock = defineBlock({
  type: 'viz.phase-plane',
  category: 'diagram',
  label: 'Фазовая плоскость',
  description: 'Три режима устойчивости как три формы траектории; знак затухания решает всё.',
  schema,
  component: PhasePlane,
  scorable: true,
  cost: 4,
});
