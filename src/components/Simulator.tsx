import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Text } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import type { SimState, Target } from "@/lib/gestures";

const TV_COLORS: string[] = ["#3a86c8", "#e07a3f", "#4caf7a", "#c94f7c"];

function Door({ open, active }: { open: boolean; active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (!ref.current) return;
    const target = open ? -Math.PI / 2.2 : 0;
    ref.current.rotation.y += (target - ref.current.rotation.y) * (1 - Math.exp(-4 * Math.min(d, 0.05)));
  });
  return (
    <group position={[-2.6, 0, -3.95]}>
      <mesh position={[0.6, 1.1, -0.02]}>
        <boxGeometry args={[1.35, 2.3, 0.05]} />
        <meshStandardMaterial color="#1a1410" />
      </mesh>
      <group ref={ref}>
        <mesh position={[0.6, 1.05, 0.03]} castShadow>
          <boxGeometry args={[1.2, 2.1, 0.08]} />
          <meshStandardMaterial color={active ? "#b07a45" : "#8a5a32"} roughness={0.6} />
        </mesh>
        <mesh position={[1.05, 1.05, 0.1]}>
          <sphereGeometry args={[0.05]} />
          <meshStandardMaterial color="#d8b25a" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function Fan({ speed, active }: { speed: number; active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const v = useRef(0);
  useFrame((_, d) => {
    const dt = Math.min(d, 0.05);
    v.current += (speed * 6 - v.current) * (1 - Math.exp(-2 * dt));
    if (ref.current) ref.current.rotation.y += v.current * dt;
  });
  return (
    <group position={[0, 3.3, 0]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <group ref={ref}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.15, 0.12]} />
          <meshStandardMaterial color={active ? "#f0c060" : "#ddd"} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]} position={[0, 0, 0]}>
            <boxGeometry args={[1.6, 0.02, 0.22]} />
            <meshStandardMaterial color="#c9b79a" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Emergency({ on }: { on: boolean }) {
  const ref = useRef<THREE.PointLight>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const p = on ? (Math.sin(clock.elapsedTime * 10) > 0 ? 1 : 0.1) : 0;
    if (ref.current) ref.current.intensity = p * 8;
    if (mat.current) mat.current.emissiveIntensity = p * 3;
  });
  return (
    <group position={[2.8, 3.2, -3.9]}>
      <mesh>
        <sphereGeometry args={[0.18]} />
        <meshStandardMaterial ref={mat} color="#7a1010" emissive="#ff2020" />
      </mesh>
      <pointLight ref={ref} color="#ff3030" distance={8} />
    </group>
  );
}

function Scene({ s, target }: { s: SimState; target: Target | null }) {
  const lampI = s.lightOn ? s.brightness * 6 : 0;
  return (
    <>
      <color attach="background" args={["#1c1916"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 4]} intensity={0.6} castShadow />
      <Environment resolution={64}>
        <Lightformer intensity={1.2} position={[0, 5, 0]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.6} color="#ffd9a8" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
      </Environment>
      {/* room */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#6b5440" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2, -4]} receiveShadow>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#d9cdb8" />
      </mesh>
      <mesh position={[-4, 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color="#cbbfa8" />
      </mesh>
      <Door open={s.doorOpen} active={target === "door"} />
      {/* lamp */}
      <group position={[-3.2, 0, -1]}>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.6]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <coneGeometry args={[0.35, 0.4, 24, 1, true]} />
          <meshStandardMaterial
            color={target === "light" ? "#ffd27a" : "#f2e6c8"}
            emissive="#ffcc66"
            emissiveIntensity={s.lightOn ? s.brightness * 0.8 : 0}
            side={THREE.DoubleSide}
          />
        </mesh>
        <pointLight position={[0, 1.6, 0]} intensity={lampI} color="#ffcf88" distance={9} castShadow />
      </group>
      <Fan speed={s.fanSpeed} active={target === "fan"} />
      {/* TV */}
      <group position={[1.2, 1.5, -3.92]}>
        <mesh>
          <boxGeometry args={[2, 1.2, 0.08]} />
          <meshStandardMaterial color={target === "tv" ? "#3a3020" : "#111"} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[1.85, 1.05]} />
          <meshStandardMaterial
            color={s.tvOn ? TV_COLORS[s.channel]! : "#050505"}
            emissive={s.tvOn ? TV_COLORS[s.channel]! : "#000"}
            emissiveIntensity={s.tvOn ? 0.9 : 0}
          />
        </mesh>
        {s.tvOn && (
          <Text position={[0, 0, 0.06]} fontSize={0.18} color="#fff">
            {`CH ${s.channel + 1}`}
          </Text>
        )}
      </group>
      <Emergency on={s.emergency} />
      <OrbitControls target={[0, 1.4, -1.5]} maxPolarAngle={Math.PI / 2.1} enablePan={false} />
    </>
  );
}

export function Simulator({ s, target }: { s: SimState; target: Target | null }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [2.5, 2.4, 4], fov: 55 }}>
      <Scene s={s} target={target} />
    </Canvas>
  );
}
