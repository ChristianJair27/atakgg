import { useRef, useState, useEffect, useId } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export default function SandTransitionImage({ src, alt, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const filterId = `sand-${uid}`;

  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const rafRef = useRef<number>(0);

  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!turbRef.current || !dispRef.current) return;

    const targetFreq = hovered ? 0.072 : 0.018;
    const targetScale = hovered ? 32 : 0;

    let startTime: number | null = null;
    const duration = 480;

    const startFreq = parseFloat(turbRef.current.getAttribute("baseFrequency") ?? "0.018");
    const startScale = parseFloat(dispRef.current.getAttribute("scale") ?? "0");

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      const freq = startFreq + (targetFreq - startFreq) * eased;
      const scale = startScale + (targetScale - startScale) * eased;

      turbRef.current?.setAttribute("baseFrequency", freq.toFixed(4));
      dispRef.current?.setAttribute("scale", scale.toFixed(2));

      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hovered]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hidden SVG filter definition */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feTurbulence
              ref={turbRef}
              type="turbulence"
              baseFrequency="0.018"
              numOctaves="4"
              seed="8"
              result="noise"
            />
            <feDisplacementMap
              ref={dispRef}
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.1 0"
              in="displaced"
            />
          </filter>
        </defs>
      </svg>

      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-700 ease-out"
        style={{
          filter: `url(#${filterId})`,
          transform: hovered ? "scale(1.04)" : "scale(1)",
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
