"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, Line, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { AGENT_ORDER, AGENTS } from "@/lib/agents";

function Core() {
  const outer = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (outer.current) {
      outer.current.rotation.x = t * 0.12;
      outer.current.rotation.y = t * 0.18;
    }
    if (inner.current) {
      inner.current.rotation.y = -t * 0.3;
      const s = 1 + Math.sin(t * 1.6) * 0.04;
      inner.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      <mesh ref={outer}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.35} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.85, 2]} />
        <meshStandardMaterial color="#6d28d9" emissive="#7c3aed" emissiveIntensity={1.4} roughness={0.25} metalness={0.6} />
      </mesh>
      <pointLight color="#a78bfa" intensity={14} distance={9} />
    </group>
  );
}

function AgentNode({ index, total }: { index: number; total: number }) {
  const ref = useRef<THREE.Group>(null);
  const role = AGENT_ORDER[index];
  const def = AGENTS[role];
  const radius = 3.2;
  const tilt = 0.45;
  const speed = 0.16;
  const offset = (index / total) * Math.PI * 2;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + offset;
    if (!ref.current) return;
    ref.current.position.set(Math.cos(t) * radius, Math.sin(t * 2) * 0.35, Math.sin(t) * radius * Math.cos(tilt));
  });

  return (
    <group ref={ref}>
      <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshStandardMaterial color={def.color} emissive={def.color} emissiveIntensity={1.2} roughness={0.3} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.3, 0.33, 40]} />
          <meshBasicMaterial color={def.color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <Html position={[0, -0.42, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
          <span style={{ color: "#d3d9ea", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", textShadow: "0 1px 8px #06070c", letterSpacing: 0.2 }}>{def.name}</span>
        </Html>
      </Float>
    </group>
  );
}

function OrbitRings() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const radius = 3.2;
    const tilt = 0.45;
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius * Math.cos(tilt)));
    }
    return pts;
  }, []);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.03;
  });
  return (
    <group ref={ref}>
      <Line points={points} color="#3a4262" lineWidth={1} transparent opacity={0.7} />
      <Line points={points.map((p) => p.clone().multiplyScalar(0.62))} color="#272d47" lineWidth={1} transparent opacity={0.6} rotation={[0.9, 0.2, 0.3]} />
      <Line points={points.map((p) => p.clone().multiplyScalar(1.35))} color="#1b2035" lineWidth={1} transparent opacity={0.6} rotation={[-0.5, 0.6, 0.1]} />
    </group>
  );
}

function CodeStream() {
  const count = 260;
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
    }
    return arr;
  }, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) + delta * 0.25;
      if (y > 5) y = -5;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#8590b0" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function Rig() {
  useFrame(({ camera, pointer }) => {
    camera.position.x += (pointer.x * 0.8 - camera.position.x) * 0.04;
    camera.position.y += (pointer.y * 0.5 + 0.6 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene() {
  return (
    <Canvas camera={{ position: [0, 0.6, 7.5], fov: 45 }} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} className="!absolute inset-0">
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 4]} intensity={1.1} color="#c4b5fd" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#22d3ee" />
      <Core />
      <OrbitRings />
      {AGENT_ORDER.map((_, i) => (
        <AgentNode key={i} index={i} total={AGENT_ORDER.length} />
      ))}
      <CodeStream />
      <Sparkles count={60} scale={[12, 6, 6]} size={2.2} speed={0.3} color="#a78bfa" opacity={0.5} />
      <Rig />
    </Canvas>
  );
}
