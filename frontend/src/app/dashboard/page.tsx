"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code, Smartphone, Globe, Palette, Clapperboard, Pencil, PenTool,
  Music, Megaphone, Camera, BarChart3, Languages, Sparkles,
  Flame, Timer, CheckCircle2, Trophy,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuthStore } from "@/store/auth.store";
import { wsUrl, gamificationApi, announcementsApi, type UserStats, type ActiveAnnouncement } from "@/lib/api";
import { Megaphone as MegaphoneIcon, X as XIcon } from "lucide-react";
import { useTranslation } from "@/components/I18nProvider";
import { type ClaveTraduccion } from "@/lib/i18n";
import { color, radius, shadow, fontSerif, ease, pageBackground } from "@/lib/theme";

// ── Catálogo de áreas de trabajo ─────────────────────────────────────────────
// Iconos propios en vez de emoji — ver la misma nota en components/NavBar.tsx.
// `clave` es la entrada del diccionario i18n (src/lib/i18n.ts), no el texto.
const TOPICS: { value: string; clave: ClaveTraduccion; Icon: ComponentType<LucideProps> }[] = [
  { value: "software",  clave: "topic.software",  Icon: Code },
  { value: "mobile",    clave: "topic.mobile",    Icon: Smartphone },
  { value: "web",       clave: "topic.web",       Icon: Globe },
  { value: "design",    clave: "topic.design",    Icon: Palette },
  { value: "video",     clave: "topic.video",     Icon: Clapperboard },
  { value: "writing",   clave: "topic.writing",   Icon: Pencil },
  { value: "drawing",   clave: "topic.drawing",   Icon: PenTool },
  { value: "music",     clave: "topic.music",     Icon: Music },
  { value: "marketing", clave: "topic.marketing", Icon: Megaphone },
  { value: "photo",     clave: "topic.photo",     Icon: Camera },
  { value: "data",      clave: "topic.data",      Icon: BarChart3 },
  { value: "languages", clave: "topic.languages", Icon: Languages },
  { value: "other",     clave: "topic.other",     Icon: Sparkles },
];

// ── Estado de la pantalla ─────────────────────────────────────────────────────
type Screen = "config" | "searching" | "matched" | "timeout" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken: token, hidratado } = useAuthStore();
  const { t } = useTranslation();

  // Formulario de configuración
  const [topic,            setTopic]            = useState("");
  const [taskTitle,        setTaskTitle]        = useState("");

  // Estado de búsqueda
  const [screen,  setScreen]  = useState<Screen>("config");
  const [error,   setError]   = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  // Stats de gamificación
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!token) return;
    gamificationApi.getStats(token).then(setStats).catch(() => {});
  }, [token]);

  // Anuncio del admin (banner). Se guarda el id ya cerrado en localStorage
  // para no repetirlo en cada visita mientras siga siendo el mismo.
  const [anuncio, setAnuncio] = useState<ActiveAnnouncement | null>(null);
  useEffect(() => {
    if (!token) return;
    announcementsApi.getActive(token).then((a) => {
      if (!a) return;
      const cerrado = typeof window !== "undefined" && localStorage.getItem("sinka_anuncio_cerrado");
      if (cerrado === a.id) return;
      setAnuncio(a);
    }).catch(() => {});
  }, [token]);

  const cerrarAnuncio = () => {
    if (anuncio && typeof window !== "undefined") {
      localStorage.setItem("sinka_anuncio_cerrado", anuncio.id);
    }
    setAnuncio(null);
  };

  // Limpiar WS al desmontar
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // ── Iniciar búsqueda ────────────────────────────────────────────────────────
  const startSearch = () => {
    const title = taskTitle.trim();
    // Ambos son obligatorios: sin categoría no hay con quién emparejar por afinidad
    if (!title || !topic) return;

    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }

    const ws = new WebSocket(wsUrl.matchmakingQueue(token));
    wsRef.current = ws;

    ws.onopen = () => {
      // Primer mensaje: info de tarea
      // Ya no se elige cuantos Pomodoros hacer de entrada: siempre se
      // empieza con uno, y en cada descanso se pregunta a los dos si
      // quieren seguir con otro. Se sigue mandando el campo porque el
      // backend todavia lo acepta, pero ya no cambia nada.
      ws.send(JSON.stringify({
        type:    "TASK_INFO",
        payload: {
          topic:      topic,
          task_title: title,
        },
      }));
      setScreen("searching");
    };

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      if (msg.type === "MATCHED") {
        ws.close();
        setScreen("matched");
        setTimeout(() => {
          router.push(`/session/${msg.payload.session_id}`);
        }, 800);
      } else if (msg.type === "QUEUE_TIMEOUT") {
        ws.close();
        setScreen("timeout");
      } else if (msg.type === "ERROR") {
        ws.close();
        setError(msg.detail || "Error inesperado.");
        setScreen("error");
      }
    };

    ws.onerror  = () => { setError("No se pudo conectar al servidor."); setScreen("error"); };
    ws.onclose  = () => {};
  };

  // ── Cancelar búsqueda ───────────────────────────────────────────────────────
  const cancelSearch = () => {
    wsRef.current?.close();
    setScreen("config");
  };

  const nombre = user?.alias || user?.username || "";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <main style={styles.main}>

        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Anuncio del admin ── */}
        {anuncio && (
          <div style={styles.anuncio} className="sinka-fade-up">
            <MegaphoneIcon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{anuncio.titulo}</div>
              <div style={{ color: color.textMuted, fontSize: 13 }}>{anuncio.mensaje}</div>
            </div>
            <button
              onClick={cerrarAnuncio}
              aria-label="Cerrar anuncio"
              style={{ background: "none", border: "none", cursor: "pointer", color: color.textMuted, flexShrink: 0 }}
            >
              <XIcon size={16} />
            </button>
          </div>
        )}

        {/* ── Saludo ── */}
        <div className="sinka-fade-up">
          <p style={styles.kicker}>— Bienvenido de nuevo</p>
          <h1 style={styles.saludo}>
            {nombre ? <>Hola, {nombre}.</> : <>Tu jardín te espera.</>}
          </h1>
        </div>

        {/* ── Widget de gamificación ── */}
        {stats && (
          <div style={styles.statsCard} className="sinka-fade-up">
            {/* Fila superior: nivel + racha */}
            <div style={styles.statsRow}>
              <div style={styles.levelBadge}>
                <span style={styles.levelNum}>Nv. {stats.level}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.xpLabel}>
                  <span>{stats.xp_current_level} / {stats.xp_next_level > 0 ? stats.xp_next_level : "MAX"} XP</span>
                  <span style={{ color: color.textMuted }}>Total: {stats.xp_total.toLocaleString()}</span>
                </div>
                <div style={styles.xpTrack}>
                  <motion.div
                    style={styles.xpBar}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(stats.xp_progress_pct * 100)}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
              <div style={styles.streakBadge}>
                <Flame size={14} strokeWidth={2} color={stats.streak_current > 0 ? color.accent : color.textFaint} />
                <span style={{ fontWeight: 700, color: stats.streak_current > 0 ? color.accent : color.textFaint }}>
                  {stats.streak_current}
                </span>
                <span style={{ fontSize: 10, color: color.textFaint }}>{t("dashboard.dias")}</span>
              </div>
            </div>
            {/* Fila inferior: stats rápidas */}
            <div style={styles.statsMini}>
              <span style={styles.statsMiniItem}><Timer size={13} strokeWidth={2} /> {stats.pomodoros_completed} {t("dashboard.pomodoros")}</span>
              <span style={styles.statsMiniItem}><CheckCircle2 size={13} strokeWidth={2} /> {stats.sessions_completed} {t("dashboard.sesiones")}</span>
              <span style={styles.statsMiniItem}><Trophy size={13} strokeWidth={2} /> {t("dashboard.racha_max")} {stats.streak_max}</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Pantalla: formulario de configuración ── */}
          {screen === "config" && (
            <motion.div
              key="config"
              style={styles.card}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 style={styles.cardTitle}>{t("dashboard.titulo_config")}</h2>
              <p style={styles.cardSub}>
                {t("dashboard.subtitulo_config")}
              </p>

              {/* Categoría de actividad — define con quién te empareja el sistema */}
              <label style={styles.label}>{t("dashboard.label_area")}</label>
              <div style={styles.areaGrid} className="sinka-stagger">
                {TOPICS.map(a => (
                  <motion.button
                    key={a.value}
                    style={{
                      ...styles.areaBtn,
                      ...(topic === a.value ? styles.areaBtnActive : {}),
                    }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setTopic(a.value)}
                  >
                    <a.Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
                    <span>{t(a.clave)}</span>
                  </motion.button>
                ))}
              </div>
              <p style={styles.hint}>
                {t("dashboard.hint_area")}
              </p>

              {/* Título de tarea */}
              <label style={styles.label}>{t("dashboard.label_tarea")}</label>
              <input
                style={styles.input}
                placeholder={t("dashboard.placeholder_tarea")}
                maxLength={80}
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && taskTitle.trim()) startSearch(); }}
              />
              <span style={styles.charCount}>{taskTitle.length}/80</span>

              <p style={{ ...styles.pomNota, display: "flex", alignItems: "flex-start", gap: 7 }}>
                <Timer size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{t("dashboard.nota_pomodoro")}</span>
              </p>

              <motion.button
                style={{
                  ...styles.btnPrimary,
                  opacity: taskTitle.trim() && topic ? 1 : 0.45,
                  cursor:  taskTitle.trim() && topic ? "pointer" : "not-allowed",
                  marginTop: 24,
                  width: "100%",
                }}
                whileHover={taskTitle.trim() && topic ? { y: -1, boxShadow: shadow.glowSoft } : {}}
                whileTap={taskTitle.trim() && topic ? { scale: 0.98 } : {}}
                disabled={!taskTitle.trim() || !topic}
                onClick={startSearch}
              >
                {t("dashboard.buscar_pareja")}
              </motion.button>

              <button
                style={styles.btnSolo}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (taskTitle.trim()) params.set("tarea", taskTitle.trim());
                  const qs = params.toString();
                  router.push(qs ? `/session/solo?${qs}` : "/session/solo");
                }}
              >
                {t("dashboard.modo_solo")}
              </button>
              <p style={styles.hintSolo}>{t("dashboard.hint_modo_solo")}</p>
            </motion.div>
          )}

          {/* ── Pantalla: buscando ── */}
          {screen === "searching" && (
            <motion.div
              key="searching"
              style={{ ...styles.card, textAlign: "center" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <div style={styles.spinnerWrap} className="sinka-pulse">
                <div style={styles.spinner} />
              </div>
              <h2 style={{ ...styles.cardTitle, marginTop: 20 }}>
                {t("dashboard.buscando_pareja")}
              </h2>
              <p style={{ color: color.textMuted, margin: "0 0 8px" }}>
                {(() => {
                  const encontrada = TOPICS.find(a => a.value === topic);
                  return encontrada ? t(encontrada.clave) : "";
                })()}
              </p>
              <p style={{ color: color.sand, fontSize: 14, margin: "0 0 24px", fontStyle: "italic" }}>
                &ldquo;{taskTitle}&rdquo;
              </p>
              <button style={styles.btnGhost} onClick={cancelSearch}>{t("dashboard.cancelar")}</button>
            </motion.div>
          )}

          {/* ── Pantalla: emparejado ── */}
          {screen === "matched" && (
            <motion.div
              key="matched"
              style={{ ...styles.card, textAlign: "center" }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                style={{ fontSize: 48 }}
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                🎉
              </motion.div>
              <h2 style={{ ...styles.cardTitle, color: color.success, marginTop: 12 }}>{t("dashboard.pareja_encontrada")}</h2>
              <p style={{ color: color.textMuted }}>{t("dashboard.entrando_sesion")}</p>
            </motion.div>
          )}

          {/* ── Pantalla: timeout ── */}
          {screen === "timeout" && (
            <motion.div
              key="timeout"
              style={{ ...styles.card, textAlign: "center" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div style={{ fontSize: 44 }}>⏱️</div>
              <h2 style={{ ...styles.cardTitle, marginTop: 12 }}>No encontramos pareja</h2>
              <p style={{ color: color.textMuted, marginBottom: 20 }}>
                No había nadie disponible. ¿Intentamos de nuevo?
              </p>
              <button style={styles.btnPrimary} onClick={() => setScreen("config")}>
                Volver a intentar
              </button>
            </motion.div>
          )}

          {/* ── Pantalla: error ── */}
          {screen === "error" && (
            <motion.div
              key="error"
              style={{ ...styles.card, textAlign: "center" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div style={{ fontSize: 44 }}>⚠️</div>
              <h2 style={{ ...styles.cardTitle, color: color.danger, marginTop: 12 }}>Algo salió mal</h2>
              <p style={{ color: color.textMuted, marginBottom: 20 }}>{error}</p>
              <button style={styles.btnPrimary} onClick={() => setScreen("config")}>
                Reintentar
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        </div>  {/* end wrapper */}
      </main>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:   "100vh",
    background:  pageBackground,
    fontFamily:  "var(--font-sans), system-ui, sans-serif",
    display:     "flex",
    flexDirection: "column",
  },
  main: {
    flex:           1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "48px 16px",
  },
  kicker: {
    fontSize:      12,
    color:         color.accent,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    margin:        "0 0 6px",
    fontWeight:    600,
  },
  saludo: {
    fontFamily: fontSerif,
    fontWeight: 500,
    fontSize:   32,
    color:      color.text,
    margin:     0,
    letterSpacing: "-0.01em",
  },
  card: {
    background:   color.surface,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow:    shadow.card,
    padding:      "32px 28px",
    width:        "100%",
  },
  cardTitle: {
    fontFamily: fontSerif,
    color:      color.text,
    margin:     "0 0 6px",
    fontSize:   23,
    fontWeight: 500,
  },
  cardSub: {
    color:      color.textMuted,
    margin:     "0 0 24px",
    fontSize:   14,
  },
  label: {
    display:      "block",
    color:        color.sand,
    fontSize:     13,
    fontWeight:   600,
    marginBottom: 10,
    marginTop:    20,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  areaGrid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap:                 8,
  },
  areaBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    background:   color.borderSoft,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding:      "9px 12px",
    // Antes usaba color.sand: en modo claro ese tono queda muy parecido al
    // fondo del boton y casi no se lee. textMuted mantiene la jerarquia
    // (mas suave que el activo) sin perder legibilidad.
    color:        color.textMuted,
    cursor:       "pointer",
    fontSize:     13,
    textAlign:    "left",
    transition:   `background 0.15s ${ease}, border-color 0.15s ${ease}, color 0.15s ${ease}`,
  },
  areaBtnActive: {
    background:   color.accentSoft,
    borderColor:  color.accentDeep,
    color:        color.text,
    boxShadow:    `0 0 0 1px ${color.accentDeep}`,
  },
  hint: {
    fontSize:  12,
    color:     color.textFaint,
    margin:    "8px 0 4px",
    lineHeight: 1.5,
  },
  input: {
    width:        "100%",
    padding:      "11px 14px",
    background:   color.borderSoft,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.md,
    color:        color.text,
    fontSize:     14,
    outline:      "none",
    boxSizing:    "border-box",
    transition:   `border-color 0.15s ${ease}`,
  },
  charCount: {
    display:   "block",
    textAlign: "right",
    fontSize:  11,
    color:     color.textFaint,
    marginTop: 4,
  },
  pomNota: {
    color:      color.textMuted,
    fontSize:   12,
    lineHeight: 1.6,
    background: color.surfaceSunken,
    border:     `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding:    "10px 12px",
    marginTop:  12,
  },
  btnPrimary: {
    background:   `linear-gradient(180deg, ${color.accentDeep}, ${color.clay})`,
    color:        color.text,
    border:       "none",
    borderRadius: radius.pill,
    padding:      "13px 28px",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     15,
  },
  btnGhost: {
    background:   "transparent",
    color:        color.textMuted,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "8px 18px",
    cursor:       "pointer",
    fontSize:     13,
  },
  btnSolo: {
    background:   "transparent",
    color:        color.text,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "12px 28px",
    cursor:       "pointer",
    fontWeight:   500,
    fontSize:     14,
    marginTop:    10,
    width:        "100%",
  },
  hintSolo: {
    color:      color.textFaint,
    fontSize:   12,
    textAlign:  "center",
    marginTop:  8,
  },
  spinnerWrap: {
    width:        48,
    height:       48,
    margin:       "0 auto",
    borderRadius: "50%",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
  },
  spinner: {
    width:        36,
    height:       36,
    border:       `3px solid ${color.border}`,
    borderTop:    `3px solid ${color.accent}`,
    borderRadius: "50%",
    animation:    "spin 0.9s linear infinite",
  },
  // Gamification widget
  anuncio: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          10,
    background:   color.accentSoft,
    border:       `1px solid ${color.accent}`,
    borderRadius: radius.lg,
    padding:      "12px 14px",
    color:        color.text,
    fontSize:     14,
  },
  statsCard: {
    background:   color.surface,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow:    shadow.card,
    padding:      "14px 18px",
    display:      "flex",
    flexDirection: "column" as const,
    gap:          10,
  },
  statsRow: {
    display:     "flex",
    alignItems:  "center",
    gap:         12,
  },
  levelBadge: {
    background:   color.accentSoft,
    border:       `1px solid ${color.accentDeep}`,
    borderRadius: radius.pill,
    padding:      "6px 14px",
    flexShrink:   0,
  },
  levelNum: {
    fontWeight:  800,
    fontSize:    14,
    color:       color.sand,
    whiteSpace:  "nowrap" as const,
  },
  xpLabel: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       11,
    color:          color.sand,
    marginBottom:   4,
  },
  xpTrack: {
    height:       6,
    background:   color.border,
    borderRadius: radius.pill,
    overflow:     "hidden",
  },
  xpBar: {
    height:       "100%",
    background:   `linear-gradient(90deg, ${color.accentDeep}, ${color.accent})`,
    borderRadius: radius.pill,
  },
  streakBadge: {
    display:       "flex",
    flexDirection: "column" as const,
    alignItems:    "center",
    gap:           1,
    flexShrink:    0,
    minWidth:      40,
    fontSize:      18,
  },
  statsMini: { display: "flex", gap: 16, fontSize: 12, color: color.textFaint, flexWrap: "wrap" as const },
  statsMiniItem: { display: "inline-flex", alignItems: "center", gap: 5 },
};
