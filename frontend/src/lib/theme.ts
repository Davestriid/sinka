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

/**
 * Paleta wabi-sabi — "noche de tinta" (yoru). Beige washi cálido de día,
 * tinta y sumi de noche; terracota como sello, musgo como acento secundario.
 * Sustituye la paleta genérica anterior por una con identidad propia.
 */
export const color = {
  bg:            "#15171d",
  bgAlt:         "#111319",
  surface:       "#1d212a",
  surfaceRaised: "#20242d",
  surfaceSunken: "#1b1e26",
  border:        "rgba(233, 229, 220, 0.10)",
  borderSoft:    "rgba(233, 229, 220, 0.16)",

  text:       "#e9e5dc",
  textMuted:  "#aab0bd",
  textFaint:  "#6f7585",

  accent:      "#dd8068",   /* vermilion — sello */
  accentDeep:  "#c9684f",
  accentSoft:  "rgba(221, 128, 104, 0.14)",

  moss:      "#9db5a0",     /* verde profundo — acento secundario */
  mossSoft:  "rgba(157, 181, 160, 0.14)",
  sand:      "#c9b79b",
  clay:      "#a98368",

  success: "#9db5a0",
  danger:  "#dd8068",
  info:    "#7d8aa0",
} as const;

export const radius = {
  sm:   10,
  md:   13,
  lg:   18,
  xl:   24,
  pill: 999,
} as const;

export const shadow = {
  card:     "0 1px 2px rgba(0,0,0,0.25), 0 8px 24px -12px rgba(0,0,0,0.5)",
  raised:   "0 4px 12px rgba(0,0,0,0.35), 0 16px 40px -16px rgba(0,0,0,0.6)",
  glowSoft: "0 0 0 1px rgba(221,128,104,0.15), 0 8px 24px -8px rgba(221,128,104,0.25)",
} as const;

/** Serif japonesa para titulares y números — ver frontend/src/app/layout.tsx. */
export const fontSerif = "var(--font-serif), 'Zen Old Mincho', Georgia, serif";
/** Sans japonesa para el resto de la interfaz. */
export const fontSans = "var(--font-sans), 'Zen Kaku Gothic New', system-ui, sans-serif";

/** Transición base para casi todo lo interactivo: ni brusca ni perezosa. */
export const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
export const transition = `all 0.2s ${ease}`;
