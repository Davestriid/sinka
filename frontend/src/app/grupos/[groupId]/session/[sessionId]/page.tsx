"use client";

/**
 * Sesion de enfoque grupal (2 a 8 personas).
 *
 * Distinta de /session/[sessionId] (pensada solo para parejas): aca el
 * video es una malla de conexiones WebRTC — una por cada otro participante,
 * armadas con useGroupPeerConnections — y el temporizador Pomodoro corre
 * compartido para todos via GroupSessionService en el backend.
 *
 * Primera version: sin pantalla compartida ni jardin (ver la nota en
 * group-peer-connections.ts) — el enfoque esta en que el grupo se pueda
 * ver, trabajar con un Pomodoro sincronizado y charlar en el descanso.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Users, Coffee, Timer as TimerIcon, Send, X } from "lucide-react";

import { useAuthStore } from "@/store/auth.store";
import { groupsApi, wsUrl, type Group, type GroupMember } from "@/lib/api";
import { useGroupPeerConnections, type GroupSignal } from "@/lib/group-peer-connections";
import { color, radius, shadow, fontSerif, pageBackground } from "@/lib/theme";

interface TimerState {
  phase:           "focus" | "break";
  remaining:       number;
  round:           number;
  max_rounds:      number;
  all_completed:   boolean;
}

interface ChatMsg {
  from: string;
  text: string;
  ts:   number;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function Avatar({ nombre, url, size = 22 }: { nombre: string; url?: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", background: color.border,
      color: color.text, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>
      {(nombre || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

const reasons: Record<string, string> = {
  timer_completed: "¡Pomodoro completado!",
  sola:            "Te quedaste sin compañía — no tiene sentido seguir solo/a en una sesión de grupo.",
  vaciado:         "La sala quedó vacía por más de 10 minutos y se cerró.",
};

export default function SesionGrupoPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string; sessionId: string }>();
  const { accessToken: token, user, hidratado } = useAuthStore();

  const [grupo, setGrupo] = useState<Group | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [conectado, setConectado] = useState(false);
  const [terminada, setTerminada] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [chatAbierto, setChatAbierto] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendSignal = useCallback((targetUserId: string, data: GroupSignal) => {
    wsRef.current?.send(JSON.stringify({ type: "SIGNAL", payload: { target: targetUserId, data } }));
  }, []);

  const {
    localVideoRef, localStream, estadoCamara, cameraAllowed,
    micEnabled, camEnabled, remotos,
    abrirConexion, cerrarConexion, handleSignal, toggleMic, toggleCam,
  } = useGroupPeerConnections({ myUserId: user?.id ?? "", sendSignal });

  // ── Datos del grupo (nombres/avatares de los integrantes) ────────────────
  useEffect(() => {
    if (!hidratado) return;
    if (!token) { router.push("/login"); return; }
    groupsApi.detail(token, params.groupId).then(setGrupo).catch(() => setError("No pudimos cargar el grupo."));
  }, [token, params.groupId, router, hidratado]);

  const perfilDe = useCallback((userId: string): GroupMember | undefined => {
    return grupo?.members?.find(m => m.id === userId);
  }, [grupo]);

  // ── Conexion al canal de la sesion ────────────────────────────────────────
  useEffect(() => {
    if (!token || !user) return;

    const ws = new WebSocket(wsUrl.groupSession(params.groupId, params.sessionId, token));
    wsRef.current = ws;

    ws.onopen  = () => setConectado(true);
    ws.onclose = () => setConectado(false);

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      switch (msg.type) {
        case "ROOM_STATE":
          for (const uid of msg.payload.participants as string[]) abrirConexion(uid);
          setTimer(msg.payload.timer);
          break;
        case "PARTICIPANT_JOINED":
          abrirConexion(msg.payload.user_id);
          break;
        case "PARTICIPANT_LEFT":
          cerrarConexion(msg.payload.user_id);
          break;
        case "SIGNAL":
          handleSignal(msg.payload.from, msg.payload.data);
          break;
        case "TIMER_TICK":
          setTimer(msg.payload);
          break;
        case "CHAT_MESSAGE":
          setChat(prev => [...prev, { from: msg.payload.from, text: msg.payload.text, ts: Date.now() }]);
          break;
        case "SESSION_ENDED":
          setTerminada(msg.payload.reason);
          break;
        case "ERROR":
          setError(msg.detail);
          break;
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, params.groupId, params.sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const enviarChat = () => {
    const texto = mensaje.trim();
    if (!texto || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "CHAT", payload: { text: texto } }));
    setChat(prev => [...prev, { from: user?.id ?? "", text: texto, ts: Date.now() }]);
    setMensaje("");
  };

  const salir = () => {
    if (timer && timer.phase === "focus" && !window.confirm("¿Seguro que quieres salir? El resto del grupo sigue sin ti.")) return;
    router.push(`/grupos/${params.groupId}`);
  };

  const participantesConectados = Object.keys(remotos).length + 1;
  const isBreak = timer?.phase === "break";

  // ── Pantalla de fin ────────────────────────────────────────────────────────
  if (terminada) {
    return (
      <main style={s.finMain}>
        <motion.div style={s.finCard} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Users size={40} color={color.accent} />
          <h2 style={s.finTitulo}>Sesión terminada</h2>
          <p style={s.finTexto}>{reasons[terminada] ?? terminada}</p>
          <button style={s.btnPrimary} onClick={() => router.push(`/grupos/${params.groupId}`)}>
            Volver al grupo
          </button>
        </motion.div>
      </main>
    );
  }

  return (
    <main style={s.main}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontWeight: 700, fontSize: 16, color: color.text }}>{grupo?.name ?? "Grupo"}</span>
          <span style={{ ...s.pill, background: conectado ? color.mossSoft : color.clay, color: conectado ? color.success : color.sand }}>
            <Users size={12} strokeWidth={2} /> {participantesConectados}
          </span>
        </div>
        <button style={s.btnDanger} onClick={salir}>Salir</button>
      </header>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.cuerpo}>
        {/* Temporizador */}
        <div style={s.timerBar}>
          {isBreak
            ? <><Coffee size={15} strokeWidth={2} /> DESCANSO</>
            : <><TimerIcon size={15} strokeWidth={2} /> ENFOQUE</>}
          {timer && <span style={s.timerTexto}>{fmt(timer.remaining)} · Ronda {timer.round}/{timer.max_rounds}</span>}
        </div>

        {/* Grilla de video */}
        <div style={s.grid}>
          <div style={s.tile}>
            {cameraAllowed
              ? <video ref={localVideoRef} autoPlay muted playsInline style={s.video} />
              : <div style={s.tileVacio}><Avatar nombre={user?.alias ?? user?.username ?? "Yo"} url={user?.avatar_url} size={48} /></div>}
            <span style={s.tileLabel}>
              <Avatar nombre={user?.alias ?? user?.username ?? "Yo"} url={user?.avatar_url} size={16} />
              Tú {!micEnabled && <MicOff size={12} />}
            </span>
          </div>

          {Object.values(remotos).map(r => {
            const perfil = perfilDe(r.userId);
            const nombre = perfil?.alias || perfil?.username || "Alguien";
            return (
              <div key={r.userId} style={s.tile}>
                {r.stream
                  ? <video autoPlay playsInline style={s.video} ref={el => { if (el && el.srcObject !== r.stream) el.srcObject = r.stream; }} />
                  : <div style={s.tileVacio}><Avatar nombre={nombre} url={perfil?.avatar_url} size={48} /></div>}
                <span style={s.tileLabel}>
                  <Avatar nombre={nombre} url={perfil?.avatar_url} size={16} />
                  {nombre} {!r.connected && <span style={s.conectando}>conectando…</span>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Controles */}
        <div style={s.controles}>
          <button style={{ ...s.btnIcono, ...(micEnabled ? {} : s.btnApagado) }} onClick={toggleMic} title={micEnabled ? "Silenciar" : "Activar micrófono"}>
            {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button style={{ ...s.btnIcono, ...(camEnabled ? {} : s.btnApagado) }} onClick={toggleCam} title={camEnabled ? "Apagar cámara" : "Encender cámara"}>
            {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button style={s.btnIcono} onClick={() => setChatAbierto(a => !a)} title="Chat">
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Chat lateral */}
      <AnimatePresence>
        {chatAbierto && (
          <motion.div
            style={s.chatPanel}
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={s.chatHeader}>
              <span>Chat del grupo</span>
              <button style={s.btnCerrarChat} onClick={() => setChatAbierto(false)}><X size={16} /></button>
            </div>
            <div style={s.chatMensajes}>
              {chat.length === 0 && <p style={s.chatVacio}>Todavía no hay mensajes.</p>}
              {chat.map((m, i) => {
                const perfil = perfilDe(m.from);
                const soyYo = m.from === user?.id;
                return (
                  <div key={i} style={{ ...s.chatBurbuja, ...(soyYo ? s.chatBurbujaMia : {}) }}>
                    {!soyYo && <span style={s.chatAutor}>{perfil?.alias || perfil?.username || "Alguien"}</span>}
                    <span>{m.text}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={s.chatInputRow}>
              <input
                style={s.chatInput}
                placeholder="Escribe algo…"
                value={mensaje}
                maxLength={500}
                onChange={e => setMensaje(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") enviarChat(); }}
              />
              <button style={s.btnEnviar} onClick={enviarChat}><Send size={15} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: pageBackground, display: "flex", flexDirection: "column" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px", borderBottom: `1px solid ${color.border}`,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  pill: {
    display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999,
    padding: "3px 10px", fontSize: 12, fontWeight: 600,
  },
  btnDanger: {
    background: "transparent", border: `1px solid ${color.accentDeep}`, color: color.accent,
    borderRadius: radius.pill, padding: "7px 16px", fontSize: 13, cursor: "pointer",
  },
  error: { background: color.accentSoft, color: color.accent, padding: 10, margin: 16, borderRadius: radius.md, fontSize: 13 },
  cuerpo: { flex: 1, display: "flex", flexDirection: "column", padding: 20, gap: 16, maxWidth: 1100, margin: "0 auto", width: "100%" },
  timerBar: {
    display: "flex", alignItems: "center", gap: 10, justifyContent: "center",
    fontSize: 13, letterSpacing: "0.06em", color: color.textMuted, fontWeight: 600,
  },
  timerTexto: { fontFamily: fontSerif, fontSize: 18, color: color.text, marginLeft: 6 },
  grid: {
    display: "grid", gap: 12, flex: 1,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  tile: {
    position: "relative", background: color.surface, border: `1px solid ${color.border}`,
    borderRadius: radius.lg, overflow: "hidden", aspectRatio: "4 / 3",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  tileVacio: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color.surfaceSunken },
  tileLabel: {
    position: "absolute", left: 8, bottom: 8, display: "flex", alignItems: "center", gap: 6,
    background: "rgba(var(--c-shadow), 0.55)", color: "#f1eef0", fontSize: 12, fontWeight: 600,
    padding: "4px 9px", borderRadius: radius.pill,
  },
  conectando: { fontWeight: 400, opacity: 0.8, fontSize: 11 },
  controles: { display: "flex", gap: 10, justifyContent: "center" },
  btnIcono: {
    display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44,
    background: color.surfaceRaised, border: `1px solid ${color.border}`, borderRadius: "50%",
    color: color.text, cursor: "pointer",
  },
  btnApagado: { background: color.accentSoft, borderColor: color.accentDeep, color: color.accent },
  btnPrimary: {
    background: `linear-gradient(180deg, ${color.accent}, ${color.accentDeep})`, color: "#fff",
    border: "none", borderRadius: radius.pill, padding: "12px 26px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  finMain: { minHeight: "100vh", background: pageBackground, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  finCard: {
    background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.xl,
    boxShadow: shadow.card, padding: "36px 40px", textAlign: "center", maxWidth: 380,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
  },
  finTitulo: { fontFamily: fontSerif, fontSize: 20, color: color.text, margin: 0 },
  finTexto: { color: color.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 10px" },
  chatPanel: {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 320, maxWidth: "90vw",
    background: color.surface, borderLeft: `1px solid ${color.border}`,
    display: "flex", flexDirection: "column", zIndex: 30,
  },
  chatHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: `1px solid ${color.border}`, fontWeight: 600, color: color.text,
  },
  btnCerrarChat: { background: "none", border: "none", color: color.textMuted, cursor: "pointer" },
  chatMensajes: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 },
  chatVacio: { color: color.textFaint, fontSize: 13 },
  chatBurbuja: {
    display: "flex", flexDirection: "column", gap: 2, background: color.surfaceSunken,
    borderRadius: radius.md, padding: "7px 11px", fontSize: 13, color: color.text, maxWidth: "85%", alignSelf: "flex-start",
  },
  chatBurbujaMia: { alignSelf: "flex-end", background: color.accentSoft },
  chatAutor: { fontSize: 11, color: color.textMuted, fontWeight: 600 },
  chatInputRow: { display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${color.border}` },
  chatInput: {
    flex: 1, background: color.surfaceSunken, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "9px 12px", color: color.text, fontSize: 13, outline: "none",
  },
  btnEnviar: {
    width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: color.accent, color: "#fff", border: "none", borderRadius: radius.md, cursor: "pointer",
  },
};
