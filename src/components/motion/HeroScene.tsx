"use client";

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

// ─── Animated particle sphere representing the "agent constellation" ────────

function ParticleField({ count = 800 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!);

  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const primary = new THREE.Color("#818cf8");
    const violet = new THREE.Color("#a855f7");
    const cyan = new THREE.Color("#22d3ee");

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere for even distribution
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
      const r = 2.4 + (Math.random() - 0.5) * 0.6;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const mix = Math.random();
      const color = mix < 0.5 ? primary : mix < 0.8 ? violet : cyan;
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;

      siz[i] = Math.random() * 0.035 + 0.015;
    }
    return [pos, col, siz];
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.getElapsedTime() * 0.08;
      points.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.15;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─── Rotating icosahedron core ──────────────────────────────────────────────

function OrbitalCore() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const wireRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.25;
      meshRef.current.rotation.y = t * 0.35;
    }
    if (wireRef.current) {
      wireRef.current.rotation.x = -t * 0.15;
      wireRef.current.rotation.y = -t * 0.2;
      const s = 1.15 + Math.sin(t * 0.7) * 0.05;
      wireRef.current.scale.set(s, s, s);
    }
  });

  return (
    <>
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color="#4f46e5"
            emissive="#8b5cf6"
            emissiveIntensity={0.4}
            roughness={0.3}
            metalness={0.7}
            wireframe={false}
            transparent
            opacity={0.6}
          />
        </mesh>
      </Float>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#a5b4fc" wireframe transparent opacity={0.15} />
      </mesh>
    </>
  );
}

// ─── Orbiting satellite nodes ───────────────────────────────────────────────

function OrbitingSatellite({ radius, speed, color, size = 0.08, offset = 0 }: {
  radius: number;
  speed: number;
  color: string;
  size?: number;
  offset?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + offset;
    if (ref.current) {
      ref.current.position.x = Math.cos(t) * radius;
      ref.current.position.z = Math.sin(t) * radius;
      ref.current.position.y = Math.sin(t * 0.5) * 0.5;
    }
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} />
    </mesh>
  );
}

// ─── Main scene ─────────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.2} color="#818cf8" />
      <pointLight position={[-10, -10, -10]} intensity={0.6} color="#22d3ee" />
      <OrbitalCore />
      <ParticleField count={600} />
      <OrbitingSatellite radius={2.9} speed={0.4} color="#818cf8" />
      <OrbitingSatellite radius={3.2} speed={-0.3} color="#a855f7" offset={2} />
      <OrbitingSatellite radius={3.5} speed={0.5} color="#22d3ee" offset={4} />
      <OrbitingSatellite radius={2.6} speed={-0.6} color="#f472b6" offset={1} size={0.06} />
    </>
  );
}

// ─── Exported hero scene wrapper ────────────────────────────────────────────

export default function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div className={`relative pointer-events-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
