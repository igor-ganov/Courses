/**
 * The Lorenz attractor in three dimensions.
 *
 * Deterministic, bounded, and impossible to predict for long: the trajectory is
 * drawn live so the learner watches the two "wings" build up, then launches a
 * second run a millionth of a unit away and watches the pair separate. Wiener
 * and Ashby both wrote as if enough measurement implied enough control; this is
 * the object that says otherwise, and it is worth meeting in a form you can
 * rotate with your thumb.
 *
 * Loaded lazily (the block is marked `heavy`), while the service worker still
 * precaches the chunk so it works with no connection.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { type BlockViewProps } from '@/content/registry';
import { Readout, Slider, Switch, WidgetShell, useGoal } from './../common';
import { DEFAULT_LORENZ, stepLorenz, type Vec3 } from './../models/dynamics';

import type { PhaseSpaceProps as Props } from './schemas';

const SCALE = 0.55;
const toVector = (p: Vec3) => new THREE.Vector3(p.x * SCALE, (p.z - 25) * SCALE, p.y * SCALE);

function Trajectories({
  rho,
  speed,
  twin,
  maxPoints,
  onSeparation,
}: {
  rho: number;
  speed: number;
  twin: boolean;
  maxPoints: number;
  onSeparation(distance: number): void;
}) {
  // Start with a stretch of trajectory already drawn: an empty box teaches
  // nothing, and the two wings are the whole point of arriving here.
  const warm = useMemo(() => warmUp(rho), [rho]);
  const a = useRef<Vec3>(warm.a);
  const b = useRef<Vec3>(warm.b);
  const [pathA, setPathA] = useState<THREE.Vector3[]>(warm.pathA);
  const [pathB, setPathB] = useState<THREE.Vector3[]>(warm.pathB);
  const head = useRef<THREE.Mesh>(null);
  const headTwin = useRef<THREE.Mesh>(null);
  const frame = useRef(0);

  useFrame(() => {
    const params = { ...DEFAULT_LORENZ, rho };
    const stepsPerFrame = Math.max(1, Math.round(speed));
    for (let i = 0; i < stepsPerFrame; i += 1) {
      a.current = stepLorenz(a.current, 0.004, params);
      if (twin) b.current = stepLorenz(b.current, 0.004, params);
    }

    const nextA = toVector(a.current);
    const nextB = toVector(b.current);
    setPathA((current) => (current.length > maxPoints ? [...current.slice(1), nextA] : [...current, nextA]));
    if (twin) setPathB((current) => (current.length > maxPoints ? [...current.slice(1), nextB] : [...current, nextB]));

    if (head.current) head.current.position.copy(nextA);
    if (headTwin.current) headTwin.current.position.copy(nextB);

    frame.current += 1;
    if (frame.current % 12 === 0 && twin) {
      onSeparation(
        Math.hypot(a.current.x - b.current.x, a.current.y - b.current.y, a.current.z - b.current.z),
      );
    }
  });

  return (
    <>
      {pathA.length > 1 && <Line points={pathA} color="#35e0d0" lineWidth={1.4} transparent opacity={0.9} />}
      {twin && pathB.length > 1 && <Line points={pathB} color="#ff8cd0" lineWidth={1.4} transparent opacity={0.8} />}
      <mesh ref={head}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {twin && (
        <mesh ref={headTwin}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshBasicMaterial color="#ff8cd0" />
        </mesh>
      )}
    </>
  );
}

const WARM_UP_STEPS = 1500;

/** Run the pair forward before the first frame so the shape is already there. */
function warmUp(rho: number) {
  const params = { ...DEFAULT_LORENZ, rho };
  let a: Vec3 = { x: 1, y: 1, z: 1 };
  let b: Vec3 = { x: 1.000001, y: 1, z: 1 };
  const pathA: THREE.Vector3[] = [];
  const pathB: THREE.Vector3[] = [];
  for (let i = 0; i < WARM_UP_STEPS; i += 1) {
    a = stepLorenz(a, 0.004, params);
    b = stepLorenz(b, 0.004, params);
    pathA.push(toVector(a));
    pathB.push(toVector(b));
  }
  return { a, b, pathA, pathB };
}

function PhaseSpace({ props, ctx, blockId }: BlockViewProps<Props>) {
  const [rho, setRho] = useState(28);
  const [speed, setSpeed] = useState(8);
  const [twin, setTwin] = useState(props.showTwin);
  const [separation, setSeparation] = useState(0.000001);
  const [runKey, setRunKey] = useState(0);
  const { done, reach } = useGoal(ctx, blockId);

  // Watching the twin trajectories come apart *is* the exercise.
  useEffect(() => {
    if (!done && twin && separation > 5) reach(1, { separation });
  }, [done, twin, separation, reach]);

  const regime = useMemo(() => {
    if (rho < 1) return 'единственная устойчивая точка: всё затухает в покой';
    if (rho < 24.06) return 'две устойчивые точки: система выбирает режим и остаётся в нём';
    return 'странный аттрактор: траектория ограничена, но не повторяется';
  }, [rho]);

  return (
    <WidgetShell
      title={props.title}
      hint={props.hint ?? 'Вращайте сцену перетаскиванием, приближайте колесом. Две траектории стартуют почти из одной точки.'}
      goal={twin ? { text: 'дождаться, пока близнецы разойдутся', done: done || separation > 5 } : undefined}
      badge={<span className="pill pill--signal">ρ = {rho.toFixed(1)}</span>}
      readouts={
        <>
          <Readout label="Расхождение близнецов" value={separation.toExponential(2)} tone={separation > 1 ? 'warn' : 'neutral'} />
          <Readout label="Начальная разница" value="1 × 10⁻⁶" />
          <Readout label="Режим" value={regime} />
        </>
      }
      controls={
        <>
          <Slider
            label="Параметр ρ"
            value={rho}
            min={0.5}
            max={45}
            step={0.5}
            onChange={(value) => {
              setRho(value);
              setSeparation(0.000001);
              setRunKey((k) => k + 1);
            }}
            format={(v) => v.toFixed(1)}
            note="При ρ ≈ 24,06 качественно меняется всё поведение"
          />
          <Slider label="Скорость" value={speed} min={1} max={20} step={1} onChange={setSpeed} format={(v) => `×${v}`} />
          <Switch label="Показать близнеца" checked={twin} onChange={setTwin} />
          <div className="widget__actions">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setSeparation(0.000001);
                setRunKey((k) => k + 1);
              }}
            >
              Запустить заново
            </button>
          </div>
        </>
      }
      note="Две системы, различающиеся в шестом знаке, идут вместе, потом расходятся полностью. Уравнения известны точно, начальные условия — почти точно, и этого «почти» достаточно, чтобы прогноз развалился."
    >
      <div style={{ height: 380, borderRadius: 10, overflow: 'hidden', background: '#04060d' }}>
        <Canvas camera={{ position: [26, 8, 26], fov: 46 }} dpr={[1, 2]}>
          <color attach="background" args={['#04060d']} />
          <ambientLight intensity={0.7} />
          <pointLight position={[20, 20, 20]} intensity={0.5} />
          <gridHelper args={[60, 12, '#1a2338', '#121a2c']} position={[0, -16, 0]} />
          <Trajectories
            key={runKey}
            rho={rho}
            speed={speed}
            twin={twin}
            maxPoints={props.maxPoints}
            onSeparation={setSeparation}
          />
          <OrbitControls enablePan={false} minDistance={12} maxDistance={70} autoRotate autoRotateSpeed={0.35} />
        </Canvas>
      </div>
    </WidgetShell>
  );
}

export default PhaseSpace;
