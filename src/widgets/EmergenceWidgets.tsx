/**
 * Emergence you can poke.
 *
 * `sim.automaton` — flip the eight bits of a rule by hand and watch the
 * space-time diagram redraw. The lesson lands when a learner who has just built
 * a rule cannot say what it will draw: the description is complete, and it still
 * does not amount to a prediction.
 *
 * `sim.life` — draw cells, drop in a glider, press play. Organisation that
 * maintains and moves itself, out of four lines of rule.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { ChipGroup, Readout, Slider, WidgetShell, useAnimationFrame, useGoal } from './common';
import {
  LIFE_PATTERNS,
  NOTABLE_RULES,
  createGrid,
  placePattern,
  population,
  randomGrid,
  ruleBits,
  runElementary,
  seededRow,
  singleSeedRow,
  stepLife,
  toggleCell,
  type Grid,
} from './models/emergence';

// ---------------------------------------------------------------------------
// Elementary cellular automaton
// ---------------------------------------------------------------------------

const automatonSchema = s.object({
  title: s.withDefault(s.string(), 'Клеточный автомат'),
  hint: s.optional(s.string()),
  rule: s.withDefault(s.number({ min: 0, max: 255, int: true }), 30),
  width: s.withDefault(s.number({ min: 21, max: 201, int: true }), 101),
  generations: s.withDefault(s.number({ min: 20, max: 200, int: true }), 90),
  editableRule: s.withDefault(s.boolean(), true),
});

type AutomatonProps = Infer<typeof automatonSchema>;

function AutomatonLab({ props, ctx, blockId }: BlockViewProps<AutomatonProps>) {
  const [rule, setRule] = useState(props.rule);
  const [start, setStart] = useState<'single' | 'random'>('single');
  const [seed, setSeed] = useState(3);
  const [explored, setExplored] = useState<Set<number>>(new Set([props.rule]));
  const { done, reach } = useGoal(ctx, blockId);

  const initial = useMemo(
    () => (start === 'single' ? singleSeedRow(props.width) : seededRow(props.width, seed, 0.5)),
    [start, props.width, seed],
  );
  const history = useMemo(() => runElementary(initial, rule, props.generations), [initial, rule, props.generations]);
  const bits = ruleBits(rule);

  useEffect(() => {
    if (!done && explored.size >= 4) reach(1, { rules: [...explored] });
  }, [explored, done, reach]);

  const changeRule = (next: number) => {
    const clamped = ((next % 256) + 256) % 256;
    setRule(clamped);
    setExplored((current) => new Set([...current, clamped]));
  };

  const cellSize = 100 / props.width;
  const note = NOTABLE_RULES.find((r) => r.rule === rule)?.note;
  const alive = history[history.length - 1].reduce<number>((a, b) => a + b, 0);

  return (
    <WidgetShell
      title={`${props.title} — правило ${rule}`}
      hint={props.hint ?? 'Восемь переключателей полностью задают мир. Попробуйте предсказать картинку до того, как её увидите.'}
      badge={<span className="pill pill--accent">исследовано правил: {explored.size}</span>}
      readouts={
        <>
          <Readout label="Правило" value={rule} />
          <Readout label="Двоичный код" value={[...bits].reverse().join('')} />
          <Readout label="Живых в последнем поколении" value={`${alive} из ${props.width}`} />
        </>
      }
      controls={
        <>
          {props.editableRule && (
            <Slider
              label="Номер правила"
              value={rule}
              min={0}
              max={255}
              step={1}
              onChange={changeRule}
              format={(v) => String(v)}
              note="Все 256 миров одномерной вселенной"
            />
          )}
          <ChipGroup
            label="Начальное состояние"
            value={start}
            onChange={(value) => setStart(value)}
            options={[
              { value: 'single', label: 'одна клетка' },
              { value: 'random', label: 'случайно' },
            ]}
          />
          <div className="widget__actions">
            {NOTABLE_RULES.map((item) => (
              <button key={item.rule} type="button" className="btn btn--sm" onClick={() => changeRule(item.rule)}>
                {item.rule}
              </button>
            ))}
            {start === 'random' && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setSeed((v) => v + 1)}>
                Другое начало
              </button>
            )}
          </div>
        </>
      }
      note={note ?? 'Меняйте правило и смотрите: одни миры замирают, другие повторяются, третьи не поддаются никакому краткому описанию.'}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="chips" role="group" aria-label="Биты правила">
          {bits.map((bit, index) => {
            const neighbourhood = index.toString(2).padStart(3, '0');
            return (
              <button
                key={index}
                type="button"
                className={`chip${bit ? ' chip--active' : ''}`}
                aria-pressed={bit === 1}
                aria-label={`Окрестность ${neighbourhood} даёт ${bit}`}
                onClick={() => changeRule(rule ^ (1 << index))}
                style={{ fontFamily: 'var(--mono)', display: 'grid', gap: 2, padding: '6px 10px' }}
              >
                <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{neighbourhood}</span>
                <span style={{ fontSize: '1rem', color: bit ? 'var(--signal)' : 'var(--text-faint)' }}>{bit}</span>
              </button>
            );
          })}
        </div>

        <svg
          className="widget__canvas"
          viewBox={`0 0 100 ${props.generations * cellSize}`}
          role="img"
          aria-label={`Пространственно-временная диаграмма правила ${rule}`}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="crispEdges"
        >
          <rect width={100} height={props.generations * cellSize} fill="#05080f" />
          {history.slice(0, props.generations).map((row, y) =>
            row.map((cell, x) =>
              cell ? (
                <rect
                  key={`${y}-${x}`}
                  x={x * cellSize}
                  y={y * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={y === 0 ? '#ffb545' : '#35e0d0'}
                  opacity={y === 0 ? 1 : 0.85}
                />
              ) : null,
            ),
          )}
        </svg>
      </div>
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Game of Life
// ---------------------------------------------------------------------------

const lifeSchema = s.object({
  title: s.withDefault(s.string(), 'Жизнь Конвея'),
  hint: s.optional(s.string()),
  width: s.withDefault(s.number({ min: 10, max: 80, int: true }), 44),
  height: s.withDefault(s.number({ min: 10, max: 60, int: true }), 28),
  autoplay: s.withDefault(s.boolean(), false),
});

type LifeProps = Infer<typeof lifeSchema>;

function LifeLab({ props, ctx, blockId }: BlockViewProps<LifeProps>) {
  const [grid, setGrid] = useState<Grid>(() =>
    placePattern(createGrid(props.width, props.height), LIFE_PATTERNS[0], 4, 3),
  );
  const [running, setRunning] = useState(props.autoplay);
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(8);
  const accumulator = useRef(0);
  const { done, reach } = useGoal(ctx, blockId);

  useAnimationFrame((delta) => {
    accumulator.current += delta;
    const interval = 1000 / speed;
    if (accumulator.current < interval) return;
    accumulator.current = 0;
    setGrid((current) => stepLife(current));
    setGeneration((g) => g + 1);
  }, running);

  useEffect(() => {
    if (!done && generation >= 30) reach(1, { generation });
  }, [generation, done, reach]);

  const cell = 100 / props.width;
  const boardHeight = props.height * cell;

  const drop = (pattern: (typeof LIFE_PATTERNS)[number]) => {
    setGrid((current) =>
      placePattern(current, pattern, Math.floor(props.width / 2) - 2, Math.floor(props.height / 2) - 2),
    );
  };

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Рисуйте клетки мышью или пальцем, запускайте — и смотрите, что из этого вырастет.'}
      badge={<span className="pill pill--accent">поколение {generation}</span>}
      readouts={
        <>
          <Readout label="Живых клеток" value={population(grid)} />
          <Readout label="Поколение" value={generation} />
          <Readout label="Правило" value="B3/S23" />
        </>
      }
      controls={
        <>
          <div className="widget__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setRunning((r) => !r)}>
              {running ? '❙❙ Пауза' : '▶ Запустить'}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                setGrid((current) => stepLife(current));
                setGeneration((g) => g + 1);
              }}
            >
              Шаг
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setGrid(createGrid(props.width, props.height));
                setGeneration(0);
              }}
            >
              Очистить
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setGrid(randomGrid(props.width, props.height, Date.now() % 10000, 0.28));
                setGeneration(0);
              }}
            >
              Случайно
            </button>
          </div>
          <Slider
            label="Скорость"
            value={speed}
            min={1}
            max={30}
            step={1}
            onChange={setSpeed}
            format={(v) => `${v} пок./с`}
          />
          <div className="widget__actions">
            {LIFE_PATTERNS.map((pattern) => (
              <button key={pattern.id} type="button" className="btn btn--sm" onClick={() => drop(pattern)}>
                {pattern.title}
              </button>
            ))}
          </div>
        </>
      }
      note="Ни у одной клетки нет плана. Планёр не «движется» — он раз за разом воссоздаётся чуть правее и ниже. Организация здесь не в веществе, а в форме."
    >
      <svg
        className="widget__canvas"
        viewBox={`0 0 100 ${boardHeight}`}
        role="group"
        aria-label="Поле игры «Жизнь»; нажимайте на клетки, чтобы оживить их"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
      >
        <rect width={100} height={boardHeight} fill="#05080f" />
        {Array.from({ length: props.height }, (_, y) =>
          Array.from({ length: props.width }, (_, x) => {
            const alive = grid.cells[y * props.width + x] === 1;
            return (
              <rect
                key={`${x}-${y}`}
                x={x * cell}
                y={y * cell}
                width={cell}
                height={cell}
                fill={alive ? '#35e0d0' : 'transparent'}
                stroke="#131b2e"
                strokeWidth={0.06}
                onPointerDown={() => {
                  setGrid((current) => toggleCell(current, x, y));
                }}
                onPointerEnter={(event) => {
                  if (event.buttons === 1) setGrid((current) => toggleCell(current, x, y));
                }}
                style={{ cursor: 'crosshair' }}
              />
            );
          }),
        )}
      </svg>
    </WidgetShell>
  );
}

export const automatonBlock = defineBlock({
  type: 'sim.automaton',
  category: 'simulation',
  label: 'Клеточный автомат',
  description: 'Элементарные клеточные автоматы Вольфрама с редактируемым правилом.',
  schema: automatonSchema,
  component: AutomatonLab,
  scorable: true,
  cost: 5,
});

export const lifeBlock = defineBlock({
  type: 'sim.life',
  category: 'simulation',
  label: 'Игра «Жизнь»',
  description: 'Клеточный автомат Конвея: самоподдерживающиеся и движущиеся структуры.',
  schema: lifeSchema,
  component: LifeLab,
  scorable: true,
  cost: 5,
});
