// --- ChampionDance3D.tsx ---
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Billboard,
  Float,
  Image,
  OrbitControls,
  Sparkles,
  Text,
  useGLTF,
  useAnimations,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type Vec3 = [number, number, number];

export type ChampItem = {
  id: number;
  name: string;
  imageUrl?: string;
  // Soporte 3D:
  modelUrl?: string;
  anim?: string;
  scale?: number | Vec3;
  position?: Vec3;
  rotation?: Vec3;
};

function Pedestal() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.7, 0.3, 40]} />
        <meshStandardMaterial color="#0b0d10" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
        <ringGeometry args={[1.1, 1.25, 48]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function Wobble({
  speed = 1,
  amp = 0.08,
  yaw = 0,                 // <-- NUEVO
  children,
}: {
  speed?: number;
  amp?: number;
  yaw?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed;
    if (!ref.current) return;

    // Desfase base + oscilación suave
    ref.current.rotation.y = yaw + Math.sin(t * 0.6) * 0.25;
    ref.current.position.y = 0.4 + Math.sin(t * 2) * amp;
  });
  return <group ref={ref}>{children}</group>;
}

/** Carga y reproduce el modelo GLB con animaciones si existen */
function ChampionModel({
  modelUrl,
  anim,
  scale = 1,
  position = [0, 1.2, 0],
  rotation = [0, Math.PI, 0],
}: {
  modelUrl: string;
  anim?: string;
  scale?: number | Vec3;
  position?: Vec3;
  rotation?: Vec3;
}) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(modelUrl) as any;
  const { actions, names } = useAnimations(animations || [], group);

  // Seleccionar “mejor” clip si no se especifica anim
  const pickBest = (ns: string[]) => {
    const want = ["dance", "emote", "idle", "taunt", "loop"];
    const lower = ns.map((n) => n.toLowerCase());
    for (const w of want) {
      const i = lower.findIndex((n) => n.includes(w));
      if (i >= 0) return ns[i];
    }
    return ns[0]; // primero disponible
  };

  useEffect(() => {
    if (!actions) return;
    const target = (anim && actions[anim]) ? anim : pickBest(Object.keys(actions));
    const action = actions[target];
    action?.reset().fadeIn(0.25).play();
    return () => action?.fadeOut(0.2);
  }, [actions, anim]);

  // Suavizar materiales (por si vienen muy brillantes)
  useEffect(() => {
    scene.traverse((o: any) => {
      if (o.isMesh && o.material) {
        o.material.toneMapped = true;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

export function ChampionDance3D({
  champions,
  title = "Campeón destacado",
  height = 380,
}: {
  champions: ChampItem[];
  title?: string;
  height?: number | string;
}) {
  const [idx, setIdx] = useState(0);
  const current = champions[Math.max(0, Math.min(idx, champions.length - 1))];
  const thumbs = useMemo(() => champions.slice(0, 5), [champions]);

  // Preload del modelo actual (si existe)
  useEffect(() => {
    if (current?.modelUrl) useGLTF.preload(current.modelUrl);
  }, [current?.modelUrl]);

  return (
    <div className="bg-gray-900/80 border border-red-500/20 rounded-xl overflow-hidden backdrop-blur-md">
      <div className="border-b border-red-500/30 px-4 py-3 flex items-center justify-between bg-gray-900/50">
        <h3 className="text-red-300 font-semibold text-sm uppercase tracking-wide">{title}</h3>
        {thumbs.length > 1 && (
          <div className="flex gap-2">
            {thumbs.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setIdx(i)}
                className={`w-8 h-8 rounded border transition-all ${
                  i === idx ? "border-red-500 scale-110" : "border-white/10 opacity-70 hover:opacity-100"
                }`}
                title={c.name}
              >
                {c.imageUrl ? (
                  <img src={c.imageUrl} className="w-full h-full object-cover" alt={c.name} />
                ) : (
                  <span className="text-[10px] text-white/70">{c.name}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height }} className="relative">
        <Canvas
          camera={{ position: [0, 2.6, 4.2], fov: 45 }}
          dpr={[1, 1]}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
          shadows
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[4, 6, 4]} intensity={1} castShadow />
          <pointLight position={[-6, 3, -4]} intensity={0.6} />

          <Pedestal />

          {/* Si hay modelo -> 3D; si no -> imagen 2D */}
          {current?.modelUrl ? (
            <Suspense fallback={null}>
              <Wobble speed={1.2} amp={0.08}>
                <ChampionModel
                  modelUrl={current.modelUrl}
                  anim={current.anim}
                  scale={current.scale ?? 1.1}
                  position={(current.position as Vec3) ?? [0, 1.2, 0]}
                  rotation={(current.rotation as Vec3) ?? [0, Math.PI, 0]}
                />
              </Wobble>
            </Suspense>
          ) : (
            <Float speed={2} floatIntensity={0.8} rotationIntensity={0.2}>
              <Wobble speed={1.2} amp={0.1}>
                <Billboard position={[0, 1.6, 0]} follow>
                  <Image url={current?.imageUrl || ""} transparent toneMapped={false} scale={[1.9, 1.9, 1]} />
                </Billboard>
              </Wobble>
            </Float>
          )}

          <Sparkles count={40} scale={4} size={1.2} speed={0.5} opacity={0.4} position={[0, 1.5, 0]} />

          {!!current?.name && (
            <Billboard position={[0, 0.65, 1.6]}>
              <Text
                fontSize={0.28}
                color="#e5e7eb"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#000"
              >
                {current.name}
              </Text>
            </Billboard>
          )}

          <OrbitControls enablePan={false} minDistance={3} maxDistance={6} target={[0, 1, 0]} enableDamping dampingFactor={0.05} />
        </Canvas>
      </div>
    </div>
  );
}
