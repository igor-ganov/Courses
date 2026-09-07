/**
 * Information as a felt quantity.
 *
 * `sim.entropy` — drag the probability bars and watch H move. The payoff is the
 * pairing with code length: the same slider that flattens the distribution also
 * lengthens the optimal code, which is what "information is measured in bits you
 * have to send" actually means.
 *
 * `sim.channel` — send a message through noise and try to get it back. Adding
 * redundancy costs channel capacity and buys correctness; the learner watches
 * both numbers move in opposite directions, which is the whole trade-off.
 */

import { useEffect, useMemo, useState } from 'react';
import { s, type Infer } from '@/core/schema';
import { defineBlock, type BlockViewProps } from '@/content/registry';
import { Readout, Slider, WidgetShell, useGoal } from './common';
import {
  bitErrorRate,
  channelCapacity,
  decodeRepetition,
  encodeRepetition,
  entropy,
  huffmanLengths,
  idealCodeLength,
  maxEntropy,
  meanCodeLength,
  normalize,
  redundancy,
  transmit,
  type Bit,
} from './models/information';

// ---------------------------------------------------------------------------
// Entropy
// ---------------------------------------------------------------------------

const entropySchema = s.object({
  title: s.withDefault(s.string(), 'Сколько неопределённости в сообщении'),
  hint: s.optional(s.string()),
  symbols: s.withDefault(s.array(s.string({ min: 1 }), { min: 2 }), () => ['А', 'Б', 'В', 'Г']),
  initial: s.optional(s.array(s.number({ min: 0 }))),
  /** Ask the learner to hit a particular entropy value. */
  goalEntropy: s.optional(s.object({ value: s.number(), tolerance: s.withDefault(s.number(), 0.05), text: s.string() })),
});

type EntropyProps = Infer<typeof entropySchema>;

function EntropyLab({ props, ctx, blockId }: BlockViewProps<EntropyProps>) {
  const [weights, setWeights] = useState<number[]>(
    () => props.initial ?? props.symbols.map(() => 1),
  );
  const { done, reach } = useGoal(ctx, blockId);

  const probs = useMemo(() => normalize(weights), [weights]);
  const h = entropy(probs);
  const hMax = maxEntropy(probs.length);
  const lengths = useMemo(() => huffmanLengths(probs), [probs]);
  const average = meanCodeLength(probs, lengths);

  const goal = props.goalEntropy;
  useEffect(() => {
    if (goal && !done && Math.abs(h - goal.value) <= goal.tolerance) reach(1, { entropy: h });
  }, [goal, h, done, reach]);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Двигайте вероятности символов. Энтропия — это средняя неожиданность следующего символа.'}
      goal={goal ? { text: goal.text, done } : undefined}
      badge={<span className="pill pill--signal">H = {h.toFixed(3)} бит</span>}
      readouts={
        <>
          <Readout label="Энтропия H" value={`${h.toFixed(3)} бит`} />
          <Readout label="Максимум log₂n" value={`${hMax.toFixed(3)} бит`} />
          <Readout
            label="Избыточность"
            value={`${(redundancy(probs) * 100).toFixed(1)}%`}
            tone={redundancy(probs) > 0.4 ? 'warn' : 'neutral'}
          />
          <Readout label="Средняя длина кода Хаффмана" value={`${average.toFixed(3)} бит/символ`} />
        </>
      }
      controls={
        <>
          <div className="widget__actions">
            <button type="button" className="btn btn--sm" onClick={() => setWeights(props.symbols.map(() => 1))}>
              Равномерно
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setWeights(props.symbols.map((_, index) => 2 ** (props.symbols.length - index - 1)))}
            >
              Степени двойки
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setWeights(props.symbols.map((_, index) => (index === 0 ? 100 : 1)))}
            >
              Почти определённость
            </button>
          </div>
        </>
      }
      note={
        <>
          Теорема Шеннона о кодировании: короче, чем <span className="mono">H = {h.toFixed(3)}</span> бит на символ, не
          закодировать в принципе. Хаффман сейчас тратит{' '}
          <span className="mono">{average.toFixed(3)}</span> — переплата{' '}
          <span className="mono">{(average - h).toFixed(3)}</span> бита возникает из-за того, что длины кодов целые.
        </>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        {props.symbols.map((symbol, index) => (
          <div key={symbol} style={{ display: 'grid', gridTemplateColumns: '34px 1fr 210px', gap: 12, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '1.1rem', color: 'var(--signal)' }}>{symbol}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weights[index]}
              aria-label={`Вес символа ${symbol}`}
              onChange={(event) =>
                setWeights((current) => current.map((w, i) => (i === index ? Number(event.target.value) : w)))
              }
            />
            <span className="mono faint" style={{ fontSize: '0.85rem' }}>
              p = {probs[index].toFixed(3)} · неожиданность {formatSurprise(probs[index])} бит · код {lengths[index]} бит
            </span>
          </div>
        ))}
      </div>

      <svg className="widget__canvas" viewBox="0 0 100 30" role="img" aria-label="Столбцы вероятностей символов" style={{ marginTop: 16 }}>
        {probs.map((p, index) => {
          const width = 92 / probs.length;
          const x = 4 + index * width;
          const height = Math.max(0.4, p * 26);
          return (
            <g key={index}>
              <rect x={x + 1} y={28 - height} width={width - 2} height={height} rx={0.8} fill="#35e0d0" opacity={0.75} />
              <text x={x + width / 2} y={29.6} textAnchor="middle" fontSize={2.4} fill="#6f7c9c">
                {props.symbols[index]}
              </text>
            </g>
          );
        })}
      </svg>
    </WidgetShell>
  );
}

const formatSurprise = (p: number) => (p > 0 ? idealCodeLength(p).toFixed(2) : '∞');

// ---------------------------------------------------------------------------
// Noisy channel
// ---------------------------------------------------------------------------

const channelSchema = s.object({
  title: s.withDefault(s.string(), 'Канал с шумом'),
  hint: s.optional(s.string()),
  messageLength: s.withDefault(s.number({ min: 4, max: 64, int: true }), 16),
  goalText: s.optional(s.string()),
});

type ChannelProps = Infer<typeof channelSchema>;

function ChannelLab({ props, ctx, blockId }: BlockViewProps<ChannelProps>) {
  const [noise, setNoise] = useState(0.12);
  const [repetition, setRepetition] = useState(1);
  const [seed, setSeed] = useState(7);
  const { done, reach } = useGoal(ctx, blockId);

  const message = useMemo<Bit[]>(
    () => Array.from({ length: props.messageLength }, (_, i) => ((i * 7 + 3) % 5 < 2 ? 1 : 0) as Bit),
    [props.messageLength],
  );

  const encoded = useMemo(() => encodeRepetition(message, repetition), [message, repetition]);
  const received = useMemo(() => transmit(encoded, noise, seed), [encoded, noise, seed]);
  const decoded = useMemo(() => decodeRepetition(received, repetition), [received, repetition]);
  const errors = bitErrorRate(message, decoded);
  const capacity = channelCapacity(noise);
  const rate = 1 / repetition;

  // Getting a clean message through a genuinely noisy channel is the exercise.
  useEffect(() => {
    if (!done && errors === 0 && noise >= 0.1 && repetition > 1) reach(1, { noise, repetition });
  }, [done, errors, noise, repetition, reach]);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Шум портит биты. Избыточность их восстанавливает — но занимает место в канале.'}
      goal={{
        text: props.goalText ?? 'доставить сообщение без единой ошибки при шуме не меньше 10%',
        done,
      }}
      badge={
        <span className={`pill pill--${errors === 0 ? 'ok' : 'warn'}`}>
          ошибок после декодирования: {(errors * 100).toFixed(0)}%
        </span>
      }
      readouts={
        <>
          <Readout label="Шум канала" value={`${(noise * 100).toFixed(0)}%`} />
          <Readout label="Пропускная способность" value={`${capacity.toFixed(3)} бит/символ`} tone={capacity < 0.3 ? 'bad' : 'neutral'} />
          <Readout label="Скорость кода" value={`${rate.toFixed(2)}`} tone={rate < capacity ? 'good' : 'warn'} />
          <Readout
            label="Ошибок в принятом потоке"
            value={`${(bitErrorRate(encoded, received) * 100).toFixed(0)}%`}
          />
        </>
      }
      controls={
        <>
          <Slider
            label="Вероятность искажения бита"
            value={noise}
            min={0}
            max={0.5}
            step={0.01}
            onChange={setNoise}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            note="При 50% канал не передаёт ничего: выход не зависит от входа"
          />
          <Slider
            label="Повторение каждого бита"
            value={repetition}
            min={1}
            max={9}
            step={2}
            onChange={setRepetition}
            format={(v) => `×${v}`}
            note="Голосование большинством: простейший помехоустойчивый код"
          />
          <div className="widget__actions">
            <button type="button" className="btn btn--sm" onClick={() => setSeed((current) => current + 1)}>
              Передать заново
            </button>
          </div>
        </>
      }
      note={
        rate > capacity
          ? `Скорость кода ${rate.toFixed(2)} выше пропускной способности ${capacity.toFixed(2)}: по теореме Шеннона надёжная передача на такой скорости невозможна, сколько ни старайся.`
          : `Скорость ${rate.toFixed(2)} ниже пропускной способности ${capacity.toFixed(2)} — принципиальный запас есть. Повторение расходует его расточительно; настоящие коды (Хэмминга, LDPC) подходят к границе куда ближе.`
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <BitRow label="отправлено" bits={message} tone="#7c6cff" />
        <BitRow label="в канале" bits={encoded} tone="#5a6a92" compact />
        <BitRow label="принято" bits={received} tone="#ffb545" compact reference={encoded} />
        <BitRow label="декодировано" bits={decoded} tone="#35e0d0" reference={message} />
      </div>
    </WidgetShell>
  );
}

function BitRow({
  label,
  bits,
  tone,
  compact,
  reference,
}: {
  label: string;
  bits: readonly number[];
  tone: string;
  compact?: boolean;
  reference?: readonly number[];
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'center' }}>
      <span className="readout__label">{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 2 : 3 }}>
        {bits.map((bit, index) => {
          const corrupted = reference && reference[index] !== undefined && reference[index] !== bit;
          return (
            <span
              key={index}
              className="mono"
              style={{
                width: compact ? 15 : 19,
                height: compact ? 15 : 19,
                display: 'grid',
                placeItems: 'center',
                fontSize: compact ? 9 : 11,
                borderRadius: 4,
                background: corrupted ? 'rgba(255,107,107,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${corrupted ? 'var(--danger)' : 'var(--line)'}`,
                color: corrupted ? '#ffc7c7' : tone,
              }}
            >
              {bit}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const entropyLabBlock = defineBlock({
  type: 'sim.entropy',
  category: 'simulation',
  label: 'Лаборатория энтропии',
  description: 'Интерактивные вероятности, энтропия Шеннона и оптимальные длины кодов.',
  schema: entropySchema,
  component: EntropyLab,
  scorable: true,
  cost: 5,
});

export const channelLabBlock = defineBlock({
  type: 'sim.channel',
  category: 'simulation',
  label: 'Канал с шумом',
  description: 'Передача сообщения через искажающий канал с помехоустойчивым кодированием.',
  schema: channelSchema,
  component: ChannelLab,
  scorable: true,
  cost: 5,
});
