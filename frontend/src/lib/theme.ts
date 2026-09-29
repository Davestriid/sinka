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
 * Paleta wabi-sabi — "noche de tinta" (yoru) de noche, "washi" de día.
 * Terracota como sello, musgo como acento secundario en ambas variantes.
 *
 * Cada token apunta a una custom property (--c-x) definida en globals.css
 * para las dos variantes de tema, en vez de a un valor fijo. El toggle real
 * (ver ThemeProvider.tsx) solo cambia el atributo `data-theme` en el <html>;
 * como todas las pantallas ya usan estos tokens, repintan solas sin tocar
 * cada archivo de nuevo.
 */
export const color = {
  bg:            "var(--c-bg)",
  bgAlt:         "var(--c-bg-alt)",
  surface:       "var(--c-surface)",
  surfaceRaised: "var(--c-surface-raised)",
  surfaceSunken: "var(--c-surface-sunken)",
  border:        "var(--c-border)",
  borderSoft:    "var(--c-border-soft)",

  text:       "var(--c-text)",
  textMuted:  "var(--c-text-muted)",
  textFaint:  "var(--c-text-faint)",

  accent:      "var(--c-accent)",       /* vermilion — sello */
  accentDeep:  "var(--c-accent-deep)",
  accentSoft:  "var(--c-accent-soft)",

  moss:      "var(--c-moss)",           /* verde profundo — acento secundario */
  mossSoft:  "var(--c-moss-soft)",
  sand:      "var(--c-sand)",
  clay:      "var(--c-clay)",

  success: "var(--c-success)",
  danger:  "var(--c-danger)",
  info:    "var(--c-info)",
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
