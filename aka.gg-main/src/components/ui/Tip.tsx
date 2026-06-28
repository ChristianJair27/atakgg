import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Terse tooltip wrapper for ATAK.GG.
 *
 * Wrap icon-only buttons or abbreviated/stat UI (KDA, KP, CS·min, rank emblems,
 * filter chips, action icons…) so they stay self-explanatory. Labels are in
 * Spanish per the app's UI language.
 *
 *   <Tip label="Actualizar perfil"><button><RefreshCw/></button></Tip>
 *
 * Requires a single focusable/element child (uses Radix `asChild`). If your
 * child is plain text or a non-element, pass `asChild={false}` to get a wrapping
 * span trigger instead.
 *
 * The app already mounts a single <TooltipProvider> in App.tsx, so no provider
 * is needed here.
 */
export interface TipProps {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Use the child as the trigger element (default). Set false to wrap in a span. */
  asChild?: boolean;
  /** Delay before showing, ms. */
  delayDuration?: number;
}

export function Tip({
  label,
  children,
  side = "top",
  align = "center",
  asChild = true,
  delayDuration = 200,
}: TipProps) {
  if (label == null || label === "") return <>{children}</>;
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className="z-[60] border-white/10 bg-[#0e0e12] text-white text-xs"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default Tip;
