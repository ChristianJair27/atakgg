// src/components/ChampionScene.tsx
// 3D champion display using React Three Fiber + GSAP scroll
import { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, Float, Stars, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ─── Orbiting particles ring ──────────────────────────────────────────────────
function ParticleRing({ count = 120, radius = 2.8 }: { count?: number; radius?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spread = (Math.random() - 0.5) * 0.4;
      pos[i * 3]     = Math.cos(angle) * (radius + spread);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      pos[i * 3 + 2] = Math.sin(angle) * (radius + spread);
    }
    return pos;
  }, [count, radius]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.15;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#ff4444" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

// ─── Energy orbs floating around ─────────────────────────────────────────────
function EnergyOrb({ position, color, speed }: { position: [number,number,number]; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
    ref.current.rotation.x += 0.01;
    ref.current.rotation.z += 0.008;
  });
  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.12, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.8} />
    </mesh>
  );
}

// ─── Champion splash plane ────────────────────────────────────────────────────
function ChampionPlane({ splashUrl, scrollRef }: { splashUrl: string; scrollRef: React.RefObject<HTMLDivElement> }) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const glowRef  = useRef<THREE.Mesh>(null);

  const texture = useTexture(splashUrl);
  texture.minFilter = THREE.LinearFilter;

  // GSAP ScrollTrigger — mueve y rota el grupo al scroll
  useEffect(() => {
    if (!groupRef.current || !scrollRef.current) return;
    const el = scrollRef.current;
    const ctx = gsap.context(() => {
      gsap.to(groupRef.current!.rotation, {
        y: Math.PI * 0.4,
        x: -0.3,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom center',
          scrub: 1.5,
        },
      });
      gsap.to(groupRef.current!.position, {
        y: -1.2,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top top',
          end: 'bottom center',
          scrub: 1.5,
        },
      });
    });
    return () => ctx.revert();
  }, [scrollRef]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.04;
      glowRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glow behind */}
      <mesh ref={glowRef} position={[0, 0, -0.3]}>
        <planeGeometry args={[3.6, 5.4]} />
        <meshBasicMaterial color="#cc1111" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>

      {/* Champion splash */}
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.15}>
        <mesh ref={meshRef}>
          <planeGeometry args={[3.2, 4.8]} />
          <meshStandardMaterial
            map={texture}
            transparent
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      </Float>

      {/* Rim glow frame */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[3.25, 4.85]} />
        <meshBasicMaterial color="#ff2222" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Fallback while texture loads ────────────────────────────────────────────
function ChampionPlaceholder() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.5;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.2, 2]} />
      <MeshDistortMaterial color="#cc2222" emissive="#440000" emissiveIntensity={0.5} distort={0.4} speed={2} roughness={0.1} />
    </mesh>
  );
}

// ─── Scene root ───────────────────────────────────────────────────────────────
function Scene({ splashUrl, scrollRef }: { splashUrl?: string; scrollRef: React.RefObject<HTMLDivElement> }) {
  const orbs: [number,number,number][] = [
    [-2.5, 0.5, 0.5], [2.5, -0.3, 0.3],
    [-1.8, 1.8, -0.5], [2.2, 1.5, -0.3],
    [0.5, -2, 0.8], [-0.5, 2.2, 0.2],
  ];
  const orbColors = ['#ff3333','#ff6644','#ff2266','#dd0044','#ff4400','#cc1133'];

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
      <pointLight position={[-3, 3, 2]} intensity={2} color="#ff2222" decay={2} />
      <pointLight position={[3, -2, -2]} intensity={1.5} color="#4422ff" decay={2} />
      <pointLight position={[0, 0, 4]} intensity={1} color="#ff6666" decay={2} />

      <Stars radius={60} depth={50} count={1200} factor={3} saturation={0} fade speed={0.3} />
      <Sparkles count={30} size={1.2} scale={8} speed={0.2} color="#ff4444" opacity={0.3} />

      {splashUrl ? (
        <Suspense fallback={<ChampionPlaceholder />}>
          <ChampionPlane splashUrl={splashUrl} scrollRef={scrollRef} />
        </Suspense>
      ) : (
        <ChampionPlaceholder />
      )}

      <ParticleRing radius={3} count={80} />
      <ParticleRing radius={3.8} count={40} />

      {orbs.slice(0, 4).map((pos, i) => (
        <EnergyOrb key={i} position={pos} color={orbColors[i % orbColors.length]} speed={0.8 + i * 0.2} />
      ))}
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
interface ChampionSceneProps {
  splashUrl?: string;
  scrollRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

export function ChampionScene({ splashUrl, scrollRef, className = '' }: ChampionSceneProps) {
  return (
    <div className={`${className} relative`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
      >
        <Scene splashUrl={splashUrl} scrollRef={scrollRef} />
      </Canvas>
      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)' }} />
    </div>
  );
}
