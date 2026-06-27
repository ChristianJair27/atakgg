import { useEffect, useRef, useState } from 'react';

/**
 * HERO scroll-scrubbed video: the dagger clip is bold at the top of the page,
 * its frames advance as you scroll, and it FADES OUT as you enter the data —
 * leaving a clean dark background below. (Option 1.)
 *
 * Drop the file at  aka.gg-main/public/video/dagger-scroll.mp4
 * (re-encode with dense keyframes for smooth seeking: ffmpeg -i in.mp4 -an -c:v libx264 -g 1 -crf 20 out.mp4)
 * Renders nothing until the file exists.
 *
 * @param fadeVh  How many viewport-heights of scrolling the hero spans before it's
 *                fully faded (default 1.1 → gone shortly after the first screen).
 */
export function ScrollVideoBg({
  src = '/video/dagger-scroll.mp4',
  fadeVh = 1.1,
  maxOpacity = 0.9,
}: { src?: string; fadeVh?: number; maxOpacity?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const [ok, setOk] = useState(true);
  const target = useRef(0);   // 0..1 hero progress (eased target)
  const current = useRef(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    const vid = vidRef.current;
    const wrap = wrapRef.current;
    if (!vid || !wrap) return;
    try { vid.pause(); } catch { /* noop */ }

    const readScroll = () => {
      const fadeEnd = Math.max(1, window.innerHeight * fadeVh);
      target.current = Math.min(1, Math.max(0, window.scrollY / fadeEnd));
    };

    const tick = () => {
      current.current += (target.current - current.current) * 0.12; // ease
      const p = current.current;
      // Scrub the clip across the hero zone (full rotation completes as it fades).
      const d = vid.duration;
      if (d && Number.isFinite(d)) {
        const t = p * d;
        if (Math.abs(t - vid.currentTime) > 0.01) {
          try { vid.currentTime = t; } catch { /* not seekable yet */ }
        }
      }
      // Fade + gentle parallax zoom as it leaves.
      const op = Math.max(0, (1 - p * 1.05)) * maxOpacity;
      wrap.style.opacity = String(op);
      wrap.style.transform = `scale(${1 + p * 0.10}) translateY(${p * -24}px)`;
      wrap.style.visibility = op < 0.01 ? 'hidden' : 'visible';
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
  }, [fadeVh, maxOpacity]);

  if (!ok) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        overflow: 'hidden', willChange: 'opacity, transform', transformOrigin: '70% 30%',
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
      {/* Light at the very top (dagger stays crisp), darkening downward so it melts
          into the page; plus the ATAK red glow up-right. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(90% 60% at 72% 8%, rgba(225,36,46,0.16), transparent 55%),' +
            'linear-gradient(180deg, rgba(10,10,12,0.12) 0%, rgba(10,10,12,0.55) 55%, rgba(10,10,12,0.92) 100%)',
        }}
      />
    </div>
  );
}
