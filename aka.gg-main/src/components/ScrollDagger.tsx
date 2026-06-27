// src/components/ScrollDagger.tsx
// Decorative, scroll-driven Katarina dagger that lives fixed on a side margin.
// As the user scrolls the whole page, the blade rotates, drifts vertically and
// its red glow breathes — giving an "object animating frame-by-frame on scroll"
// feel. Purely cosmetic: pointer-events:none, low opacity, hidden on narrow
// screens, and it never intercepts clicks.
import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';

const RED = '#e1242e';

export interface ScrollDaggerProps {
  /** Which margin to anchor to. */
  side?: 'left' | 'right';
  /** Blade size in px. */
  size?: number;
}

export default function ScrollDagger({ side = 'right', size = 150 }: ScrollDaggerProps) {
  // Hide on narrow screens — there is no side margin to spare there.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const apply = () => setEnabled(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Track whole-document scroll progress (0 → 1).
  const { scrollYProgress } = useScroll();
  // Smooth the raw progress so motion feels like the object is being eased
  // frame-by-frame rather than snapping with the scrollbar.
  const p = useSpring(scrollYProgress, { stiffness: 60, damping: 22, mass: 0.6 });

  // Scroll-driven transforms.
  const rotate = useTransform(p, [0, 1], [-14, 196]);      // tumbles as you descend
  const y = useTransform(p, [0, 1], [-70, 70]);            // drifts down the margin
  const scale = useTransform(p, [0, 0.5, 1], [0.9, 1.08, 0.95]);
  const glow = useTransform(p, [0, 0.5, 1], [0.25, 0.6, 0.3]);
  const opacity = useTransform(p, [0, 0.04, 0.9, 1], [0, 0.5, 0.5, 0.32]);
  const dropShadow = useTransform(glow, (g) => `drop-shadow(0 0 18px rgba(225,36,46,${g}))`);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'fixed',
        top: '50%',
        [side]: 'max(8px, calc((100vw - 1340px) / 2 - 44px))',
        marginTop: -size / 2,
        width: size,
        height: size,
        zIndex: 5,
        pointerEvents: 'none',
        opacity,
        y,
        rotate,
        scale,
        filter: dropShadow,
        willChange: 'transform, opacity, filter',
      }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sd-blade" x1="32" y1="2" x2="32" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff6a6a" />
            <stop offset="55%" stopColor="#c8161e" />
            <stop offset="100%" stopColor="#3b0000" />
          </linearGradient>
        </defs>
        {/* Blade */}
        <path d="M32 2L22 40L32 54L42 40L32 2Z" fill="url(#sd-blade)" stroke={RED} strokeWidth="1.4" />
        {/* Center fuller / shine */}
        <path d="M32 4V52" stroke="#fff" strokeWidth="1" opacity="0.5" />
        {/* Cross-guard */}
        <path d="M16 46H48" stroke={RED} strokeWidth="3" strokeLinecap="round" />
        {/* Handle */}
        <path d="M32 46V62" stroke="#16161a" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="32" cy="62" r="2.4" fill={RED} />
      </svg>
    </motion.div>
  );
}
