"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { wsUrl, gamificationApi, type UserStats } from "@/lib/api";

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

// ── Opciones de Pomodoros ─────────────────────────────────────────────────────
const POMODORO_OPTIONS = [
  { value: 1, label: "1 Pomodoro",  sub: "~25 min" },
  { value: 2, label: "2 Pomodoros", sub: "~50 min" },
  { value: 3, label: "3 Pomodoros", sub: "~1 h 15 min" },
  { value: 4, label: "4 Pomodoros", sub: "~1 h 40 min" },
];

// ── Estado de la pantalla ─────────────────────────────────────────────────────
type Screen = "config" | "searching" | "matched" | "timeout" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken: token, logout } = useAuthStore();

  // Formulario de configuración
  const [topic,            setTopic]            = useState("");
  const [taskTitle,        setTaskTitle]        = useState("");
  const [targetPomodoros,  setTargetPomodoros]  = useState(2);

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

    if (!token) { router.push("/login"); return; }

    const ws = new WebSocket(wsUrl.matchmakingQueue(token));
    wsRef.current = ws;

    ws.onopen = () => {
      // Primer mensaje: info de tarea
      ws.send(JSON.stringify({
        type:    "TASK_INFO",
        payload: {
          topic:            topic,
          task_title:       title,
          target_pomodoros: targetPomodoros,
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* Header */}
      <header style={styles.header}>
        <span style={styles.logo}>SINKA</span>
        <div style={styles.headerRight}>
          <button style={styles.btnGhost} onClick={() => router.push("/leaderboard")}>🏆</button>
          <button style={styles.btnGhost} onClick={() => router.push("/shop")}>
            🛍️{stats ? ` ${stats.focus_coins} FC` : ""}
          </button>
          <span style={styles.username}>{user?.username}</span>
          <button style={styles.btnGhost} onClick={() => { logout(); router.push("/login"); }}>
            Salir
          </button>
        </div>
      </header>

      <main style={styles.main}>

        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Widget de gamificación ── */}
        {stats && (
          <div style={styles.statsCard}>
            {/* Fila superior: nivel + racha */}
            <div style={styles.statsRow}>
              <div style={styles.levelBadge}>
                <span style={styles.levelNum}>Nv. {stats.level}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.xpLabel}>
                  <span>{stats.xp_current_level} / {stats.xp_next_level > 0 ? stats.xp_next_level : "MAX"} XP</span>
                  <span style={{ color: "#a0998b" }}>Total: {stats.xp_total.toLocaleString()}</span>
                </div>
                <div style={styles.xpTrack}>
                  <div style={{
                    ...styles.xpBar,
                    width: `${Math.round(stats.xp_progress_pct * 100)}%`,
                  }} />
                </div>
              </div>
              <div style={styles.streakBadge}>
                <span>🔥</span>
                <span style={{ fontWeight: 700, color: stats.streak_current > 0 ? "#fb923c" : "#6b6358" }}>
                  {stats.streak_current}
                </span>
                <span style={{ fontSize: 10, color: "#6b6358" }}>días</span>
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

        {/* ── Pantalla: formulario de configuración ── */}
        {screen === "config" && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>¿En qué vas a trabajar hoy?</h2>
            <p style={styles.cardSub}>
              Cuéntanos tu tarea antes de buscar pareja.
            </p>

            {/* Categoría de actividad — define con quién te empareja el sistema */}
            <label style={styles.label}>¿En qué área trabajas?</label>
            <div style={styles.areaGrid}>
              {TOPICS.map(a => (
                <button
                  key={a.value}
                  style={{
                    ...styles.areaBtn,
                    ...(topic === a.value ? styles.areaBtnActive : {}),
                  }}
                  onClick={() => setTopic(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p style={styles.hint}>
              Te buscaremos a alguien de tu misma área. Si en 30 segundos no hay
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

            {/* Pomodoros objetivo */}
            <label style={styles.label}>¿Cuántos Pomodoros quieres hacer?</label>
            <div style={styles.pomRow}>
              {POMODORO_OPTIONS.map(p => (
                <button
                  key={p.value}
                  style={{
                    ...styles.pomBtn,
                    ...(targetPomodoros === p.value ? styles.pomBtnActive : {}),
                  }}
                  onClick={() => setTargetPomodoros(p.value)}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{"🍅".repeat(p.value)}</span>
                  <span style={{ fontSize: 12, marginTop: 2 }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: "#a0998b" }}>{p.sub}</span>
                </button>
              ))}
            </div>

            <button
              style={{
                ...styles.btnPrimary,
                opacity: taskTitle.trim() && topic ? 1 : 0.45,
                cursor:  taskTitle.trim() && topic ? "pointer" : "not-allowed",
                marginTop: 24,
                width: "100%",
              }}
              disabled={!taskTitle.trim() || !topic}
              onClick={startSearch}
            >
              Buscar pareja →
            </button>
          </div>
        )}

        {/* ── Pantalla: buscando ── */}
        {screen === "searching" && (
          <div style={{ ...styles.card, textAlign: "center" }}>
            <div style={styles.spinner} />
            <h2 style={{ color: "#f5f0e8", margin: "20px 0 8px" }}>
              Buscando pareja...
            </h2>
            <p style={{ color: "#a0998b", margin: "0 0 8px" }}>
              {TOPICS.find(a => a.value === topic)?.label}
            </p>
            <p style={{ color: "#c4b99a", fontSize: 14, margin: "0 0 24px" }}>
              "{taskTitle}"
            </p>
            <button style={styles.btnGhost} onClick={cancelSearch}>Cancelar</button>
          </div>
        )}

        {/* ── Pantalla: emparejado ── */}
        {screen === "matched" && (
          <div style={{ ...styles.card, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <h2 style={{ color: "#4ade80", margin: "12px 0 8px" }}>¡Pareja encontrada!</h2>
            <p style={{ color: "#a0998b" }}>Entrando a la sesión...</p>
          </div>
        )}

        {/* ── Pantalla: timeout ── */}
        {screen === "timeout" && (
          <div style={{ ...styles.card, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>⏱️</div>
            <h2 style={{ color: "#f5f0e8", margin: "12px 0 8px" }}>No encontramos pareja</h2>
            <p style={{ color: "#a0998b", marginBottom: 20 }}>
              No había nadie disponible. ¿Intentamos de nuevo?
            </p>
            <button style={styles.btnPrimary} onClick={() => setScreen("config")}>
              Volver a intentar
            </button>
          </div>
        )}

        {/* ── Pantalla: error ── */}
        {screen === "error" && (
          <div style={{ ...styles.card, textAlign: "center" }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <h2 style={{ color: "#f87171", margin: "12px 0 8px" }}>Algo salió mal</h2>
            <p style={{ color: "#a0998b", marginBottom: 20 }}>{error}</p>
            <button style={styles.btnPrimary} onClick={() => setScreen("config")}>
              Reintentar
            </button>
          </div>
        )}

        </div>  {/* end wrapper */}
      </main>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:   "100vh",
    background:  "#1a1612",
    fontFamily:  "system-ui, sans-serif",
    display:     "flex",
    flexDirection: "column",
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "12px 24px",
    background:     "#211d19",
    borderBottom:   "1px solid #3a3028",
  },
  logo: {
    fontWeight: 800,
    fontSize:   20,
    color:      "#f5f0e8",
    letterSpacing: "0.05em",
  },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  username:    { color: "#a0998b", fontSize: 14 },
  main: {
    flex:           1,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "32px 16px",
  },
  card: {
    background:   "#211d19",
    border:       "1px solid #3a3028",
    borderRadius: 16,
    padding:      "32px 28px",
    width:        "100%",
    maxWidth:     520,
  },
  cardTitle: {
    color:      "#f5f0e8",
    margin:     "0 0 6px",
    fontSize:   22,
    fontWeight: 700,
  },
  cardSub: {
    color:      "#a0998b",
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
    background:   "#2a2420",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "8px 10px",
    color:        "#c4b99a",
    cursor:       "pointer",
    fontSize:     13,
    textAlign:    "left",
    transition:   "all 0.15s",
  },
  areaBtnActive: {
    background:   "#3b2f1e",
    borderColor:  "#7c5c3a",
    color:        "#f5f0e8",
  },
  hint: {
    fontSize:  12,
    color:     "#8b8378",
    margin:    "8px 0 4px",
    lineHeight: 1.5,
  },
  input: {
    width:        "100%",
    padding:      "11px 14px",
    background:   "#2a2420",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    color:        "#f5f0e8",
    fontSize:     14,
    outline:      "none",
    boxSizing:    "border-box",
  },
  charCount: {
    display:   "block",
    textAlign: "right",
    fontSize:  11,
    color:     "#6b6358",
    marginTop: 4,
  },
  pomRow: {
    display:   "flex",
    gap:       8,
    flexWrap:  "wrap",
  },
  pomBtn: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    background:    "#2a2420",
    border:        "1px solid #3a3028",
    borderRadius:  8,
    padding:       "10px 14px",
    cursor:        "pointer",
    color:         "#c4b99a",
    flex:          "1 1 100px",
    minWidth:      80,
    transition:    "all 0.15s",
  },
  pomBtnActive: {
    background:  "#3b2f1e",
    borderColor: "#7c5c3a",
    color:       "#f5f0e8",
  },
  btnPrimary: {
    background:   "#7c5c3a",
    color:        "#fff",
    border:       "none",
    borderRadius: 8,
    padding:      "12px 28px",
    cursor:       "pointer",
    fontWeight:   700,
    fontSize:     15,
  },
  btnGhost: {
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "8px 18px",
    cursor:       "pointer",
    fontSize:     13,
  },
  spinner: {
    width:        40,
    height:       40,
    border:       "3px solid #3a3028",
    borderTop:    "3px solid #7c5c3a",
    borderRadius: "50%",
    margin:       "0 auto",
    animation:    "spin 1s linear infinite",
  },
  // Gamification widget
  statsCard: {
    background:   "#211d19",
    border:       "1px solid #3a3028",
    borderRadius: 12,
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
    background:   "#3b2f1e",
    border:       "1px solid #7c5c3a",
    borderRadius: 8,
    padding:      "6px 12px",
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
    background:   "#3a3028",
    borderRadius: 3,
    overflow:     "hidden",
  },
  xpBar: {
    height:       "100%",
    background:   "linear-gradient(90deg, #7c5c3a, #c4813a)",
    borderRadius: 3,
    transition:   "width 0.6s ease",
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
  statsMini: { display: "flex", gap: 16, fontSize: 12, color: "#6b6358", flexWrap: "wrap" as const },
};
