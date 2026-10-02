/**
 * Diccionario de traducción español/inglés.
 *
 * No es una librería de i18n completa (no hay pluralización ni
 * interpolación de variables más allá de un reemplazo simple `{{x}}`):
 * es un mapa plano de claves a texto en cada idioma, suficiente para una
 * app de este tamaño sin sumar una dependencia nueva.
 *
 * Cobertura actual: NavBar y Dashboard, las pantallas de más tráfico.
 * Para traducir una pantalla nueva: agregar sus claves acá y usar
 * `useTranslation()` (ver I18nProvider.tsx) en vez de escribir el texto
 * directo en el JSX.
 */
export type Idioma = "es" | "en";

export const dict = {
  // ── Navegación ───────────────────────────────────────────────────────
  "nav.enfocarme": { es: "Enfocarme", en: "Focus" },
  "nav.vinculos":  { es: "Vínculos",  en: "Bonds" },
  "nav.jardin":    { es: "Jardín",    en: "Garden" },
  "nav.grupos":    { es: "Grupos",    en: "Groups" },
  "nav.citas":     { es: "Citas",     en: "Schedule" },
  "nav.logros":    { es: "Logros",    en: "Achievements" },
  "nav.tienda":    { es: "Tienda",    en: "Shop" },
  "nav.salir":     { es: "Salir",     en: "Log out" },
  "nav.perfil":    { es: "Perfil",    en: "Profile" },
  "nav.ajustes":   { es: "Ajustes",   en: "Settings" },
  "nav.cuenta_verificada": { es: "Cuenta verificada", en: "Verified account" },

  // ── Dashboard ────────────────────────────────────────────────────────
  "dashboard.titulo_config": {
    es: "¿En qué vas a trabajar hoy?",
    en: "What will you work on today?",
  },
  "dashboard.subtitulo_config": {
    es: "Cuéntanos tu tarea antes de buscar pareja.",
    en: "Tell us your task before finding a partner.",
  },
  "dashboard.label_area": { es: "¿En qué área trabajas?", en: "What area do you work in?" },
  "dashboard.hint_area": {
    es: "Te buscaremos a alguien de tu misma área. Si en 10 segundos no hay nadie disponible, te conectamos con quien esté trabajando.",
    en: "We'll look for someone in your same area. If no one is available in 10 seconds, we'll connect you with whoever is working.",
  },
  "dashboard.label_tarea": { es: "¿Qué tarea vas a hacer?", en: "What task will you do?" },
  "dashboard.placeholder_tarea": {
    es: 'Ej: "Implementar login con JWT"',
    en: 'E.g: "Implement JWT login"',
  },
  "dashboard.nota_pomodoro": {
    es: "🍅 Empiezan con un Pomodoro de 25 minutos. Al llegar al descanso les preguntamos a los dos si quieren seguir con otro — solo continúa si ambos dicen que sí.",
    en: "🍅 You start with a 25-minute Pomodoro. At the break we ask you both if you want to continue — it only goes on if you both say yes.",
  },
  "dashboard.buscar_pareja": { es: "Buscar pareja →", en: "Find a partner →" },
  "dashboard.modo_solo": { es: "Enfocarme en solitario", en: "Focus solo" },
  "dashboard.hint_modo_solo": {
    es: "Empieza un Pomodoro sin esperar pareja. Suma a tu racha y tus FocusCoins igual.",
    en: "Start a Pomodoro without waiting for a partner. Still counts toward your streak and FocusCoins.",
  },
  "dashboard.buscando_pareja": { es: "Buscando pareja...", en: "Finding a partner..." },
  "dashboard.cancelar": { es: "Cancelar", en: "Cancel" },
  "dashboard.pareja_encontrada": { es: "¡Pareja encontrada!", en: "Partner found!" },
  "dashboard.entrando_sesion": { es: "Entrando a la sesión...", en: "Joining the session..." },
  "dashboard.dias": { es: "días", en: "days" },
  "dashboard.pomodoros": { es: "pomodoros", en: "pomodoros" },
  "dashboard.sesiones": { es: "sesiones", en: "sessions" },
  "dashboard.racha_max": { es: "Racha máx.", en: "Best streak" },

  // ── Modo solo (Pomodoro en solitario) ───────────────────────────────────
  "solo.titulo":         { es: "Enfocarme en solitario", en: "Solo focus" },
  "solo.label_tarea":    { es: "¿En qué vas a trabajar? (opcional)", en: "What will you work on? (optional)" },
  "solo.placeholder_tarea": { es: 'Ej: "Leer el capítulo 3"', en: 'E.g: "Read chapter 3"' },
  "solo.iniciar":        { es: "Iniciar Pomodoro", en: "Start Pomodoro" },
  "solo.fase_trabajo":   { es: "Concentración", en: "Focus" },
  "solo.fase_descanso":  { es: "Descanso", en: "Break" },
  "solo.pausar":         { es: "Pausar", en: "Pause" },
  "solo.reanudar":       { es: "Reanudar", en: "Resume" },
  "solo.saltar_descanso": { es: "Saltar descanso →", en: "Skip break →" },
  "solo.otro_pomodoro":  { es: "Otro Pomodoro", en: "Another Pomodoro" },
  "solo.terminar":       { es: "Terminar", en: "Finish" },
  "solo.ronda":          { es: "Ronda", en: "Round" },
  "solo.pomodoro_listo": { es: "¡Pomodoro completado!", en: "Pomodoro complete!" },
  "solo.logro_nuevo":    { es: "¡Nuevo logro desbloqueado!", en: "New achievement unlocked!" },
  "solo.volver":         { es: "Volver al inicio", en: "Back to dashboard" },

  // ── Áreas de trabajo (TOPICS) ────────────────────────────────────────
  "topic.software":  { es: "Desarrollo de software", en: "Software development" },
  "topic.mobile":    { es: "Apps móviles",           en: "Mobile apps" },
  "topic.web":       { es: "Desarrollo web",         en: "Web development" },
  "topic.design":    { es: "Diseño gráfico",         en: "Graphic design" },
  "topic.video":     { es: "Edición de video",       en: "Video editing" },
  "topic.writing":   { es: "Escritura",              en: "Writing" },
  "topic.drawing":   { es: "Dibujo digital",         en: "Digital drawing" },
  "topic.music":     { es: "Música y producción",    en: "Music production" },
  "topic.marketing": { es: "Marketing digital",      en: "Digital marketing" },
  "topic.photo":     { es: "Fotografía",             en: "Photography" },
  "topic.data":      { es: "Análisis de datos",      en: "Data analysis" },
  "topic.languages": { es: "Idiomas",                en: "Languages" },
  "topic.other":     { es: "Otro",                   en: "Other" },
} as const;

export type ClaveTraduccion = keyof typeof dict;

export function traducir(clave: ClaveTraduccion, idioma: Idioma): string {
  const entrada = dict[clave];
  if (!entrada) return clave;
  return entrada[idioma] ?? entrada.es;
}
