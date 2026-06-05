// src/data/champ-models.ts
export const CHAMP_MODELS: Record<number, {
  url: string;
  anim?: string;
  scale?: number | [number, number, number];
  pos?: [number, number, number];
  rot?: [number, number, number];
}> = {
  // Katarina (id interno 55)
  55: {
    url: "/models/katarina.glb", // ya en public/models
    anim: "Idle",                 // cambia si tu GLB tiene otro nombre de clip
    scale: 1.1,
    pos: [0, 1.3, 0],
    rot: [0, Math.PI, 0],
  },
};
