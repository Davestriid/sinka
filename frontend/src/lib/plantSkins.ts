/**
 * Skins de planta (categoría "plant_skin" de la tienda) — resueltas 100% en
 * el cliente. La planta es de un VÍNCULO (amistad entre 2 personas), así
 * que el skin NO puede cambiar los datos compartidos (fase, abono, nombre):
 * cada quien ve su propia piel sobre las mismas fases, y la otra persona
 * sigue viendo lo que tenga equipado ella (o el emoji por defecto).
 *
 * `fase` es el `phase_name` que ya manda el backend ("semilla", "brote",
 * "planta", "floreciendo", "arbol" — ver growth_service.py).
 */
export type PlantSkinId = "item-plant-cherry" | "item-plant-cactus" | "item-plant-bonsai";

const SKINS: Record<PlantSkinId, Record<string, string>> = {
  "item-plant-cherry": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "🌸",
    arbol:       "🌳🌸",
  },
  "item-plant-cactus": {
    semilla:     "🟤",
    brote:       "🌵",
    planta:      "🌵",
    floreciendo: "🌵🌼",
    arbol:       "🌵✨",
  },
  "item-plant-bonsai": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🎍",
    floreciendo: "🎍🌸",
    arbol:       "🎍",
  },
};

/** Devuelve el emoji del skin equipado para esa fase, o `fallback` (el emoji
 *  que ya manda el backend) si no hay skin equipado o no es uno conocido. */
export function emojiConSkin(
  fase: string,
  fallback: string,
  skinId: string | null | undefined,
): string {
  if (!skinId || !(skinId in SKINS)) return fallback;
  return SKINS[skinId as PlantSkinId][fase] ?? fallback;
}
