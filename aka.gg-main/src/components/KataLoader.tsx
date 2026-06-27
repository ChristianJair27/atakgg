// src/components/KataLoader.tsx
// Reusable 3D loading screen — renders the rigged Katarina GLB *dancing* on a
// transparent canvas, with the ATAK wordmark + red sweep bar + tagline beneath.
// Premium, dark, ATAK red. Used as the global/system loading screen.
import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// The rigged + dance-animated model lives in /public/models/katarina.glb.
const MODEL_URL = '/models/katarina.glb';

const RED = '#e1242e';

// Preload so the model is ready the moment a loader mounts.
useGLTF.preload(MODEL_URL);

// ─── The dancing model ────────────────────────────────────────────────────────
function KataModel({ autoRotate = true }: { autoRotate?: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const { scene, animations } = useGLTF(MODEL_URL) as any;
  const { actions, names } = useAnimations(animations || [], group);

  // Play the dance clip (or first available) on loop. If the GLB has no clips,
  // we simply render the posed model and let the auto-rotate below animate it.
  useEffect(() => {
    if (!actions || !names || names.length === 0) return;
    const lower = names.map((n: string) => n.toLowerCase());
    const wanted = ['dance', 'emote', 'idle', 'taunt', 'loop'];
    let target = names[0];
    for (const w of wanted) {
      const i = lower.findIndex((n: string) => n.includes(w));
      if (i >= 0) { target = names[i]; break; }
    }
    const action = actions[target];
    action?.reset().fadeIn(0.3).play();
    if (action) action.setLoop(THREE.LoopRepeat, Infinity);
    return () => { action?.fadeOut(0.2); };
  }, [actions, names]);

  // Gentle auto-rotate (also keeps things alive when there is no clip).
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    const tick = () => {
      if (group.current) group.current.rotation.y += 0.0042;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

// ─── The 3D canvas (transparent) ──────────────────────────────────────────────
function KataCanvas({ size = 220 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <Canvas
        camera={{ position: [0, 1, 3], fov: 35 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: false }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.25} />
        <directionalLight position={[-4, 2, -3]} intensity={0.45} color={RED} />
        <Suspense fallback={null}>
          {/* Center + Bounds auto-fit the model regardless of its native scale. */}
          <Bounds fit clip observe margin={1.15}>
            <Center>
              <KataModel />
            </Center>
          </Bounds>
        </Suspense>
      </Canvas>
    </div>
  );
}

// ─── Wordmark + sweep bar + tagline ───────────────────────────────────────────
function Branding({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 8 : 12 }}>
      <div
        style={{
          fontFamily: "'Instrument Serif', 'Saira', serif",
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: compact ? 30 : 44,
          lineHeight: 1,
          color: '#fff',
          letterSpacing: '0.01em',
        }}
      >
        atak<span style={{ color: RED }}>.</span>
      </div>

      {/* Thin red sweep bar */}
      <div
        style={{
          position: 'relative',
          width: compact ? 120 : 170,
          height: 2,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '40%',
            background: `linear-gradient(90deg, transparent, ${RED}, transparent)`,
            animation: 'kata-sweep 1.25s ease-in-out infinite',
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "'Saira', system-ui, sans-serif",
          fontSize: compact ? 9 : 10,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.45)',
          textAlign: 'center',
        }}
      >
        AI Companion · Powered by Riot API
      </div>

      <style>{`
        @keyframes kata-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(360%); }
        }
        @keyframes kata-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kata-fade-out { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  );
}

// ─── Inline loader (size-controllable) ────────────────────────────────────────
export interface KataLoaderProps {
  /** Canvas square size in px. */
  size?: number;
  /** Hide the wordmark/tagline (canvas only). */
  hideBranding?: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function KataLoader({ size = 220, hideBranding = false, compact = false, style }: KataLoaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 6 : 14,
        ...style,
      }}
    >
      <KataCanvas size={size} />
      {!hideBranding && <Branding compact={compact} />}
    </div>
  );
}

// ─── Full-screen overlay variant (fades out) ──────────────────────────────────
export interface KataLoaderOverlayProps {
  /** When false, the overlay fades out and unmounts itself. */
  show?: boolean;
  size?: number;
  /** Optional label shown above the wordmark. */
  label?: string;
}

export function KataLoaderOverlay({ show = true, size = 240, label }: KataLoaderOverlayProps) {
  // Always render while show=true; when show flips false the fade-out keyframe
  // animates and the parent typically unmounts this on transition.
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: 'rgba(8,8,11,0.94)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: show ? 'kata-fade-in 0.25s ease forwards' : 'kata-fade-out 0.4s ease forwards',
        pointerEvents: show ? 'auto' : 'none',
      }}
    >
      {label && (
        <div
          style={{
            fontFamily: "'Saira', system-ui, sans-serif",
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          {label}
        </div>
      )}
      <KataLoader size={size} />
    </div>
  );
}
