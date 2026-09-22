"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { wsUrl } from "@/lib/api";
import { focusDetector } from "@/lib/focus-detector";
import { usePeerConnection, type WebRtcSignal } from "@/lib/peer-connection";
import { gamificationApi, type UserStats } from "@/lib/api";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface TimerState {
  phase:           "focus" | "break";
  remaining:       number;
  elapsed:         number;
  round:           number;
  max_rounds:      number;
  phase_completed: boolean;
  all_completed:   boolean;
}

interface PlantState {
  hp:            number;
  stage:         "seed" | "sprout" | "growing" | "bloom" | "majestic";
  emoji:         string;
  both_focused:  boolean;
  user_a_active: boolean;
  user_b_active: boolean;
}

interface TaskInfo {
  work_area:        string;
  task_title:       string;
  target_pomodoros: number;
}

interface ChatMsg {
  from: string;
  text: string;
  ts:   number;
}

/** Propuesta de seguir trabajando otro bloque. Solo aparece a partir del
 *  segundo encuentro con la misma persona. */
interface ExtensionOffer {
  minutes:         number;
  seconds_to_vote: number;
  extensions_used: number;
}

const AREA_LABELS: Record<string, string> = {
  coding:    "💻 Código",
  design:    "🎨 Diseño",
  video:     "🎬 Video",
  writing:   "✍️  Escritura",
  data:      "📊 Datos",
  music:     "🎵 Música",
  study:     "📚 Estudio",
  research:  "🔬 Investigación",
  marketing: "📢 Marketing",
  other:     "✨ Otro",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function hpColor(hp: number): string {
  if (hp > 60) return "#4ade80";
  if (hp > 30) return "#facc15";
  return "#f87171";
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SessionPage() {
  const router         = useRouter();
  const { sessionId }  = useParams<{ sessionId: string }>();
  const { accessToken: token, user } = useAuthStore();

  // WS
  const wsRef     = useRef<WebSocket | null>(null);
  const [wsReady, setWsReady] = useState(false);

  // Pomodoro
  const [timer, setTimer] = useState<TimerState | null>(null);

  // Planta
  const [plant, setPlant] = useState<PlantState | null>(null);

  // Pareja
  const [partnerConnected, setPartnerConnected] = useState(false);
  const [partnerId, setPartnerId]               = useState<string | null>(null);

  // Sesión
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason]       = useState<string>("");

  // Foco
  const [myActive, setMyActive] = useState(true);

  // Tareas
  const [myTask,      setMyTask]      = useState<TaskInfo | null>(null);
  const [partnerTask, setPartnerTask] = useState<TaskInfo | null>(null);

  // Iniciador WebRTC (user_a crea el offer)
  const [isInitiator, setIsInitiator] = useState(false);

  // Stats de gamificación (antes y después de la sesión)
  const [statsBefore, setStatsBefore] = useState<UserStats | null>(null);
  const [statsAfter,  setStatsAfter]  = useState<UserStats | null>(null);

  // Chat
  const [messages,  setMessages]  = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Propuesta de continuar otro bloque al terminar las rondas
  const [extensionOffer, setExtensionOffer] = useState<ExtensionOffer | null>(null);
  const [myVote,         setMyVote]         = useState<boolean | null>(null);
  const [partnerPending, setPartnerPending] = useState(false);
  const [extensionNote,  setExtensionNote]  = useState<string | null>(null);
  const [voteSeconds,    setVoteSeconds]    = useState(0);

  // ── Función para enviar señales WebRTC a través del WS ───────────────────
  const sendSignal = useCallback((msg: WebRtcSignal) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── Hook WebRTC ───────────────────────────────────────────────────────────
  const {
    localVideoRef,
    remoteVideoRef,
    micEnabled,
    isScreenSharing,
    cameraAllowed,
    connected: peerConnected,
    handleSignal,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  } = usePeerConnection({
    enabled:     partnerConnected,
    isInitiator,
    sendSignal,
  });

  // Mute remote audio durante fase de enfoque
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;
    el.muted = timer?.phase === "focus";
  }, [timer?.phase, remoteVideoRef]);

  // ── Cargar stats de gamificación al iniciar la sesión ────────────────────
  useEffect(() => {
    if (!token) return;
    gamificationApi.getStats(token).then(setStatsBefore).catch(() => {});
  }, [token]);

  // ── Focus heartbeat (cada 10 s) ────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const active = focusDetector.isActive();
      setMyActive(active);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type:    "FOCUS_STATUS_UPDATE",
          payload: { is_active: active },
        }));
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // ── Conexión WS ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !sessionId) return;

    const ws = new WebSocket(wsUrl.session(sessionId, token));
    wsRef.current = ws;

    ws.onopen = () => setWsReady(true);

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      switch (msg.type) {
        case "SESSION_STATE":
        case "SESSION_STARTED":
          // SESSION_STARTED solo se emite cuando las dos personas ya estan
          // conectadas, asi que sirve de confirmacion por si el aviso de
          // PARTNER_CONNECTED se perdio. Sin esto la camara no arranca.
          if (msg.type === "SESSION_STARTED") setPartnerConnected(true);
          if (msg.payload?.timer) setTimer(msg.payload.timer);
          if (msg.payload?.plant) setPlant(msg.payload.plant);
          if (msg.payload?.task_info_a && msg.payload?.user_a_id) {
            const isA = msg.payload.user_a_id === user?.id;
            setMyTask(isA ? msg.payload.task_info_a : msg.payload.task_info_b);
            setPartnerTask(isA ? msg.payload.task_info_b : msg.payload.task_info_a);
            // El usuario user_a crea el offer
            setIsInitiator(isA);
          }
          break;

        case "TIMER_TICK":
          setTimer(msg.payload);
          break;

        case "PLANT_UPDATE":
          setPlant(msg.payload);
          break;

        case "SESSION_ENDED":
          setSessionEnded(true);
          setEndReason(msg.payload?.reason ?? "unknown");
          ws.close();
          // Re-fetch stats después de un momento para mostrar XP ganado
          if (token) {
            setTimeout(() => {
              gamificationApi.getStats(token).then(setStatsAfter).catch(() => {});
            }, 1500);
          }
          break;

        case "EXTENSION_OFFER":
          setExtensionOffer(msg.payload);
          setVoteSeconds(msg.payload?.seconds_to_vote ?? 60);
          setMyVote(null);
          setPartnerPending(false);
          setExtensionNote(null);
          break;

        case "EXTENSION_VOTE_UPDATE":
          // waiting_on trae a quienes todavía no responden
          setPartnerPending((msg.payload?.waiting_on ?? []).length > 0);
          break;

        case "EXTENSION_RESULT": {
          const resultado = msg.payload?.result;
          setExtensionOffer(null);
          setPartnerPending(false);
          if (resultado === "aceptada") {
            if (msg.payload?.timer) setTimer(msg.payload.timer);
            setExtensionNote(
              `Siguen ${msg.payload?.minutes ?? 25} minutos más. Buen trabajo.`
            );
            setTimeout(() => setExtensionNote(null), 6000);
          }
          break;
        }

        case "PARTNER_CONNECTED":
          setPartnerConnected(true);
          setPartnerId(msg.payload?.partner_id ?? null);
          break;

        case "PARTNER_DISCONNECTED":
          setPartnerConnected(false);
          break;

        case "PARTNER_MESSAGE": {
          const inner = msg.payload?.data;
          if (!inner) break;

          // Señales WebRTC — redirigir al hook
          if (
            inner.type === "WEBRTC_OFFER" ||
            inner.type === "WEBRTC_ANSWER" ||
            inner.type === "WEBRTC_ICE"
          ) {
            handleSignal(inner as WebRtcSignal);
            break;
          }

          // Mensajes de chat
          if (inner.type === "CHAT" && inner.text) {
            setMessages(prev => [...prev, {
              from: msg.payload.from,
              text: inner.text,
              ts:   Date.now(),
            }]);
          }
          break;
        }

        default:
          break;
      }
    };

    ws.onclose = () => setWsReady(false);

    return () => ws.close();
  }, [token, sessionId, handleSignal]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cuenta atrás de la propuesta de continuar
  useEffect(() => {
    if (!extensionOffer) return;
    const id = setInterval(() => {
      setVoteSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [extensionOffer]);

  // ── Acciones ───────────────────────────────────────────────────────────────

  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "CHAT", text }));
    setMessages(prev => [...prev, { from: user?.username ?? "yo", text, ts: Date.now() }]);
    setChatInput("");
  }, [chatInput, user]);

  const votarExtension = useCallback((acepta: boolean) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type:    "EXTENSION_VOTE",
      payload: { accept: acepta },
    }));
    setMyVote(acepta);
    setPartnerPending(acepta);   // si acepto, queda esperando al compañero
  }, []);

  const endSession = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "USER_LEFT" }));
    wsRef.current?.close();
    router.push("/dashboard");
  }, [router]);

  const isBreak = timer?.phase === "break";

  // ── Pantalla de fin ───────────────────────────────────────────────────────
  if (sessionEnded) {
    const reasons: Record<string, string> = {
      plant_died:      "La planta murió 🍂",
      timer_completed: "¡Sesión completada! 🎉",
      user_left:       "Sesión terminada",
    };
    const completed  = endReason === "timer_completed";
    const xpEarned   = statsAfter && statsBefore
      ? statsAfter.xp_total - statsBefore.xp_total
      : null;
    const fcEarned   = statsAfter && statsBefore
      ? statsAfter.focus_coins - statsBefore.focus_coins
      : null;
    const leveledUp  = statsAfter && statsBefore
      ? statsAfter.level > statsBefore.level
      : false;
    const streakUp   = statsAfter && statsBefore
      ? statsAfter.streak_current > statsBefore.streak_current
      : false;

    return (
      <div style={styles.centered}>
        <div style={styles.endCard}>
          <div style={{ fontSize: 64 }}>{plant?.emoji ?? "🌱"}</div>
          <h2 style={{ margin: "12px 0 4px", color: "#f5f0e8" }}>
            {reasons[endReason] ?? "Sesión finalizada"}
          </h2>
          {plant && (
            <p style={{ color: "#a0998b", margin: "0 0 16px" }}>
              HP final: {plant.hp.toFixed(1)} — {plant.stage}
            </p>
          )}

          {/* Resumen de gamificación */}
          {completed && (
            <div style={styles.xpSummary}>
              {xpEarned !== null ? (
                <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "baseline" }}>
                  <div style={styles.xpEarned}>
                    +{xpEarned} <span style={{ fontSize: 14 }}>XP</span>
                  </div>
                  {fcEarned !== null && fcEarned > 0 && (
                    <div style={{ ...styles.xpEarned, color: "#fbbf24", fontSize: 24 }}>
                      +{fcEarned} <span style={{ fontSize: 14 }}>FC</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "#6b6358", fontSize: 13 }}>Calculando recompensas...</div>
              )}

              {leveledUp && statsAfter && (
                <div style={styles.levelUpBanner}>
                  ⬆️ ¡Subiste al nivel {statsAfter.level}!
                </div>
              )}

              {streakUp && statsAfter && (
                <div style={styles.streakUp}>
                  🔥 Racha: {statsAfter.streak_current} días consecutivos
                </div>
              )}

              {statsAfter && (
                <div style={styles.xpBarMini}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a0998b", marginBottom: 4 }}>
                    <span>Nivel {statsAfter.level}</span>
                    <span>{statsAfter.xp_current_level} / {statsAfter.xp_next_level > 0 ? statsAfter.xp_next_level : "MAX"} XP</span>
                  </div>
                  <div style={{ height: 6, background: "#3a3028", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.round(statsAfter.xp_progress_pct * 100)}%`,
                      background: "linear-gradient(90deg, #7c5c3a, #c4813a)",
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <button style={{ ...styles.btnPrimary, marginTop: 20 }} onClick={() => router.push("/dashboard")}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totalDuration = timer ? (timer.phase === "focus" ? 25 * 60 : 5 * 60) : 1;
  const progress      = timer ? 1 - timer.remaining / totalDuration : 0;

  return (
    <div style={styles.page}>

      {/* ── Propuesta de continuar otro bloque ── */}
      {extensionOffer && (
        <div style={styles.overlay}>
          <div style={styles.voteCard}>
            <div style={{ fontSize: 44 }}>⏳</div>
            <h3 style={{ margin: "10px 0 6px", color: "#f5f0e8" }}>
              ¿Siguen otro bloque?
            </h3>
            <p style={{ color: "#a0998b", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              Terminaron las rondas. Pueden continuar {extensionOffer.minutes} minutos
              más si los dos están de acuerdo.
            </p>

            {myVote === null ? (
              <>
                <div style={styles.voteButtons}>
                  <button style={styles.btnPrimary} onClick={() => votarExtension(true)}>
                    Seguir trabajando
                  </button>
                  <button style={styles.btnGhost} onClick={() => votarExtension(false)}>
                    Terminar aquí
                  </button>
                </div>
                <span style={{ fontSize: 12, color: "#7c7367" }}>
                  Quedan {voteSeconds} s para responder
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "#a0998b", marginTop: 14 }}>
                {myVote
                  ? partnerPending
                    ? "Esperando la respuesta de tu compañero..."
                    : "Aceptaste continuar."
                  : "Elegiste terminar. La sesión cierra en un momento."}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Aviso de que la sesión continúa ── */}
      {extensionNote && (
        <div style={styles.extensionNote}>🌱 {extensionNote}</div>
      )}

      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#f5f0e8" }}>SINKA</span>
          <span style={{
            ...styles.pill,
            background: wsReady && partnerConnected ? "#166534" : "#78350f",
            color:      wsReady && partnerConnected ? "#bbf7d0" : "#fde68a",
          }}>
            {wsReady && partnerConnected ? "● Sesión activa" : "● Esperando pareja..."}
          </span>
          {peerConnected && (
            <span style={{ ...styles.pill, background: "#1e3a5f", color: "#93c5fd" }}>
              🎥 Video conectado
            </span>
          )}
        </div>
        <button style={styles.btnDanger} onClick={endSession}>Terminar</button>
      </header>

      <main style={styles.main}>

        {/* ── Columna izquierda: Timer + Planta + Tareas ── */}
        <div style={styles.leftCol}>

          {/* Pomodoro */}
          <section style={styles.card}>
            <div style={styles.timerPhaseLabel}>
              {isBreak ? "☕ DESCANSO" : "🍅 ENFOQUE"}
              {timer && (
                <span style={{ fontSize: 13, color: "#a0998b", marginLeft: 8 }}>
                  Ronda {timer.round}/{timer.max_rounds}
                </span>
              )}
            </div>
            <div style={styles.timerDisplay}>
              {timer ? fmtTime(timer.remaining) : "--:--"}
            </div>
            <div style={styles.progressTrack}>
              <div style={{
                ...styles.progressBar,
                width:      `${Math.round(progress * 100)}%`,
                background: isBreak ? "#3b82f6" : "#ef4444",
              }} />
            </div>
          </section>

          {/* Tareas */}
          {(myTask || partnerTask) && (
            <section style={styles.taskPanel}>
              {myTask && (
                <div style={styles.taskCard}>
                  <span style={styles.taskLabel}>Yo</span>
                  <span style={styles.taskArea}>{AREA_LABELS[myTask.work_area] ?? myTask.work_area}</span>
                  <span style={styles.taskTitle}>"{myTask.task_title}"</span>
                  <span style={styles.taskPoms}>{"🍅".repeat(myTask.target_pomodoros)}</span>
                </div>
              )}
              {partnerTask && (
                <div style={styles.taskCard}>
                  <span style={styles.taskLabel}>{partnerId ?? "Pareja"}</span>
                  <span style={styles.taskArea}>{AREA_LABELS[partnerTask.work_area] ?? partnerTask.work_area}</span>
                  <span style={styles.taskTitle}>"{partnerTask.task_title}"</span>
                  <span style={styles.taskPoms}>{"🍅".repeat(partnerTask.target_pomodoros)}</span>
                </div>
              )}
            </section>
          )}

          {/* Planta */}
          <section style={styles.card}>
            <div style={styles.plantEmoji}>{plant?.emoji ?? "🌱"}</div>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span style={{ color: "#f5f0e8", fontWeight: 600, textTransform: "capitalize" }}>
                {plant?.stage ?? "–"}
              </span>
            </div>
            <div style={styles.hpLabel}>
              HP <span style={{ float: "right", color: "#f5f0e8" }}>
                {plant ? plant.hp.toFixed(1) : "–"} / 100
              </span>
            </div>
            <div style={styles.progressTrack}>
              <div style={{
                ...styles.progressBar,
                width:      `${plant ? plant.hp : 50}%`,
                background: plant ? hpColor(plant.hp) : "#4ade80",
                transition: "width 1s linear, background 1s",
              }} />
            </div>
            <div style={styles.focusRow}>
              <span style={focusDot(myActive)}>
                {myActive ? "✓" : "✗"} Yo
              </span>
              <span style={focusDot(partnerConnected && (plant?.both_focused || false))}>
                {partnerConnected ? "" : "–"} {partnerId ?? "Pareja"}
              </span>
            </div>
          </section>

        </div>

        {/* ── Columna central: Vídeo ── */}
        <div style={styles.centerCol}>

          {partnerConnected && (
            <>
              {/* Vídeo remoto — siempre visible cuando partner conectado */}
              <section style={{
                ...styles.card,
                padding: 0,
                overflow: "hidden",
                position: "relative" as const,
                background: "#0d0b09",
              }}>
                {/* Placeholder mientras P2P no está listo */}
                {!peerConnected && (
                  <div style={{
                    position:       "absolute" as const,
                    inset:          0,
                    display:        "flex",
                    flexDirection:  "column" as const,
                    alignItems:     "center",
                    justifyContent: "center",
                    background:     "#0d0b09",
                    gap:            8,
                    zIndex:         2,
                  }}>
                    <div style={{
                      width:        52,
                      height:       52,
                      borderRadius: "50%",
                      background:   "#1c1816",
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "center",
                      fontSize:     22,
                    }}>
                      {(partnerId ?? "P").slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, color: "#6b6358" }}>
                      {peerConnected ? "" : "Conectando video…"}
                    </span>
                  </div>
                )}

                {/* Vídeo remoto */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={!isBreak}
                  style={{
                    width:      "100%",
                    height:     isBreak ? 280 : 160,
                    objectFit: "cover",
                    display:    "block",
                    transition: "height 0.4s ease",
                    opacity:    peerConnected ? 1 : 0,
                  }}
                />
                {/* Label */}
                <div style={styles.videoLabel}>
                  {partnerId ?? "Pareja"} {!isBreak && "🔇"}
                </div>

                {/* Vídeo local — thumbnail en esquina */}
                <div style={styles.localThumb}>
                  {cameraAllowed ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
                    />
                  ) : (
                    <div style={styles.avatarPlaceholder}>
                      {(user?.username ?? "yo").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </section>

              {/* Controles de vídeo — solo en descanso */}
              {isBreak && (
                <div style={styles.mediaControls}>
                  <button
                    style={{ ...styles.mediaBtn, background: micEnabled ? "#2a2420" : "#7f1d1d" }}
                    onClick={toggleMic}
                    title={micEnabled ? "Silenciar micrófono" : "Activar micrófono"}
                  >
                    {micEnabled ? "🎤" : "🔇"} Mic
                  </button>
                  <button
                    style={{ ...styles.mediaBtn, background: isScreenSharing ? "#1e3a5f" : "#2a2420" }}
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    title={isScreenSharing ? "Dejar de compartir" : "Compartir pantalla"}
                  >
                    {isScreenSharing ? "🖥️ Compartiendo" : "🖥️ Compartir"}
                  </button>
                  {!cameraAllowed && (
                    <span style={{ fontSize: 11, color: "#a0998b", alignSelf: "center" }}>
                      Cámara no disponible
                    </span>
                  )}
                </div>
              )}

              {!isBreak && (
                <p style={{ fontSize: 11, color: "#6b6358", textAlign: "center", margin: "4px 0 0" }}>
                  Audio habilitado durante el descanso ☕
                </p>
              )}
            </>
          )}

          {!partnerConnected && (
            <section style={{ ...styles.card, textAlign: "center", color: "#a0998b", padding: 32 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
              <p>Esperando que tu pareja se conecte...</p>
            </section>
          )}

        </div>

        {/* ── Columna derecha: Chat ── */}
        <div style={styles.rightCol}>
          <section style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={styles.chatHeader}>
              Chat
              {isBreak
                ? <span style={{ fontSize: 11, color: "#86efac", marginLeft: 6 }}>● descanso</span>
                : <span style={{ fontSize: 11, color: "#a0998b", marginLeft: 6 }}>● silencioso</span>
              }
            </div>
            <div style={styles.chatMessages}>
              {messages.length === 0 && (
                <p style={{ color: "#a0998b", textAlign: "center", margin: "auto" }}>
                  Manda un mensaje a tu pareja
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.chatBubble,
                    alignSelf:   m.from === user?.username ? "flex-end" : "flex-start",
                    background:  m.from === user?.username ? "#3b2f1e" : "#2a2420",
                    borderColor: m.from === user?.username ? "#7c5c3a" : "#4a3f35",
                  }}
                >
                  <span style={{ fontSize: 11, color: "#a0998b" }}>{m.from}</span>
                  <p style={{ margin: "2px 0 0", color: "#f5f0e8" }}>{m.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={styles.chatInputRow}>
              <input
                style={styles.chatInput}
                value={chatInput}
                placeholder="Escribe algo..."
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
                disabled={!wsReady}
              />
              <button
                style={{ ...styles.btnPrimary, padding: "10px 18px" }}
                onClick={sendChat}
                disabled={!wsReady}
              >
                →
              </button>
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     "100vh",
    background:    "#1a1612",
    fontFamily:    "system-ui, sans-serif",
    display:       "flex",
    flexDirection: "column",
  },
  centered: {
    minHeight:      "100vh",
    background:     "#1a1612",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  overlay: {
    position:       "fixed" as const,
    inset:          0,
    background:     "rgba(12, 10, 8, 0.82)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         50,
  },
  voteCard: {
    background:    "#211d19",
    border:        "1px solid #3a3028",
    borderRadius:  16,
    padding:       "32px 36px",
    textAlign:     "center" as const,
    maxWidth:      380,
    width:         "100%",
    display:       "flex",
    flexDirection: "column" as const,
    alignItems:    "center",
    gap:           6,
  },
  voteButtons: {
    display:       "flex",
    flexDirection: "column" as const,
    gap:           10,
    width:         "100%",
    margin:        "18px 0 8px",
  },
  btnGhost: {
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "10px 16px",
    fontSize:     14,
    cursor:       "pointer",
    width:        "100%",
  },
  extensionNote: {
    position:     "fixed" as const,
    top:          16,
    left:         "50%",
    transform:    "translateX(-50%)",
    background:   "#1f3a24",
    color:        "#bbf7d0",
    border:       "1px solid #2f5c38",
    borderRadius: 999,
    padding:      "8px 18px",
    fontSize:     13,
    zIndex:       60,
  },
  endCard: {
    background:   "#211d19",
    border:       "1px solid #3a3028",
    borderRadius: 16,
    padding:      40,
    textAlign:    "center",
    maxWidth:     380,
    width:        "100%",
  },
  xpSummary: {
    background:   "#2a2420",
    border:       "1px solid #3a3028",
    borderRadius: 10,
    padding:      "16px 20px",
    marginBottom: 4,
    display:      "flex",
    flexDirection: "column" as const,
    gap:          10,
  },
  xpEarned: {
    fontSize:   32,
    fontWeight: 800,
    color:      "#f5d49a",
    textAlign:  "center" as const,
  },
  levelUpBanner: {
    background:   "#1e3a1e",
    border:       "1px solid #166534",
    borderRadius: 8,
    padding:      "8px 14px",
    color:        "#86efac",
    fontWeight:   700,
    fontSize:     14,
  },
  streakUp: {
    background:   "#2d1f10",
    border:       "1px solid #7c3a10",
    borderRadius: 8,
    padding:      "8px 14px",
    color:        "#fb923c",
    fontWeight:   700,
    fontSize:     14,
  },
  xpBarMini: {
    marginTop: 4,
  },
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    padding:        "12px 24px",
    background:     "#211d19",
    borderBottom:   "1px solid #3a3028",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  pill: {
    borderRadius: 999,
    padding:      "3px 10px",
    fontSize:     12,
    fontWeight:   600,
  },
  main: {
    display:  "flex",
    gap:      20,
    padding:  24,
    flex:     1,
    flexWrap: "wrap",
  },
  leftCol: {
    display:       "flex",
    flexDirection: "column",
    gap:           16,
    flex:          "1 1 240px",
    maxWidth:      320,
  },
  centerCol: {
    display:       "flex",
    flexDirection: "column",
    gap:           12,
    flex:          "1 1 240px",
    maxWidth:      340,
  },
  rightCol: {
    display:       "flex",
    flexDirection: "column",
    flex:          "2 1 280px",
    minHeight:     400,
  },
  card: {
    background:   "#211d19",
    border:       "1px solid #3a3028",
    borderRadius: 12,
    padding:      20,
  },
  timerPhaseLabel: {
    textAlign:     "center",
    color:         "#a0998b",
    fontWeight:    700,
    fontSize:      13,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    marginBottom:  4,
  },
  timerDisplay: {
    textAlign:          "center",
    fontSize:           64,
    fontWeight:         700,
    color:              "#f5f0e8",
    fontVariantNumeric: "tabular-nums",
    lineHeight:         1.1,
    margin:             "4px 0 12px",
  },
  progressTrack: {
    height:       8,
    background:   "#3a3028",
    borderRadius: 4,
    overflow:     "hidden",
  },
  progressBar: {
    height:       "100%",
    borderRadius: 4,
    transition:   "width 1s linear",
  },
  plantEmoji: {
    textAlign:    "center",
    fontSize:     72,
    lineHeight:   1,
    marginBottom: 8,
  },
  hpLabel: {
    fontSize: 12,
    color:    "#a0998b",
    margin:   "10px 0 4px",
  },
  focusRow: {
    display:        "flex",
    justifyContent: "space-between",
    marginTop:      12,
    gap:            8,
  },
  taskPanel: {
    display:  "flex",
    gap:      10,
    flexWrap: "wrap",
  },
  taskCard: {
    flex:          "1 1 120px",
    background:    "#211d19",
    border:        "1px solid #3a3028",
    borderRadius:  10,
    padding:       "10px 14px",
    display:       "flex",
    flexDirection: "column" as const,
    gap:           3,
  },
  taskLabel: {
    fontSize:      11,
    fontWeight:    700,
    color:         "#6b6358",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  taskArea:  { fontSize: 13, color: "#a0998b" },
  taskTitle: {
    fontSize:     14,
    color:        "#f5f0e8",
    fontWeight:   600,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap" as const,
  },
  taskPoms: { fontSize: 13, marginTop: 2 },
  // Vídeo
  videoLabel: {
    position:   "absolute",
    bottom:     8,
    left:       10,
    fontSize:   11,
    color:      "#e5e7eb",
    background: "rgba(0,0,0,0.5)",
    padding:    "2px 8px",
    borderRadius: 999,
  },
  localThumb: {
    position:     "absolute",
    bottom:       8,
    right:        8,
    width:        80,
    height:       60,
    borderRadius: 6,
    overflow:     "hidden",
    border:       "2px solid #3a3028",
    background:   "#0d0b09",
  },
  avatarPlaceholder: {
    width:          "100%",
    height:         "100%",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       28,
    background:     "#2a2420",
  },
  mediaControls: {
    display: "flex",
    gap:     10,
    flexWrap: "wrap",
  },
  mediaBtn: {
    flex:         "1 1 auto",
    padding:      "9px 14px",
    borderRadius: 8,
    border:       "1px solid #3a3028",
    color:        "#f5f0e8",
    cursor:       "pointer",
    fontSize:     13,
    fontWeight:   600,
    transition:   "background 0.2s",
  },
  // Chat
  chatHeader: {
    fontWeight:   700,
    color:        "#f5f0e8",
    marginBottom: 12,
    fontSize:     15,
  },
  chatMessages: {
    flex:          1,
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    gap:           8,
    minHeight:     200,
    maxHeight:     340,
    padding:       "4px 0",
  },
  chatBubble: {
    maxWidth:     "75%",
    padding:      "8px 12px",
    borderRadius: 10,
    border:       "1px solid",
  },
  chatInputRow: {
    display:   "flex",
    gap:       8,
    marginTop: 12,
  },
  chatInput: {
    flex:         1,
    padding:      "10px 14px",
    borderRadius: 8,
    border:       "1px solid #3a3028",
    background:   "#2a2420",
    color:        "#f5f0e8",
    fontSize:     14,
    outline:      "none",
  },
  btnPrimary: {
    background:   "#7c5c3a",
    color:        "#fff",
    border:       "none",
    borderRadius: 8,
    padding:      "10px 24px",
    cursor:       "pointer",
    fontWeight:   600,
    fontSize:     14,
  },
  btnDanger: {
    background:   "transparent",
    color:        "#f87171",
    border:       "1px solid #f87171",
    borderRadius: 8,
    padding:      "6px 16px",
    cursor:       "pointer",
    fontSize:     13,
  },
};

function focusDot(active: boolean): React.CSSProperties {
  return {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          4,
    fontSize:     12,
    fontWeight:   600,
    padding:      "3px 10px",
    borderRadius: 999,
    background:   active ? "#14532d" : "#3f1919",
    color:      active ? "#86efac" : "#fca5a5",
  };
}
