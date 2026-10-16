/**
 * Skins de planta (categoría "plant_skin" de la tienda).
 *
 * La planta es de un VÍNCULO (amistad entre 2 personas). Desde la migración
 * 0028, cada planta nace con una `species_item_id` propia — asignada UNA
 * SOLA VEZ al aceptar la amistad (ver backend: social_service._especie_inicial)
 * — que es igual para los dos usuarios: ambos ven el mismo tipo de planta
 * que están cultivando juntos, no un skin personal superpuesto.
 *
 * `fase` es el `phase_name` que ya manda el backend ("semilla", "brote",
 * "planta", "floreciendo", "arbol" — ver growth_service.py).
 */
export type PlantSkinId =
  | "item-plant-cherry"
  | "item-plant-cactus"
  | "item-plant-bonsai"
  | "item-plant-girasol"
  | "item-plant-lavanda"
  | "item-plant-palmera"
  | "item-plant-loto"
  | "item-plant-arce"
  | "item-plant-cristal"
  | "item-plant-luna";

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
  "item-plant-girasol": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "🌻",
    arbol:       "🌻✨",
  },
  "item-plant-lavanda": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "💜🌸",
    arbol:       "🌳💜",
  },
  "item-plant-palmera": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "🌴",
    arbol:       "🌴✨",
  },
  "item-plant-loto": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🍃",
    floreciendo: "🪷",
    arbol:       "🪷✨",
  },
  "item-plant-arce": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "🍁",
    arbol:       "🍁🍂",
  },
  "item-plant-cristal": {
    semilla:     "🌰",
    brote:       "✨",
    planta:      "💎",
    floreciendo: "💎🌸",
    arbol:       "💎🌳",
  },
  "item-plant-luna": {
    semilla:     "🌰",
    brote:       "🌱",
    planta:      "🌿",
    floreciendo: "🌙✨",
    arbol:       "🌌🌳",
  },
};

/** Nombre legible de cada especie, para mostrar "qué tipo de planta están
 *  cultivando juntos" junto al emoji. */
const NOMBRES: Record<PlantSkinId, string> = {
  "item-plant-cherry":  "Cerezo",
  "item-plant-cactus":  "Cactus Neón",
  "item-plant-bonsai":  "Bonsái Zen",
  "item-plant-girasol": "Girasol",
  "item-plant-lavanda": "Lavanda",
  "item-plant-palmera": "Palmera",
  "item-plant-loto":    "Loto",
  "item-plant-arce":    "Arce de otoño",
  "item-plant-cristal": "Planta Cristal",
  "item-plant-luna":    "Planta Lunar",
};

/** Devuelve el emoji de esa especie para la fase dada, o `fallback` (el
 *  emoji genérico que ya manda el backend) si no hay especie o no es una
 *  conocida. */
export function emojiConSkin(
  fase: string,
  fallback: string,
  skinId: string | null | undefined,
): string {
  if (!skinId || !(skinId in SKINS)) return fallback;
  return SKINS[skinId as PlantSkinId][fase] ?? fallback;
}

/** Nombre legible de la especie (p.ej. "Girasol"), o null si no se conoce. */
export function nombreDeSkin(skinId: string | null | undefined): string | null {
  if (!skinId || !(skinId in NOMBRES)) return null;
  return NOMBRES[skinId as PlantSkinId];
}
