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

/**
 * Fondo compartido para toda pantalla de app (dashboard, jardín, logros,
 * vínculos, grupos, citas, tienda, perfil, admin...). Dos manchas de luz
 * suaves sobre el fondo base, en vez de un color plano — el mismo recurso
 * que ya usaban dashboard/jardín/logros, ahora centralizado para que
 * cualquier pantalla nueva lo tenga con una sola línea y cambiarlo de
 * intensidad se haga en un solo lugar (ver --c-bg-glow-1/2 en globals.css).
 */
export const pageBackground =
  "radial-gradient(circle at 12% 0%, var(--c-bg-glow-1) 0%, transparent 45%), " +
  "radial-gradient(circle at 90% 8%, var(--c-bg-glow-2) 0%, transparent 40%), " +
  "var(--c-bg)";

/**
 * Fondo ilustrado por pantalla — jardín y logros, cada uno con su propio
 * SVG hecho a medida (ver globals.css --c-img-jardin/--c-img-logros y
 * public/img/fondos). Una capa de tinte tenue sobre la ilustración, con el
 * mismo tono que ya usan las sombras del tema (--c-shadow: negro en modo
 * oscuro, café tierra en modo claro) para que el texto encima no pierda
 * contraste. SVG propio en vez de foto: no depende de un archivo externo
 * que se pueda corromper y escala nítido a cualquier tamaño de pantalla.
 */
function pageBackgroundImage(varName: string): string {
  return (
    `linear-gradient(rgba(var(--c-shadow),0.32), rgba(var(--c-shadow),0.32)), ` +
    `var(${varName}) center/cover no-repeat, ` +
    "var(--c-bg)"
  );
}

export const pageBackgroundJardin = pageBackgroundImage("--c-img-jardin");
export const pageBackgroundLogros = pageBackgroundImage("--c-img-logros");

export const radius = {
  sm:   10,
  md:   13,
  lg:   18,
  xl:   24,
  pill: 999,
} as const;

/*
 * Las sombras usan --c-shadow (RGB sin paréntesis, ver globals.css) en vez
 * de negro fijo: en modo oscuro sigue siendo negro, pero en modo claro es
 * un café/tierra tenue — negro puro sobre papel claro se ve como mugre, no
 * como profundidad. --c-shadow-glow hace lo mismo para el resplandor de
 * acento (terracota en ambos temas, pero con su propio tono por variante).
 */
export const shadow = {
  card:     "0 1px 2px rgba(var(--c-shadow),0.18), 0 8px 24px -12px rgba(var(--c-shadow),0.35)",
  raised:   "0 4px 12px rgba(var(--c-shadow),0.22), 0 16px 40px -16px rgba(var(--c-shadow),0.45)",
  glowSoft: "0 0 0 1px rgba(var(--c-shadow-glow),0.15), 0 8px 24px -8px rgba(var(--c-shadow-glow),0.25)",
} as const;

/** Serif japonesa para titulares y números — ver frontend/src/app/layout.tsx. */
export const fontSerif = "var(--font-serif), 'Zen Old Mincho', Georgia, serif";
/** Sans japonesa para el resto de la interfaz. */
export const fontSans = "var(--font-sans), 'Zen Kaku Gothic New', system-ui, sans-serif";

/** Transición base para casi todo lo interactivo: ni brusca ni perezosa. */
export const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
export const transition = `all 0.2s ${ease}`;
