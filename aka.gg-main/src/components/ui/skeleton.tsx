import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ATAK.GG skeleton loader.
 *
 * A shimmering placeholder that respects the dark glass theme: a subtle
 * `rgba(255,255,255,0.06)` block with an animated diagonal sheen. Use
 * content-shaped skeletons (cards, rows, stat blocks) so the layout does not
 * jump when real data arrives — never a bare spinner for panel-level loading.
 *
 * The shimmer keyframes are injected once, globally, the first time a Skeleton
 * mounts, so this component is drop-in with no setup.
 *
 * Back-compatible with the previous shadcn `<Skeleton className="h-4 w-20" />`
 * usage (Tailwind utility sizing still works); new code can use the
 * `variant` / `width` / `height` / `count` props.
 */

type Variant = "line" | "block" | "circle";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual shape. `line` (text), `block` (card/region), `circle` (avatar). */
  variant?: Variant;
  /** Explicit width (number → px, string passed through). */
  width?: number | string;
  /** Explicit height (number → px, string passed through). */
  height?: number | string;
  /** Render N stacked copies (handy for text lines / list rows). */
  count?: number;
}

let injected = false;
function useShimmerStyles() {
  React.useEffect(() => {
    if (injected || typeof document === "undefined") return;
    injected = true;
    const el = document.createElement("style");
    el.setAttribute("data-atak-skeleton", "");
    el.textContent = `
      @keyframes atak-skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(el);
  }, []);
}

const dim = (v?: number | string) =>
  v == null ? undefined : typeof v === "number" ? `${v}px` : v;

function One({ variant = "line", width, height, className, style, ...props }: SkeletonProps) {
  const radius = variant === "circle" ? "9999px" : variant === "line" ? "6px" : "12px";
  const hasExplicit = width != null || height != null;
  const h = height ?? (variant === "line" ? 14 : variant === "circle" ? 40 : 80);
  const w = width ?? (variant === "circle" ? dim(h) : "100%");
  return (
    <div
      aria-hidden
      className={cn(className)}
      style={{
        // Only force sizing/radius when the caller used the prop API; if they
        // pass Tailwind classes (legacy shadcn usage), let those win.
        ...(hasExplicit ? { width: dim(w), height: dim(h), borderRadius: radius } : {}),
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 37%, rgba(255,255,255,0.04) 63%)",
        backgroundSize: "200% 100%",
        animation: "atak-skeleton-shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
      {...props}
    />
  );
}

export function Skeleton({ count = 1, className, ...props }: SkeletonProps) {
  useShimmerStyles();
  // Default rounding for legacy/no-prop usage so bare <Skeleton className="h-4 w-20"/> still looks right.
  const base = cn("rounded-md", className);
  if (count <= 1) return <One className={base} {...props} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <One key={i} className={base} {...props} />
      ))}
    </div>
  );
}

export default Skeleton;
