import { useEffect, useRef, useState } from 'react';

/**
 * Living scroll-scrubbed background video. The dagger clip is BOLD at the top,
 * then eases down to a soft persistent floor — and keeps advancing frame-by-frame
 * across the WHOLE page scroll, so the page feels like a UI layer over a
 * background that is itself changing with the video.
 *
 * Drop the file at  aka.gg-main/public/video/dagger-scroll.mp4 (dense keyframes).
 * Renders nothing until the file exists.
 *
 * @param peakOpacity  opacity at the very top (hero).
 * @param floorOpacity persistent opacity once scrolled past the hero (keeps it alive).
 * @param heroVh       viewport-heights over which it eases from peak → floor.
 */
export function ScrollVideoBg({
  src = '/video/dagger-scroll.mp4',
  peakOpacity = 0.85,
  floorOpacity = 0.13,
  heroVh = 0.9,
}: { src?: string; peakOpacity?: number; floorOpacity?: number; heroVh?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [ok, setOk] = useState(true);
  const fullTarget = useRef(0); const fullCur = useRef(0);   // 0..1 across whole page (scrub)
  const heroTarget = useRef(0); const heroCur = useRef(0);   // 0..1 over the hero zone (opacity)
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const vid = vidRef.current;
    const wrap = wrapRef.current;
    if (!vid || !wrap) return;
    try { vid.pause(); } catch { /* noop */ }

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const readScroll = () => {
      const docMax = document.documentElement.scrollHeight - window.innerHeight;
      fullTarget.current = docMax > 0 ? clamp(window.scrollY / docMax) : 0;
      heroTarget.current = clamp(window.scrollY / Math.max(1, window.innerHeight * heroVh));
    };

    const tick = () => {
      fullCur.current += (fullTarget.current - fullCur.current) * 0.1;
      heroCur.current += (heroTarget.current - heroCur.current) * 0.12;

      // Scrub across the entire page so the dagger keeps moving as you scroll.
      const d = vid.duration;
      if (d && Number.isFinite(d)) {
        const t = fullCur.current * d;
        if (Math.abs(t - vid.currentTime) > 0.01) {
          try { vid.currentTime = t; } catch { /* not seekable yet */ }
        }
      }
      // Ease peak → persistent floor (never fully gone → "living" background).
      const h = heroCur.current;
      const op = peakOpacity * (1 - h) + floorOpacity * h;
      wrap.style.opacity = String(op);
      wrap.style.transform = `scale(${1 + h * 0.06})`;
      raf.current = requestAnimationFrame(tick);
    };

    readScroll();
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', readScroll);
    raf.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', readScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [peakOpacity, floorOpacity, heroVh]);

  if (!ok) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        overflow: 'hidden', willChange: 'opacity, transform', transformOrigin: '72% 28%',
      }}
    >
      <video
        ref={vidRef}
        src={src}
        muted
        playsInline
        preload="auto"
        onError={() => setOk(false)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {/* Crisp up top, darkening downward so content stays readable over the
          persistent moving background; plus the ATAK red glow. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(90% 60% at 72% 8%, rgba(225,36,46,0.15), transparent 55%),' +
            'linear-gradient(180deg, rgba(10,10,12,0.18) 0%, rgba(10,10,12,0.58) 50%, rgba(10,10,12,0.86) 100%)',
        }}
      />
    </div>
  );
}
