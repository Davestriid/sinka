"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { wsUrl, gamificationApi, type UserStats } from "@/lib/api";
import { color, radius, shadow, fontSerif, ease } from "@/lib/theme";

// ── Catálogo de áreas de trabajo ─────────────────────────────────────────────
const TOPICS = [
  { value: "software",  label: "💻 Desarrollo de software" },
  { value: "mobile",    label: "📱 Apps móviles" },
  { value: "web",       label: "🌐 Desarrollo web" },
  { value: "design",    label: "🎨 Diseño gráfico" },
  { value: "video",     label: "🎬 Edición de video" },
  { value: "writing",   label: "✍️ Escritura" },
  { value: "drawing",   label: "🖌️ Dibujo digital" },
  { value: "music",     label: "🎵 Música y producción" },
  { value: "marketing", label: "📢 Marketing digital" },
  { value: "photo",     label: "📷 Fotografía" },
  { value: "data",      label: "📊 Análisis de datos" },
  { value: "languages", label: "🗣️ Idiomas" },
  { value: "other",     label: "✨ Otro" },
];

// ── Estado de la pantalla ─────────────────────────────────────────────────────
type Screen = "config" | "searching" | "matched" | "timeout" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken: token, hidratado } = useAuthStore();

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
                <span>🔥</span>
                <span style={{ fontWeight: 700, color: stats.streak_current > 0 ? "#fb923c" : color.textFaint }}>
                  {stats.streak_current}
                </span>
                <span style={{ fontSize: 10, color: color.textFaint }}>días</span>
              </div>
            </div>
            {/* Fila inferior: stats rápidas */}
            <div style={styles.statsMini}>
              <span>🍅 {stats.pomodoros_completed} pomodoros</span>
              <span>✅ {stats.sessions_completed} sesiones</span>
              <span>🏆 Racha máx. {stats.streak_max}</span>
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
              <h2 style={styles.cardTitle}>¿En qué vas a trabajar hoy?</h2>
              <p style={styles.cardSub}>
                Cuéntanos tu tarea antes de buscar pareja.
              </p>

              {/* Categoría de actividad — define con quién te empareja el sistema */}
              <label style={styles.label}>¿En qué área trabajas?</label>
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
                    {a.label}
                  </motion.button>
                ))}
              </div>
              <p style={styles.hint}>
                Te buscaremos a alguien de tu misma área. Si en 10 segundos no hay
                nadie disponible, te conectamos con quien esté trabajando.
              </p>

              {/* Título de tarea */}
              <label style={styles.label}>¿Qué tarea vas a hacer?</label>
              <input
                style={styles.input}
                placeholder='Ej: "Implementar login con JWT"'
                maxLength={80}
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && taskTitle.trim()) startSearch(); }}
              />
              <span style={styles.charCount}>{taskTitle.length}/80</span>

              <p style={styles.pomNota}>
                🍅 Empiezan con un Pomodoro de 25 minutos. Al llegar al descanso
                les preguntamos a los dos si quieren seguir con otro — solo
                continúa si ambos dicen que sí.
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
                Buscar pareja →
              </motion.button>
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
                Buscando pareja...
              </h2>
              <p style={{ color: color.textMuted, margin: "0 0 8px" }}>
                {TOPICS.find(a => a.value === topic)?.label}
              </p>
              <p style={{ color: "#c4b99a", fontSize: 14, margin: "0 0 24px", fontStyle: "italic" }}>
                &ldquo;{taskTitle}&rdquo;
              </p>
              <button style={styles.btnGhost} onClick={cancelSearch}>Cancelar</button>
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
              <h2 style={{ ...styles.cardTitle, color: color.success, marginTop: 12 }}>¡Pareja encontrada!</h2>
              <p style={{ color: color.textMuted }}>Entrando a la sesión...</p>
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
    background:  `radial-gradient(circle at 15% 0%, ${color.surfaceRaised} 0%, ${color.bg} 55%)`,
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
    color:        "#c4b99a",
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
    background:   color.borderSoft,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding:      "8px 10px",
    color:        "#c4b99a",
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
    background:   `linear-gradient(180deg, ${color.accentDeep}, #6b4f30)`,
    color:        "#fff",
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
    color:       "#f5d49a",
    whiteSpace:  "nowrap" as const,
  },
  xpLabel: {
    display:        "flex",
    justifyContent: "space-between",
    fontSize:       11,
    color:          "#c4b99a",
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
};
