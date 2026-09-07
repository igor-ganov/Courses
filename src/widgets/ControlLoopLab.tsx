/**
 * The feedback-loop laboratory.
 *
 * One instrument, used all through the course at increasing depth: at level 1 it
 * shows only a setpoint and a gain, at level 2 the delay appears, at level 3 the
 * full PID with noise and disturbance. Which controls are visible is a prop, so
 * the same widget grows with the spiral instead of being replaced.
 *
 * The trace is recomputed synchronously on every slider move — the entire point
 * is that the learner feels the cause and effect in their fingers — and a
 * playhead animates across the finished curve so the transient reads as motion
 * rather than as a static picture.
 */

import { useEffect, useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { Plot, Readout, Slider, Switch, WidgetShell, useAnimationFrame, useGoal } from './common';
import { analyse, defaultLoopParams, simulateLoop, type LoopParams } from './models/controlLoop';

const controlName = s.enum(['setpoint', 'kp', 'ki', 'kd', 'delay', 'noise', 'disturbance', 'closedLoop'] as const);

const schema = s.object({
  title: s.withDefault(s.string(), 'Лаборатория контура обратной связи'),
  hint: s.optional(s.string()),
  /** Which knobs the learner gets at this depth. */
  controls: s.withDefault(s.array(controlName), () => ['setpoint', 'kp', 'ki', 'delay']),
  initial: s.optional(
    s.object({
      setpoint: s.optional(s.number()),
      kp: s.optional(s.number()),
      ki: s.optional(s.number()),
      kd: s.optional(s.number()),
      delaySteps: s.optional(s.number()),
      noise: s.optional(s.number()),
      disturbance: s.optional(s.number()),
      closedLoop: s.optional(s.boolean()),
      tau: s.optional(s.number()),
      steps: s.optional(s.number()),
    }),
  ),
  presets: s.withDefault(s.boolean(), true),
  /** Turns the lab into a graded exercise. */
  goal: s.optional(
    s.object({
      text: s.string(),
      /** Minimum quality of the run, 0..1. */
      minScore: s.withDefault(s.number({ min: 0, max: 1 }), 0.85),
      /** Optional extra condition on the settling time, in seconds. */
      maxSettling: s.optional(s.number()),
    }),
  ),
  note: s.optional(s.string()),
});

type Props = Infer<typeof schema>;

interface Preset {
  id: string;
  label: string;
  note: string;
  params: Partial<LoopParams>;
}

const PRESETS: readonly Preset[] = [
  {
    id: 'p-only',
    label: 'Только P',
    note: 'Пропорциональный регулятор всегда оставляет статическую ошибку: чтобы держать выход, ему нужно ненулевое рассогласование.',
    params: { kp: 2, ki: 0, kd: 0, delaySteps: 0, noise: 0 },
  },
  {
    id: 'pi',
    label: 'PI',
    note: 'Интегратор накапливает ошибку и додавливает выход ровно до уставки — ценой замедления и склонности к перерегулированию.',
    params: { kp: 2, ki: 1.2, kd: 0, delaySteps: 0, noise: 0 },
  },
  {
    id: 'too-much',
    label: 'Слишком сильное усиление',
    note: 'Усиление 14 при запаздывании 1,5 с: контур начинает раскачивать сам себя. Больше власти — не больше управления.',
    params: { kp: 14, ki: 0, kd: 0, delaySteps: 30, noise: 0 },
  },
  {
    id: 'delay',
    label: 'Запаздывание',
    note: 'То же усиление, что и в спокойном режиме, но датчик отстаёт: регулятор реагирует на прошлое и промахивается.',
    params: { kp: 5, ki: 0.5, kd: 0, delaySteps: 22, noise: 0 },
  },
  {
    id: 'pid',
    label: 'PID',
    note: 'Производная предсказывает, куда идёт ошибка, и гасит раскачку — но усиливает шум датчика.',
    params: { kp: 6, ki: 0.8, kd: 1.4, delaySteps: 12, noise: 0.01 },
  },
  {
    id: 'noise',
    label: 'Шумный датчик',
    note: 'Шум измерения проходит через регулятор в исполнитель: контур дёргается, хотя объект спокоен.',
    params: { kp: 4, ki: 0.6, kd: 1.2, delaySteps: 6, noise: 0.08 },
  },
];

function ControlLoopLab({ props, ctx, blockId }: BlockViewProps<Props>) {
  const [params, setParams] = useState<LoopParams>(() => ({
    ...defaultLoopParams,
    ...props.initial,
    steps: props.initial?.steps ?? 700,
  }));
  const [presetNote, setPresetNote] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(1);
  const { done, reach } = useGoal(ctx, blockId);

  const trace = useMemo(() => simulateLoop(params), [params]);
  const metrics = useMemo(() => analyse(trace, params), [trace, params]);
  const duration = params.steps * params.dt;

  // Replay the transient whenever anything changes.
  useEffect(() => setPlayhead(0), [params]);
  useAnimationFrame((delta) => {
    setPlayhead((current) => Math.min(1, current + delta / 1400));
  }, playhead < 1);

  const goal = props.goal;
  useEffect(() => {
    if (!goal || done) return;
    const settlingOk =
      goal.maxSettling === undefined ||
      (metrics.settlingTime !== null && metrics.settlingTime <= goal.maxSettling);
    if (metrics.score >= goal.minScore && settlingOk) reach(metrics.score);
  }, [goal, metrics, done, reach]);

  const visible = new Set(props.controls);
  const shown = trace.slice(0, Math.max(2, Math.floor(trace.length * playhead)));
  const yValues = trace.map((p) => p.y);
  const yMin = Math.min(-0.2, ...yValues);
  const yMax = Math.max(params.setpoint * 1.4, ...yValues.map((v) => Math.min(v, 4)));

  const set = (patch: Partial<LoopParams>) => {
    setParams((current) => ({ ...current, ...patch }));
    setPresetNote(null);
  };

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Двигайте ручки и смотрите, как меняется переходный процесс.'}
      goal={goal ? { text: goal.text, done } : undefined}
      badge={
        <span className={`pill pill--${metrics.unstable ? 'warn' : metrics.settled ? 'ok' : 'accent'}`}>
          {describeRegime(metrics)}
        </span>
      }
      readouts={
        <>
          <Readout
            label="Статическая ошибка"
            value={metrics.steadyStateError.toFixed(3)}
            tone={metrics.steadyStateError < 0.02 ? 'good' : metrics.steadyStateError < 0.15 ? 'warn' : 'bad'}
          />
          <Readout
            label="Перерегулирование"
            value={`${(metrics.overshoot * 100).toFixed(0)}%`}
            tone={metrics.overshoot < 0.1 ? 'good' : metrics.overshoot < 0.4 ? 'warn' : 'bad'}
          />
          <Readout
            label="Время установления"
            value={metrics.settlingTime === null ? '—' : `${metrics.settlingTime.toFixed(1)} с`}
            tone={metrics.settlingTime === null ? 'bad' : 'neutral'}
          />
          <Readout label="Пересечений уставки" value={metrics.oscillations} />
          <Readout
            label="Качество"
            value={`${Math.round(metrics.score * 100)}%`}
            tone={metrics.score > 0.85 ? 'good' : metrics.score > 0.5 ? 'warn' : 'bad'}
          />
        </>
      }
      controls={
        <>
          {visible.has('setpoint') && (
            <Slider
              label="Уставка"
              value={params.setpoint}
              min={0}
              max={2}
              step={0.1}
              onChange={(setpoint) => set({ setpoint })}
              format={(v) => v.toFixed(1)}
              note="Чего мы хотим от объекта"
            />
          )}
          {visible.has('kp') && (
            <Slider
              label="Усиление P"
              value={params.kp}
              min={0}
              max={16}
              step={0.1}
              onChange={(kp) => set({ kp })}
              format={(v) => v.toFixed(1)}
              note="Реакция на текущую ошибку"
            />
          )}
          {visible.has('ki') && (
            <Slider
              label="Интеграл I"
              value={params.ki}
              min={0}
              max={4}
              step={0.05}
              onChange={(ki) => set({ ki })}
              format={(v) => v.toFixed(2)}
              note="Память о накопленной ошибке"
            />
          )}
          {visible.has('kd') && (
            <Slider
              label="Производная D"
              value={params.kd}
              min={0}
              max={4}
              step={0.05}
              onChange={(kd) => set({ kd })}
              format={(v) => v.toFixed(2)}
              note="Прогноз: куда ошибка движется"
            />
          )}
          {visible.has('delay') && (
            <Slider
              label="Запаздывание датчика"
              value={params.delaySteps}
              min={0}
              max={40}
              step={1}
              onChange={(delaySteps) => set({ delaySteps })}
              format={(v) => `${(v * params.dt).toFixed(2)} с`}
              note="Насколько измерение отстаёт от реальности"
            />
          )}
          {visible.has('noise') && (
            <Slider
              label="Шум датчика"
              value={params.noise}
              min={0}
              max={0.2}
              step={0.005}
              onChange={(noise) => set({ noise })}
              format={(v) => v.toFixed(3)}
              note="Случайная ошибка измерения"
            />
          )}
          {visible.has('disturbance') && (
            <Slider
              label="Возмущение"
              value={params.disturbance}
              min={-1}
              max={1}
              step={0.05}
              onChange={(disturbance) => set({ disturbance })}
              format={(v) => v.toFixed(2)}
              note="Внешнее воздействие на объект"
            />
          )}
          {visible.has('closedLoop') && (
            <Switch
              label="Замкнуть контур"
              checked={params.closedLoop}
              onChange={(closedLoop) => set({ closedLoop })}
            />
          )}
        </>
      }
      note={
        <>
          {presetNote && <p style={{ marginBottom: 8 }}>{presetNote}</p>}
          {props.note && <p style={{ margin: 0 }}>{props.note}</p>}
        </>
      }
    >
      <Plot
        ariaLabel={`Переходный процесс: выход объекта против времени, уставка ${params.setpoint}`}
        xDomain={[0, duration]}
        yDomain={[yMin, yMax]}
        reference={{ y: params.setpoint, label: 'уставка', band: Math.max(0.02, Math.abs(params.setpoint) * 0.02) }}
        xLabel="время, с"
        yLabel="выход"
        playhead={playhead < 1 ? playhead * duration : undefined}
        series={[
          {
            label: 'выход объекта',
            color: '#35e0d0',
            points: shown.map((p) => ({ x: p.t, y: p.y })),
            width: 2.4,
          },
          {
            label: 'усилие регулятора',
            color: '#7c6cff',
            dashed: true,
            points: shown.map((p) => ({ x: p.t, y: p.u })),
          },
          ...(params.noise > 0
            ? [
                {
                  label: 'что видит датчик',
                  color: '#ffb545',
                  width: 1,
                  points: shown.map((p) => ({ x: p.t, y: p.measured })),
                },
              ]
            : []),
        ]}
      />

      {props.presets && (
        <div className="widget__actions" style={{ marginTop: 12 }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setParams((current) => ({ ...current, ...preset.params }));
                setPresetNote(preset.note);
              }}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              setParams({ ...defaultLoopParams, ...props.initial, steps: props.initial?.steps ?? 700 });
              setPresetNote(null);
            }}
          >
            Сброс
          </button>
        </div>
      )}
    </WidgetShell>
  );
}

/**
 * A loop resting on a permanent offset has settled — just not on the setpoint.
 * Calling that "переходный процесс" would misread the very lesson the block is
 * there to teach.
 */
function describeRegime(metrics: { unstable: boolean; settled: boolean; oscillations: number; steadyStateError: number }): string {
  if (metrics.unstable) return 'неустойчиво';
  if (metrics.settled) return 'устойчиво';
  if (metrics.oscillations > 6) return 'колебания';
  if (metrics.steadyStateError > 0.02) return 'устойчиво, но не дотягивает';
  return 'переходный процесс';
}

export const controlLoopLabBlock = defineBlock({
  type: 'sim.control-loop',
  category: 'simulation',
  label: 'Лаборатория контура',
  description:
    'Интерактивный контур с ПИД-регулятором, запаздыванием, шумом и возмущением; переходный процесс пересчитывается на лету.',
  schema,
  component: ControlLoopLab,
  scorable: true,
  cost: 6,
});
