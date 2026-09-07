/**
 * Shared widget furniture.
 *
 * Every interactive block sits in the same frame — title, hint, canvas,
 * controls, readouts — so a learner who has used one simulation knows where the
 * reset button is in all of them. `useGoal` is the bridge between a widget's own
 * notion of success and the platform's XP/mastery machinery: a widget just calls
 * `reach(score)` and the rest is handled.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { BlockContext } from '@/content/registry';

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export interface WidgetShellProps {
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
  controls?: ReactNode;
  readouts?: ReactNode;
  note?: ReactNode;
  goal?: { text: string; done: boolean };
  /** Wide widgets break out of the reading column. */
  wide?: boolean;
}

export function WidgetShell({
  title,
  hint,
  badge,
  children,
  controls,
  readouts,
  note,
  goal,
  wide = true,
}: WidgetShellProps) {
  return (
    <section className={`widget${wide ? ' bleed' : ''}`} aria-label={title}>
      <header className="widget__head">
        <div>
          <div className="widget__title">{title}</div>
          {hint && <div className="widget__hint">{hint}</div>}
        </div>
        {badge && <div className="widget__badge">{badge}</div>}
      </header>

      {goal && (
        <div className={`goal-banner goal-banner--${goal.done ? 'done' : 'pending'}`} role="status">
          <span aria-hidden="true">{goal.done ? '✓' : '◎'}</span>
          <span>{goal.done ? `Задача выполнена: ${goal.text}` : `Задача: ${goal.text}`}</span>
        </div>
      )}

      <div className="widget__body">{children}</div>
      {readouts && <div className="widget__readouts">{readouts}</div>}
      {controls && <div className="widget__controls">{controls}</div>}
      {note && <div className="widget__note">{note}</div>}
    </section>
  );
}

export function Readout({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`readout${tone === 'neutral' ? '' : ` readout--${tone}`}`}>
      <span className="readout__label">{label}</span>
      <span className="readout__value">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
  /** Formatted display value; defaults to the raw number. */
  format?(value: number): string;
  note?: string;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format, note, disabled }: SliderProps) {
  return (
    <label className="slider">
      <span className="slider__top">
        <span className="slider__label">{label}</span>
        <span className="slider__value">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {note && <span className="slider__note">{note}</span>}
    </label>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`chip${option.value === value ? ' chip--active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export interface Series {
  points: readonly { x: number; y: number }[];
  color: string;
  label: string;
  dashed?: boolean;
  width?: number;
}

export interface PlotProps {
  series: readonly Series[];
  xDomain: [number, number];
  yDomain: [number, number];
  height?: number;
  /** Horizontal reference line, e.g. the setpoint. */
  reference?: { y: number; label?: string; band?: number };
  xLabel?: string;
  yLabel?: string;
  /** Vertical marker following an animation. */
  playhead?: number;
  ariaLabel: string;
}

const PLOT_WIDTH = 720;
const MARGIN = { top: 12, right: 14, bottom: 38, left: 42 };

export function Plot({
  series,
  xDomain,
  yDomain,
  height = 260,
  reference,
  xLabel,
  yLabel,
  playhead,
  ariaLabel,
}: PlotProps) {
  const innerW = PLOT_WIDTH - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const sx = (x: number) =>
    MARGIN.left + ((x - xDomain[0]) / (xDomain[1] - xDomain[0] || 1)) * innerW;
  const sy = (y: number) =>
    MARGIN.top + innerH - ((y - yDomain[0]) / (yDomain[1] - yDomain[0] || 1)) * innerH;

  const ticksY = niceTicks(yDomain[0], yDomain[1], 4);
  const ticksX = niceTicks(xDomain[0], xDomain[1], 5);

  return (
    <svg
      className="widget__canvas"
      viewBox={`0 0 ${PLOT_WIDTH} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={MARGIN.left} y={MARGIN.top} width={innerW} height={innerH} fill="rgba(255,255,255,0.015)" />

      {ticksY.map((tick) => (
        <g key={`y${tick}`}>
          <line x1={MARGIN.left} x2={MARGIN.left + innerW} y1={sy(tick)} y2={sy(tick)} stroke="#1e2942" strokeWidth={1} />
          <text x={MARGIN.left - 7} y={sy(tick) + 4} textAnchor="end" fontSize={11} fill="#6f7c9c" fontFamily="var(--mono)">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {ticksX.map((tick) => (
        <text key={`x${tick}`} x={sx(tick)} y={height - 22} textAnchor="middle" fontSize={11} fill="#6f7c9c" fontFamily="var(--mono)">
          {formatTick(tick)}
        </text>
      ))}

      {reference && (
        <>
          {reference.band !== undefined && (
            <rect
              x={MARGIN.left}
              y={sy(reference.y + reference.band)}
              width={innerW}
              height={Math.abs(sy(reference.y - reference.band) - sy(reference.y + reference.band))}
              fill="rgba(74,222,128,0.09)"
            />
          )}
          <line
            x1={MARGIN.left}
            x2={MARGIN.left + innerW}
            y1={sy(reference.y)}
            y2={sy(reference.y)}
            stroke="#4ade80"
            strokeWidth={1.4}
            strokeDasharray="6 5"
          />
          {reference.label && (
            <text x={MARGIN.left + innerW - 4} y={sy(reference.y) - 6} textAnchor="end" fontSize={11} fill="#4ade80">
              {reference.label}
            </text>
          )}
        </>
      )}

      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width ?? 2}
          strokeDasharray={s.dashed ? '5 4' : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={s.points.map((p) => `${sx(p.x).toFixed(2)},${clampY(sy(p.y), MARGIN.top, MARGIN.top + innerH).toFixed(2)}`).join(' ')}
        />
      ))}

      {playhead !== undefined && (
        <line
          x1={sx(playhead)}
          x2={sx(playhead)}
          y1={MARGIN.top}
          y2={MARGIN.top + innerH}
          stroke="#7c6cff"
          strokeWidth={1.5}
          opacity={0.8}
        />
      )}

      <line x1={MARGIN.left} x2={MARGIN.left + innerW} y1={MARGIN.top + innerH} y2={MARGIN.top + innerH} stroke="#2a3550" strokeWidth={1} />
      {yLabel && (
        <text x={12} y={MARGIN.top + innerH / 2} fontSize={11} fill="#6f7c9c" transform={`rotate(-90 12 ${MARGIN.top + innerH / 2})`} textAnchor="middle">
          {yLabel}
        </text>
      )}
      {xLabel && (
        <text x={MARGIN.left + innerW / 2} y={height - 5} fontSize={11} fill="#6f7c9c" textAnchor="middle">
          {xLabel}
        </text>
      )}

      <g>
        {series.map((s, index) => (
          <g key={`legend-${s.label}`} transform={`translate(${MARGIN.left + 8 + index * 132} ${MARGIN.top + 12})`}>
            <line x1={0} x2={16} y1={0} y2={0} stroke={s.color} strokeWidth={2.4} strokeDasharray={s.dashed ? '5 4' : undefined} />
            <text x={21} y={4} fontSize={11} fill="#a4b0cc">
              {s.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const clampY = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return value.toExponential(0);
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(Math.abs(value) < 1 ? 2 : 1);
}

/** Round tick values so axes read 0, 0.5, 1 rather than 0, 0.4713, 0.9426. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const step = (normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1) * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 1e-6; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** requestAnimationFrame loop that pauses when `active` is false. */
export function useAnimationFrame(callback: (deltaMs: number) => void, active: boolean): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      saved.current(delta);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
}

/**
 * Report success to the platform exactly once per block, and remember it across
 * re-renders so a learner who nails the target does not lose the credit by
 * touching a slider afterwards.
 */
export function useGoal(ctx: BlockContext, blockId: string) {
  const [done, setDone] = useState(() => ctx.isCompleted(blockId));
  const reported = useRef(done);

  const reach = useCallback(
    (score = 1, detail?: Record<string, unknown>) => {
      setDone(true);
      if (reported.current) return;
      reported.current = true;
      ctx.reportInteraction({ blockId, score, detail });
    },
    [ctx, blockId],
  );

  return { done, reach };
}

/** Track pointer drags on an SVG, reporting coordinates in the SVG's own space. */
export function useSvgPointer(
  onMove: (point: { x: number; y: number }, event: PointerEvent) => void,
) {
  const ref = useRef<SVGSVGElement | null>(null);
  const dragging = useRef(false);

  const toLocal = useCallback((event: PointerEvent | React.PointerEvent) => {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const scaleX = (viewBox?.width || rect.width) / (rect.width || 1);
    const scaleY = (viewBox?.height || rect.height) / (rect.height || 1);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      onMove(toLocal(event), event.nativeEvent);
    },
    [onMove, toLocal],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging.current) return;
      onMove(toLocal(event), event.nativeEvent);
    },
    [onMove, toLocal],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return { ref, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}
