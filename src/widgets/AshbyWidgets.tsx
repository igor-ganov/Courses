/**
 * Three widgets around Ashby.
 *
 * `game.requisite-variety` — the learner plays regulator against an environment
 * with more moves than they have. Being told the law is forgettable; losing a
 * round because you literally ran out of distinct responses is not.
 *
 * `game.black-box` — probe a hidden mechanism and eliminate hypotheses. The
 * interesting moment is the one where the same input gives two different
 * answers, which is the operational definition of "this thing has state".
 *
 * `viz.variety-explosion` — a counter that makes 2^n physical: add switches and
 * watch the state count leave everyday intuition behind.
 */

import { useEffect, useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { Readout, Slider, WidgetShell, useGoal } from './common';
import {
  BLACK_BOXES,
  createBox,
  evaluateAssignment,
  identifyBox,
  latinSquareOutcomes,
  minimumOutcomeVariety,
  varietyBits,
  type Bit,
  type BoxId,
  type Observation,
} from './models/ashby';

// ---------------------------------------------------------------------------
// Requisite variety
// ---------------------------------------------------------------------------

const varietySchema = s.object({
  title: s.withDefault(s.string(), 'Закон необходимого разнообразия'),
  hint: s.optional(s.string()),
  disturbances: s.withDefault(s.number({ min: 2, max: 8, int: true }), 4),
  /** Start the regulator deliberately under-equipped. */
  responses: s.withDefault(s.number({ min: 1, max: 8, int: true }), 2),
  allowTuning: s.withDefault(s.boolean(), true),
});

type VarietyProps = Infer<typeof varietySchema>;

const DISTURBANCE_LABELS = ['Мороз', 'Жара', 'Сквозняк', 'Солнце', 'Ливень', 'Ветер', 'Влажность', 'Гости'];
const RESPONSE_LABELS = ['Нагреть', 'Охладить', 'Закрыть окно', 'Затенить', 'Осушить', 'Проветрить', 'Увлажнить', 'Ждать'];

function RequisiteVarietyGame({ props, ctx, blockId }: BlockViewProps<VarietyProps>) {
  const [responses, setResponses] = useState(props.responses);
  const disturbances = props.disturbances;
  const [choices, setChoices] = useState<(number | null)[]>(() => new Array(disturbances).fill(null));
  const [revealed, setRevealed] = useState(false);
  const { done, reach } = useGoal(ctx, blockId);

  const table = useMemo(() => latinSquareOutcomes(disturbances, responses), [disturbances, responses]);
  const result = useMemo(() => evaluateAssignment(table, choices, 0), [table, choices]);
  const possible = responses >= disturbances;

  useEffect(() => {
    setChoices(new Array(disturbances).fill(null));
    setRevealed(false);
  }, [disturbances, responses]);

  const play = () => {
    setRevealed(true);
    // Understanding *why* it is impossible counts as much as winning: a learner
    // who tries an under-equipped regulator and sees it fail has met the law.
    if (result.survived) reach(1, { responses });
    else if (!possible && choices.every((c) => c !== null)) reach(0.6, { responses, attemptedImpossible: true });
  };

  const residual = minimumOutcomeVariety(disturbances, responses);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Назначьте каждому возмущению ответ регулятора. Цель — чтобы существенная переменная осталась в норме во всех случаях.'}
      goal={{ text: 'удержать норму при любом возмущении', done: done || result.survived }}
      badge={
        <span className={`pill pill--${possible ? 'ok' : 'warn'}`}>
          {possible ? 'победа возможна' : 'разнообразия не хватает'}
        </span>
      }
      readouts={
        <>
          <Readout label="Разнообразие среды" value={`${disturbances} (${varietyBits(disturbances).toFixed(2)} бит)`} />
          <Readout label="Разнообразие регулятора" value={`${responses} (${varietyBits(responses).toFixed(2)} бит)`} />
          <Readout
            label="Неустранимый остаток"
            value={`${residual.toFixed(2)} бит`}
            tone={residual > 0 ? 'bad' : 'good'}
          />
          <Readout label="Удержано" value={`${result.held} из ${result.total}`} tone={result.survived ? 'good' : 'warn'} />
        </>
      }
      controls={
        <>
          {props.allowTuning && (
            <Slider
              label="Сколько разных ответов есть у регулятора"
              value={responses}
              min={1}
              max={disturbances + 1}
              step={1}
              onChange={setResponses}
              format={(v) => String(v)}
              note="Попробуйте выиграть, имея меньше ответов, чем у среды возмущений"
            />
          )}
          <div className="widget__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={play}>
              Проверить план
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setChoices(new Array(disturbances).fill(null));
                setRevealed(false);
              }}
            >
              Сбросить
            </button>
          </div>
        </>
      }
      note={
        revealed ? (
          result.survived ? (
            'Норма удержана. Обратите внимание: для этого понадобилось ровно столько различных ответов, сколько различных возмущений умеет производить среда.'
          ) : possible ? (
            `Прорвались возмущения: ${result.failures.map((i) => DISTURBANCE_LABELS[i]).join(', ')}. Ответы есть — но распределены неверно.`
          ) : (
            `Прорвались: ${result.failures.map((i) => DISTURBANCE_LABELS[i]).join(', ')}. И дело не в вашей стратегии: ${disturbances} различных возмущений невозможно погасить ${responses} различными ответами. Только разнообразие уничтожает разнообразие.`
          )
        ) : (
          'Каждое возмущение нейтрализуется ровно одним ответом. Найдите назначение — или убедитесь, что его не существует.'
        )
      }
    >
      <div style={{ display: 'grid', gap: 8 }}>
        {table.map((row, d) => (
          <div key={d} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12, alignItems: 'center' }}>
            <span className="pill pill--warn">{DISTURBANCE_LABELS[d]}</span>
            <div className="chips">
              {row.map((outcome, r) => {
                const picked = choices[d] === r;
                const failed = revealed && picked && outcome !== 0;
                const won = revealed && picked && outcome === 0;
                return (
                  <button
                    key={r}
                    type="button"
                    className={`chip${picked ? ' chip--active' : ''}`}
                    style={
                      won
                        ? { borderColor: 'var(--ok)', color: 'var(--ok)' }
                        : failed
                          ? { borderColor: 'var(--danger)', color: 'var(--danger)' }
                          : undefined
                    }
                    aria-pressed={picked}
                    onClick={() => {
                      setRevealed(false);
                      setChoices((current) => current.map((c, i) => (i === d ? (c === r ? null : r) : c)));
                    }}
                  >
                    {RESPONSE_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Black box
// ---------------------------------------------------------------------------

const blackBoxSchema = s.object({
  title: s.withDefault(s.string(), 'Чёрный ящик'),
  hint: s.optional(s.string()),
  /** Which box is hidden inside; omit to pick one deterministically per block. */
  box: s.optional(s.enum(['identity', 'inverter', 'toggle', 'delay', 'counter3', 'latch'] as const)),
});

type BlackBoxProps = Infer<typeof blackBoxSchema>;

function BlackBoxGame({ props, ctx, blockId }: BlockViewProps<BlackBoxProps>) {
  const hidden: BoxId = props.box ?? 'counter3';
  const [box] = useState(() => createBox(hidden));
  const [log, setLog] = useState<Observation[]>([]);
  const [guess, setGuess] = useState<BoxId | null>(null);
  const { done, reach } = useGoal(ctx, blockId);

  const candidates = useMemo(() => identifyBox(log), [log]);
  const solved = guess === hidden;

  const probe = (input: Bit) => {
    if (guess) return;
    setLog((current) => [...current, { input, output: box.step(input) }]);
  };

  const commit = (id: BoxId) => {
    setGuess(id);
    if (id === hidden) {
      // Fewer probes means a sharper experiment; reward the economy of it.
      reach(Math.max(0.6, 1 - Math.max(0, log.length - 4) * 0.05), { probes: log.length });
    }
  };

  const info = BLACK_BOXES.find((b) => b.id === hidden)!;

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Внутрь заглянуть нельзя. Подавайте на вход 0 и 1, смотрите на выход и сокращайте список гипотез.'}
      goal={{ text: 'определить, что внутри', done: done || solved }}
      badge={<span className="pill pill--accent">зондирований: {log.length}</span>}
      readouts={
        <>
          <Readout label="Гипотез осталось" value={candidates.length} tone={candidates.length === 1 ? 'good' : 'neutral'} />
          <Readout
            label="Один и тот же вход давал разные ответы"
            value={hasContradiction(log) ? 'да → есть память' : 'пока нет'}
            tone={hasContradiction(log) ? 'warn' : 'neutral'}
          />
        </>
      }
      controls={
        <>
          <div className="widget__actions">
            <button type="button" className="btn btn--sm" disabled={Boolean(guess)} onClick={() => probe(0)}>
              Подать 0
            </button>
            <button type="button" className="btn btn--sm" disabled={Boolean(guess)} onClick={() => probe(1)}>
              Подать 1
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                box.reset();
                setLog([]);
                setGuess(null);
              }}
            >
              Сбросить ящик
            </button>
          </div>
          <div className="chips">
            {BLACK_BOXES.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className={`chip${guess === candidate.id ? ' chip--active' : ''}`}
                disabled={Boolean(guess)}
                onClick={() => commit(candidate.id)}
              >
                {candidate.title}
              </button>
            ))}
          </div>
        </>
      }
      note={
        guess ? (
          solved ? (
            <span style={{ color: 'var(--ok)' }}>Верно: {info.title}. {info.explanation}</span>
          ) : (
            <span style={{ color: 'var(--warn)' }}>
              Не угадали — внутри был «{info.title}». {info.explanation}
            </span>
          )
        ) : (
          'Совет: сначала подайте один и тот же вход дважды. Если ответы разошлись — у ящика есть внутреннее состояние, и половина гипотез отпадает.'
        )
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <svg className="widget__canvas" viewBox="0 0 100 34" role="img" aria-label="Чёрный ящик с входом и выходом">
          <rect x={32} y={5} width={36} height={24} rx={4} fill="#0a0f1c" stroke="#2a3550" strokeWidth={0.6} />
          <text x={50} y={19.5} textAnchor="middle" fontSize={5} fill="#4b5878">
            ?
          </text>
          <line x1={8} y1={17} x2={31} y2={17} stroke="#7c6cff" strokeWidth={0.7} />
          <line x1={69} y1={17} x2={92} y2={17} stroke="#35e0d0" strokeWidth={0.7} />
          <text x={8} y={13} fontSize={3.2} fill="#a4b0cc">вход</text>
          <text x={92} y={13} fontSize={3.2} fill="#a4b0cc" textAnchor="end">выход</text>
          {log.length > 0 && (
            <>
              <text x={20} y={24} fontSize={4} fill="#7c6cff" textAnchor="middle" fontFamily="var(--mono)">
                {log[log.length - 1].input}
              </text>
              <text x={80} y={24} fontSize={4} fill="#35e0d0" textAnchor="middle" fontFamily="var(--mono)">
                {log[log.length - 1].output}
              </text>
            </>
          )}
        </svg>

        {log.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>вход</th>
                <th>выход</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, index) => (
                <tr key={index}>
                  <td className="mono">{index + 1}</td>
                  <td className="mono">{entry.input}</td>
                  <td className="mono" style={{ color: 'var(--signal)' }}>{entry.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="chips">
          {candidates.map((id) => (
            <span key={id} className="pill pill--signal">
              возможно: {BLACK_BOXES.find((b) => b.id === id)?.title}
            </span>
          ))}
          {log.length > 0 && candidates.length === 0 && (
            <span className="pill pill--warn">ни одна гипотеза не подходит — проверьте наблюдения</span>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

/** Did the same input ever produce two different outputs? */
function hasContradiction(log: readonly Observation[]): boolean {
  const seen = new Map<number, number>();
  for (const { input, output } of log) {
    const previous = seen.get(input);
    if (previous !== undefined && previous !== output) return true;
    seen.set(input, output);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Variety explosion
// ---------------------------------------------------------------------------

const explosionSchema = s.object({
  title: s.withDefault(s.string(), 'Взрыв разнообразия'),
  hint: s.optional(s.string()),
  maxSwitches: s.withDefault(s.number({ min: 4, max: 64, int: true }), 24),
});

type ExplosionProps = Infer<typeof explosionSchema>;

function VarietyExplosion({ props, ctx, blockId }: BlockViewProps<ExplosionProps>) {
  const [n, setN] = useState(3);
  const { done, reach } = useGoal(ctx, blockId);
  const [on, setOn] = useState<Set<number>>(new Set());

  const states = 2 ** n;
  const bits = n;

  useEffect(() => {
    if (!done && n >= 20) reach(1, { switches: n });
  }, [n, done, reach]);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Каждый добавленный двоичный элемент удваивает число состояний системы. Доведите до 20 — и посмотрите на число.'}
      badge={<span className="pill pill--accent">{bits} бит</span>}
      readouts={
        <>
          <Readout label="Элементов" value={n} />
          <Readout label="Состояний" value={formatBig(states)} tone={states > 1e6 ? 'warn' : 'neutral'} />
          <Readout
            label="Перебрать по 1 в секунду"
            value={humanTime(states)}
            tone={states > 1e9 ? 'bad' : 'neutral'}
          />
        </>
      }
      controls={
        <Slider
          label="Число двоичных элементов"
          value={n}
          min={1}
          max={props.maxSwitches}
          step={1}
          onChange={(value) => {
            setN(value);
            setOn(new Set());
          }}
          format={(v) => String(v)}
          note="Выключатели, нейроны, сотрудники, страны — что угодно с двумя состояниями"
        />
      }
      note="Ни один регулятор не может перебирать состояния объекта по одному. Управлять сложной системой можно только сокращая её разнообразие — моделью, классификацией, иерархией."
    >
      <div className="chips" role="group" aria-label="Двоичные элементы системы">
        {Array.from({ length: Math.min(n, 40) }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`chip${on.has(index) ? ' chip--active' : ''}`}
            aria-pressed={on.has(index)}
            style={{ minWidth: 40, fontFamily: 'var(--mono)' }}
            onClick={() =>
              setOn((current) => {
                const next = new Set(current);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              })
            }
          >
            {on.has(index) ? '1' : '0'}
          </button>
        ))}
        {n > 40 && <span className="pill">…и ещё {n - 40}</span>}
      </div>
      <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
        Сейчас показано одно состояние из <strong className="mono">{formatBig(states)}</strong>. Чтобы увидеть все,
        пришлось бы нажимать эти кнопки {humanTime(states)}.
      </p>
    </WidgetShell>
  );
}

function formatBig(value: number): string {
  if (value < 1e6) return value.toLocaleString('ru-RU');
  return value.toExponential(2).replace('e+', ' × 10^');
}

function humanTime(seconds: number): string {
  const units: [number, string][] = [
    [1, 'с'],
    [60, 'мин'],
    [3600, 'ч'],
    [86400, 'сут'],
    [31_557_600, 'лет'],
  ];
  let best = units[0];
  for (const unit of units) if (seconds / unit[0] >= 1) best = unit;
  const value = seconds / best[0];
  if (best[1] === 'лет' && value > 13.8e9) return `${(value / 13.8e9).toExponential(1)} возрастов Вселенной`;
  return `${value < 1000 ? value.toFixed(0) : value.toExponential(1)} ${best[1]}`;
}

export const requisiteVarietyBlock = defineBlock({
  type: 'game.requisite-variety',
  category: 'game',
  label: 'Игра в необходимое разнообразие',
  description: 'Мини-игра, в которой закон Эшби обнаруживается на собственном опыте проигрыша.',
  schema: varietySchema,
  component: RequisiteVarietyGame,
  scorable: true,
  cost: 6,
});

export const blackBoxBlock = defineBlock({
  type: 'game.black-box',
  category: 'game',
  label: 'Чёрный ящик',
  description: 'Определить устройство скрытой системы, задавая ей вопросы на входе.',
  schema: blackBoxSchema,
  component: BlackBoxGame,
  scorable: true,
  cost: 6,
});

export const varietyExplosionBlock = defineBlock({
  type: 'viz.variety-explosion',
  category: 'diagram',
  label: 'Взрыв разнообразия',
  description: 'Наглядная демонстрация комбинаторного роста числа состояний.',
  schema: explosionSchema,
  component: VarietyExplosion,
  scorable: true,
  cost: 3,
});
