import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}



// src/lib/utils.ts
export type Platform = "la1" | "la2" | "na1" | "br1" | "oc1";
export type Continent = "americas" | "europe" | "asia";

export const platformToContinent = (pf: Platform): Continent => {
  if (pf === "la1" || pf === "la2" || pf === "na1" || pf === "br1") return "americas";
  // si en el futuro agregas euw/eun, jp, kr, etc. ajusta aquí
  if (pf === "oc1") return "asia"; // oce va a 'asia' en match-v5
  return "americas";
};

export const splitRiotId = (riotId: string) => {
  // admite "Name#TAG" o "Name-TAG" o "Name TAG"
  const raw = riotId.trim();
  const parts = raw.split(/[#\- ]/).filter(Boolean);
  return { gameName: parts[0] ?? "", tagLine: parts[1] ?? "" };
};

export const joinRiotId = (gameName: string, tagLine: string) =>
  `${gameName}#${tagLine}`;