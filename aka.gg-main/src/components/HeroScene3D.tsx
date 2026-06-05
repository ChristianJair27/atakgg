// src/components/HeroScene3D.tsx — Katarina 3D model + red particle field
import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Sparkles, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// ── Katarina model ────────────────────────────────────────────────────────────
function KatarinaModel() {
  const { scene } = useGLTF('/models/katarina.glb');
  const groupRef = useRef<THREE.Group>(null);

  // Clone the scene so each instance is independent
  const cloned = useMemo(() => scene.clone(), [scene]);

  // Apply red-tinted material override to look cinematic
  useMemo(() => {
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => {
            const mat = (m as THREE.MeshStandardMaterial).clone();
            mat.envMapIntensity = 1.2;
            return mat;
          });
        } else {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.envMapIntensity = 1.2;
          mesh.material = mat;
        }
      }
    });
  }, [cloned]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.3;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
      <group ref={groupRef} scale={1.8} position={[0.4, -1.5, 0]}>
        <primitive object={cloned} />
      </group>
    </Float>
  );
}

// ── Floating energy rings ─────────────────────────────────────────────────────
function EnergyRings() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring1.current) { ring1.current.rotation.z = t * 0.4; ring1.current.rotation.x = t * 0.15; }
    if (ring2.current) { ring2.current.rotation.z = -t * 0.3; ring2.current.rotation.y = t * 0.2; }
    if (ring3.current) { ring3.current.rotation.x = t * 0.35; ring3.current.rotation.z = t * 0.1; }
  });

  return (
    <group>
      <mesh ref={ring1} position={[0, 0, 0]}>
        <torusGeometry args={[2.5, 0.015, 8, 80]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} transparent opacity={0.4} />
      </mesh>
      <mesh ref={ring2} position={[0, 0, 0]}>
        <torusGeometry args={[2.0, 0.01, 8, 80]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={1.5} transparent opacity={0.3} />
      </mesh>
      <mesh ref={ring3} position={[0, 0, 0]}>
        <torusGeometry args={[3.0, 0.008, 8, 80]} />
        <meshStandardMaterial color="#b91c1c" emissive="#b91c1c" emissiveIntensity={1} transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ── Orbiting light orbs ───────────────────────────────────────────────────────
function OrbitingOrbs() {
  const orb1 = useRef<THREE.Group>(null);
  const orb2 = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (orb1.current) { orb1.current.rotation.y = t * 0.6; }
    if (orb2.current) { orb2.current.rotation.y = -t * 0.4; orb2.current.rotation.x = t * 0.2; }
  });

  return (
    <>
      <group ref={orb1}>
        <mesh position={[2.2, 0, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={4} />
        </mesh>
        <pointLight position={[2.2, 0, 0]} color="#ef4444" intensity={1.5} distance={4} />
      </group>
      <group ref={orb2}>
        <mesh position={[0, 2.4, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#fca5a5" emissive="#fca5a5" emissiveIntensity={3} />
        </mesh>
        <pointLight position={[0, 2.4, 0]} color="#fca5a5" intensity={1} distance={3} />
      </group>
    </>
  );
}

// ── Fallback: animated geometry if model fails ────────────────────────────────
function FallbackGeometry() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.4;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.3;
    }
  });
  return (
    <Float speed={1.5} floatIntensity={0.6}>
      <mesh ref={meshRef} position={[0.4, 0, 0]}>
        <octahedronGeometry args={[1.2, 2]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#b91c1c"
          emissiveIntensity={0.8}
          roughness={0.1}
          metalness={0.9}
          wireframe={false}
        />
      </mesh>
    </Float>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene() {
  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} color="#fff5f5" castShadow />
      <pointLight position={[-4, 2, -2]} color="#ef4444" intensity={3} distance={10} />
      <pointLight position={[4, -2, 2]}  color="#dc2626" intensity={2} distance={8} />
      <pointLight position={[0, 4, 4]}   color="#fca5a5" intensity={1} distance={6} />
      <spotLight  position={[0, 6, 2]} angle={0.4} penumbra={0.5} intensity={2} color="#ef4444" castShadow />

      {/* 3D content */}
      <Suspense fallback={<FallbackGeometry />}>
        <KatarinaModel />
      </Suspense>

      <EnergyRings />
      <OrbitingOrbs />

      {/* Particles */}
      <Sparkles
        count={120}
        scale={8}
        size={1.8}
        speed={0.25}
        color="#ef4444"
        opacity={0.7}
        noise={0.5}
      />
      <Sparkles
        count={60}
        scale={12}
        size={0.8}
        speed={0.1}
        color="#fca5a5"
        opacity={0.3}
        noise={1}
      />

      {/* Ground shadow */}
      <ContactShadows
        position={[0, -2.2, 0]}
        opacity={0.4}
        scale={8}
        blur={2}
        color="#ef4444"
      />

      <Environment preset="night" />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.6}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 3}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function HeroScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 1, 5.5], fov: 42 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
      shadows
    >
      <Scene />
    </Canvas>
  );
}

useGLTF.preload('/models/katarina.glb');
