import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-scrubbed background video (Apple-style): maps page scroll progress to
 * video.currentTime so scrolling "plays" the clip frame-by-frame. Drop the file at
 *   aka.gg-main/public/video/dagger-scroll.mp4
 * Encode with dense keyframes for smooth seeking, e.g.:
 *   ffmpeg -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -g 1 -pix_fmt yuv420p -crf 20 dagger-scroll.mp4
 * (-g 1 = every frame is a keyframe → no stutter when scrubbing.)
 * If the file is missing it renders nothing (the page keeps its normal background).
 */
export function ScrollVideoBg({
  src = '/video/dagger-scroll.mp4',
  opacity = 0.45,
}: { src?: string; opacity?: number }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const [ok, setOk] = useState(true);
  const target = useRef(0);
  const current = useRef(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const vid = vidRef.current;
    if (!vid) return;
    try { vid.pause(); } catch { /* noop */ }

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      target.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };

    const tick = () => {
      // Ease toward the target scroll position for buttery scrubbing.
      current.current += (target.current - current.current) * 0.12;
      const d = vid.duration;
      if (d && !Number.isNaN(d) && Number.isFinite(d)) {
        const t = current.current * d;
        if (Math.abs(t - vid.currentTime) > 0.01) {
          try { vid.currentTime = t; } catch { /* seeking not ready yet */ }
        }
      }
      raf.current = requestAnimationFrame(tick);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!ok) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden>
      <video
        ref={vidRef}
        src={src}
        muted
        playsInline
        preload="auto"
        onError={() => setOk(false)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity }}
      />
      {/* Dark + red vignette so foreground content stays perfectly readable. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(120% 80% at 72% -5%, rgba(225,36,46,0.12), transparent 55%),' +
            'linear-gradient(180deg, rgba(10,10,12,0.50) 0%, rgba(10,10,12,0.80) 100%)',
        }}
      />
    </div>
  );
}
