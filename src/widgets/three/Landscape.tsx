/**
 * The stability landscape.
 *
 * "Equilibrium", "basin of attraction" and "a disturbance large enough to change
 * the regime" are three of the hardest words in the course, and all three become
 * obvious the moment they are a surface with valleys and a ball rolling on it.
 * Release the ball from different points and watch where it settles; deepen or
 * flatten a valley and watch the boundary between basins move. Resilience stops
 * being a metaphor and becomes the depth of a hole you can see.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { type BlockViewProps } from '@/content/registry';
import { Readout, Slider, WidgetShell, useGoal } from './../common';
import { DEFAULT_WELLS, basinOf, potentialAt, rollBall, type Vec2, type Well } from './../models/dynamics';

import type { LandscapeProps as Props } from './schemas';

const EXTENT = 9;
const HEIGHT_SCALE = 2.4;

function Surface({ wells, resolution }: { wells: readonly Well[]; resolution: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(EXTENT * 2, EXTENT * 2, resolution, resolution);
    const position = geo.attributes.position;
    const colours = new Float32Array(position.count * 3);
    const low = new THREE.Color('#1b2a6b');
    const high = new THREE.Color('#3ee0c8');

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const v = potentialAt(x, y, wells);
      position.setZ(i, -v * HEIGHT_SCALE);
      const t = Math.min(1, Math.max(0, (v + 1.4) / 2.6));
      const colour = low.clone().lerp(high, t);
      colours[i * 3] = colour.r;
      colours[i * 3 + 1] = colour.g;
      colours[i * 3 + 2] = colour.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.computeVertexNormals();
    return geo;
  }, [wells, resolution]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial vertexColors flatShading={false} roughness={0.82} metalness={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Ball({
  wells,
  position,
  rolling,
  onSettle,
  onMove,
}: {
  wells: readonly Well[];
  position: Vec2;
  rolling: boolean;
  onSettle(at: Vec2): void;
  onMove(at: Vec2): void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const current = useRef(position);
  const still = useRef(0);

  useEffect(() => {
    current.current = position;
  }, [position]);

  useFrame(() => {
    if (rolling) {
      const next = rollBall(current.current, wells, 0.12);
      const moved = Math.hypot(next.x - current.current.x, next.y - current.current.y);
      current.current = next;
      onMove(next);
      still.current = moved < 1e-4 ? still.current + 1 : 0;
      if (still.current === 20) onSettle(next);
    }
    if (mesh.current) {
      const height = -potentialAt(current.current.x, current.current.y, wells) * HEIGHT_SCALE;
      mesh.current.position.set(current.current.x, height + 0.42, current.current.y);
    }
  });

  return (
    <mesh ref={mesh} castShadow>
      <sphereGeometry args={[0.42, 24, 24]} />
      <meshStandardMaterial color="#ffb545" emissive="#8a5600" emissiveIntensity={0.35} roughness={0.3} />
    </mesh>
  );
}

function Landscape({ props, ctx, blockId }: BlockViewProps<Props>) {
  const [depths, setDepths] = useState<number[]>(() => DEFAULT_WELLS.map((w) => w.depth));
  const [position, setPosition] = useState<Vec2>({ x: -1.2, y: 4.5 });
  const [live, setLive] = useState<Vec2>({ x: -1.2, y: 4.5 });
  const [rolling, setRolling] = useState(false);
  const [visitedBasins, setVisitedBasins] = useState<Set<number>>(new Set());
  const { done, reach } = useGoal(ctx, blockId);

  const wells = useMemo<Well[]>(
    () => DEFAULT_WELLS.map((well, index) => ({ ...well, depth: depths[index] })),
    [depths],
  );

  useEffect(() => {
    if (!done && visitedBasins.size >= 2) reach(1, { basins: [...visitedBasins] });
  }, [visitedBasins, done, reach]);

  const settle = (at: Vec2) => {
    setRolling(false);
    setPosition(at);
    const basin = basinOf(at, wells);
    setVisitedBasins((current) => new Set([...current, basin]));
  };

  const startFrom = (x: number, y: number) => {
    setPosition({ x, y });
    setLive({ x, y });
    setRolling(true);
  };

  const currentBasin = basinOf(live, wells);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Отпустите шарик из разных точек и посмотрите, в какую впадину он скатится. Затем измените глубину впадин.'}
      goal={{ text: 'привести систему в два разных режима', done: done || visitedBasins.size >= 2 }}
      badge={<span className="pill pill--accent">режим: {wells[currentBasin]?.label ?? '—'}</span>}
      readouts={
        <>
          <Readout label="Потенциал в точке" value={potentialAt(live.x, live.y, wells).toFixed(3)} />
          <Readout label="Бассейн притяжения" value={wells[currentBasin]?.label ?? '—'} />
          <Readout label="Режимов посещено" value={`${visitedBasins.size} из ${wells.length}`} tone={visitedBasins.size >= 2 ? 'good' : 'neutral'} />
        </>
      }
      controls={
        <>
          {wells.map((well, index) => (
            <Slider
              key={well.label}
              label={`Глубина: ${well.label}`}
              value={depths[index]}
              min={0}
              max={2.5}
              step={0.05}
              onChange={(value) => setDepths((current) => current.map((d, i) => (i === index ? value : d)))}
              format={(v) => v.toFixed(2)}
              note={index === 0 ? 'Глубокая впадина = устойчивый режим, из которого трудно выбить' : undefined}
            />
          ))}
          <div className="widget__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={() => startFrom(-1.2, 4.5)}>
              Отпустить сверху
            </button>
            <button type="button" className="btn btn--sm" onClick={() => startFrom(2.2, 1.4)}>
              Отпустить справа
            </button>
            <button type="button" className="btn btn--sm" onClick={() => startFrom(-6.5, -2.5)}>
              Отпустить слева
            </button>
          </div>
        </>
      }
      note="Устойчивость — это не «система не меняется», а «система возвращается». Сделайте одну впадину мелкой: режим ещё существует, но теперь любого толчка хватит, чтобы система ушла в другой и уже не вернулась."
    >
      <div style={{ height: 380, borderRadius: 10, overflow: 'hidden', background: '#04060d' }}>
        <Canvas camera={{ position: [0, 11, 13], fov: 48 }} dpr={[1, 2]} shadows>
          <color attach="background" args={['#04060d']} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[8, 14, 6]} intensity={1.1} castShadow />
          <Surface wells={wells} resolution={props.resolution} />
          <Ball
            wells={wells}
            position={position}
            rolling={rolling}
            onSettle={settle}
            onMove={setLive}
          />
          <OrbitControls enablePan={false} minDistance={8} maxDistance={30} maxPolarAngle={Math.PI / 2.1} />
        </Canvas>
      </div>
    </WidgetShell>
  );
}

export default Landscape;
