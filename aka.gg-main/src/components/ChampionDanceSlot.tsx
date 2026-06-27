// src/components/ChampionDanceSlot.tsx
// A SMALL panel that shows the player's highest-mastery champion as a 3D model
// "dancing" (same react-three-fiber pattern as KataLoader). The GLB files live
// under /public/models/champions/{ChampionKey}.glb (e.g. Pantheon.glb) and are
// NOT guaranteed to exist yet — so this degrades gracefully:
//
//   1. We probe the URL with a HEAD request first. Only if it exists do we mount
//      the Canvas + useGLTF (avoids Suspense throwing on a 404 / never resolving).
//   2. An error boundary wraps the 3D subtree as a second safety net.
//   3. When there is no model, we fall back to the champion's splash art with a
//      gentle Ken-Burns drift, or a centered icon — never an error, never blank.
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, useAnimations, useGLTF } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { dd } from '@/lib/dataDragon';

const RED = '#e1242e';
const GOLD = '#c8aa6e';
const BORDER = 'rgba(255,255,255,0.07)';
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

const modelUrl = (champKey: string) => `/models/champions/${champKey}.glb`;

// ─── Error boundary: any failure inside the 3D subtree → render fallback ───────
class GLBBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — fallback already shown */ }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ─── The dancing model (only mounted once the GLB is confirmed present) ────────
function DanceModel({ url, onFail }: { url: string; onFail: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF(url) as any;
  const { actions, names } = useAnimations(gltf?.animations || [], group);

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
    action?.setLoop(THREE.LoopRepeat, Infinity);
    return () => { action?.fadeOut(0.2); };
  }, [actions, names]);

  // Gentle idle spin (keeps it lively even without a clip).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (group.current) group.current.rotation.y += 0.0048;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!gltf?.scene) { onFail(); return null; }
  return <group ref={group}><primitive object={gltf.scene} /></group>;
}

// ─── 2D fallback: splash art with a slow drift, or a centered icon ────────────
function ArtFallback({ champName, slug }: { champName: string; slug?: string }) {
  const [splashOk, setSplashOk] = useState(true);
  const splash = slug ? dd.championSplash(slug) : '';
  const icon = slug ? dd.champion(slug) : '';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14, background: '#000' }}>
      {splash && splashOk ? (
        <>
          <motion.img
            src={splash}
            alt={champName}
            onError={() => setSplashOk(false)}
            initial={{ scale: 1.12, x: -8 }}
            animate={{ scale: 1.22, x: 8 }}
            transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', opacity: 0.92 }}
          />
          {/* Bottom fade so the name reads cleanly. */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,12,0.85), transparent 55%)' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, rgba(225,36,46,0.18), #0a0a0c 70%)' }}>
          {icon ? (
            <motion.img
              src={icon}
              alt={champName}
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', boxShadow: `0 0 22px ${RED}66`, border: `2px solid ${RED}` }}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: FONT_COND, fontWeight: 800, fontSize: 26 }}>?</div>
          )}
        </div>
      )}
    </div>
  );
}

export interface ChampionDanceSlotProps {
  /** DDragon champion slug (e.g. "Pantheon"). When absent → icon fallback. */
  champSlug?: string;
  /** Localized champion name for the caption. */
  champName?: string;
  /** Loading state from the profile (mastery not resolved yet). */
  loading?: boolean;
  style?: React.CSSProperties;
}

export default function ChampionDanceSlot({ champSlug, champName, loading, style }: ChampionDanceSlotProps) {
  // 'checking' → probing HEAD; 'model' → GLB present; 'fallback' → use art.
  const [phase, setPhase] = useState<'checking' | 'model' | 'fallback'>('checking');

  useEffect(() => {
    if (!champSlug) { setPhase('fallback'); return; }
    let cancelled = false;
    setPhase('checking');
    const url = modelUrl(champSlug);
    // HEAD probe — only mount the heavy 3D path when the file truly exists.
    fetch(url, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        const ct = res.headers.get('content-type') || '';
        // Some dev servers answer 200 with index.html for missing files; reject HTML.
        const looksLikeModel = res.ok && !ct.includes('text/html');
        setPhase(looksLikeModel ? 'model' : 'fallback');
        if (looksLikeModel) { try { useGLTF.preload(url); } catch { /* noop */ } }
      })
      .catch(() => { if (!cancelled) setPhase('fallback'); });
    return () => { cancelled = true; };
  }, [champSlug]);

  const name = champName || champSlug || '—';

  return (
    <div
      style={{
        position: 'relative',
        height: 150,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 60%)',
        boxShadow: '0 18px 50px -26px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,0.05)',
        ...style,
      }}
    >
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Cargando maestría…
        </div>
      ) : phase === 'model' && champSlug ? (
        <GLBBoundary fallback={<ArtFallback champName={name} slug={champSlug} />}>
          <Canvas
            camera={{ position: [0, 1, 3], fov: 35 }}
            dpr={[1, 1.5]}
            gl={{ alpha: true, antialias: true }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 5, 4]} intensity={1.2} />
            <directionalLight position={[-4, 2, -3]} intensity={0.5} color={RED} />
            <Suspense fallback={null}>
              <Bounds fit clip observe margin={1.15}>
                <Center>
                  <DanceModel url={modelUrl(champSlug)} onFail={() => setPhase('fallback')} />
                </Center>
              </Bounds>
            </Suspense>
          </Canvas>
        </GLBBoundary>
      ) : (
        <ArtFallback champName={name} slug={champSlug} />
      )}

      {/* Caption (always on top) */}
      <div style={{ position: 'absolute', left: 12, bottom: 10, zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
          Maestría principal
        </div>
        <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 18, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
          {name}
        </div>
      </div>

      {/* Subtle top-edge highlight to seat it in the dark page. */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: 16, border: `1px solid ${BORDER}`, pointerEvents: 'none' }} />
    </div>
  );
}
