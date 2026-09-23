/**
 * Tokens de diseño compartidos por toda la app.
 *
 * Antes cada pantalla definía sus propios colores sueltos (`#211d19`,
 * `#3a3028`...) repetidos decenas de veces. Aquí viven una sola vez, con
 * nombre, para que un ajuste de marca no implique buscar y reemplazar en
 * quince archivos — y para que el mismo lenguaje visual (radios, sombras,
 * tipografía) se sienta igual en todas partes en vez de cada pantalla
 * pareciendo hecha en un momento distinto.
 */

export const color = {
  bg:            "#1a1612",
  bgAlt:         "#150f0c",
  surface:       "#211d19",
  surfaceRaised: "#26211c",
  surfaceSunken: "#17130f",
  border:        "#3a3028",
  borderSoft:    "#2a2420",

  text:       "#f5f0e8",
  textMuted:  "#a0998b",
  textFaint:  "#6b6358",

  accent:      "#c4813a",
  accentDeep:  "#7c5c3a",
  accentSoft:  "#3b2f1e",

  success: "#4ade80",
  danger:  "#f87171",
  info:    "#93c5fd",
} as const;

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  pill: 999,
} as const;

export const shadow = {
  card:     "0 1px 2px rgba(0,0,0,0.2), 0 8px 24px -12px rgba(0,0,0,0.5)",
  raised:   "0 4px 12px rgba(0,0,0,0.3), 0 16px 40px -16px rgba(0,0,0,0.55)",
  glowSoft: "0 0 0 1px rgba(196,129,58,0.15), 0 8px 24px -8px rgba(196,129,58,0.25)",
} as const;

/** Serif editorial para titulares — ver frontend/src/app/layout.tsx. */
export const fontSerif = "var(--font-serif), Georgia, serif";

/** Transición base para casi todo lo interactivo: ni brusca ni perezosa. */
export const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
export const transition = `all 0.2s ${ease}`;
