// src/components/TrueFocus.tsx
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TrueFocus = () => {
  const words = ['ATAK', 'GG'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [focusRect, setFocusRect] = useState<FocusRect>({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 3200); // Un poco más lento para más elegancia

    return () => clearInterval(interval);
  }, [words.length]);

  useEffect(() => {
    if (!containerRef.current || !wordRefs.current[currentIndex]) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const activeWordRect = wordRefs.current[currentIndex]!.getBoundingClientRect();

    setFocusRect({
      x: activeWordRect.left - containerRect.left,
      y: activeWordRect.top - containerRect.top,
      width: activeWordRect.width,
      height: activeWordRect.height,
    });
  }, [currentIndex]);

  return (
    <div ref={containerRef} className="relative inline-flex items-baseline gap-5 select-none">
      {words.map((word, index) => {
        const isActive = index === currentIndex;

        return (
          <span
            key={index}
            ref={(el) => (wordRefs.current[index] = el)}
            className="relative text-9xl font-black transition-all duration-1000"
            style={{
              filter: isActive ? 'blur(0px)' : 'blur(6px)',
              color: '#ef4444', // Rojo elegante constante
              textShadow: isActive
                ? '0 0 20px rgba(239, 68, 68, 0.6)' // Glow sutil y refinado
                : '0 0 10px rgba(239, 68, 68, 0.3)',
            }}
          >
            {word}
          </span>
        );
      })}

      {/* Marco rojo elegante con glow muy sutil */}
      <motion.div
        className="absolute pointer-events-none rounded-3xl"
        animate={{
          x: focusRect.x - 36,   // Padding ajustado para encaje perfecto
          y: focusRect.y - 36,
          width: focusRect.width + 72,
          height: focusRect.height + 72,
        }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{
          border: '4px solid #ef4444',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)', // Glow muy elegante y discreto
          opacity: currentIndex >= 0 ? 1 : 0,
        }}
      />
    </div>
  );
};

export default TrueFocus;