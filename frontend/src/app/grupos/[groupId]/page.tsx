"use client";

/**
 * Sala de espera de un grupo.
 *
 * Cada integrante se marca listo y, si el grupo esta abierto a desconocidos,
 * comparte su pantalla. Cuando se cumplen las condiciones, quien creo el grupo
 * puede iniciar la sesion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { groupsApi, wsUrl, type Group, type LobbyState } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function SalaGrupoPage() {
  const router = useRouter();
  const params = useParams<{ groupId: string }>();
  const { accessToken: token, user } = useAuthStore();

  const [group, setGroup] = useState<Group | null>(null);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [listo, setListo] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [error, setError] = useState("");
  const [conectado, setConectado] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const cargarGrupo = useCallback(async () => {
    if (!token) { router.push("/login"); return; }
    try { setGroup(await groupsApi.detail(token, params.groupId)); }
    catch { setError("No pudimos abrir ese grupo."); }
  }, [token, params.groupId, router]);

  useEffect(() => { cargarGrupo(); }, [cargarGrupo]);

  // Conexión a la sala
  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(wsUrl.groupLobby(params.groupId, token));
    wsRef.current = ws;

    ws.onopen  = () => setConectado(true);
    ws.onclose = () => setConectado(false);

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);

      if (msg.type === "LOBBY_STATE") {
        setLobby(msg.payload);
      } else if (msg.type === "SESSION_STARTED") {
        router.push(`/session/${msg.payload.session_id}`);
      } else if (msg.type === "ERROR") {
        setError(msg.detail);
      }
    };

    return () => ws.close();
  }, [token, params.groupId, router]);

  const enviar = (type: string, payload?: unknown) => {
    wsRef.current?.send(JSON.stringify({ type, payload }));
  };

  const alternarListo = () => {
    const nuevo = !listo;
    setListo(nuevo);
    enviar("READY", { ready: nuevo });
  };

  const alternarPantalla = async () => {
    const nuevo = !compartiendo;
    // Se pide el permiso real del navegador antes de decir que se comparte
    if (nuevo) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop()); // en la sala solo se verifica el permiso
      } catch {
        setError("Necesitas dar permiso para compartir pantalla.");
        return;
      }
    }
    setCompartiendo(nuevo);
    enviar("SCREEN_SHARE", { sharing: nuevo });
  };

  const yo = lobby?.present.find((p) => p.user_id === user?.id);
  const soyDueno = group?.is_owner ?? false;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/grupos")}>← A grupos</button>
        <h1 style={s.title}>{group?.name ?? "Sala"}</h1>
        <span style={{ ...s.dot, background: conectado ? "#7fa05a" : "#8b5a4a" }} />
      </header>

      {error && <div style={s.error}>{error}</div>}

      {group?.requires_screen_share && (
        <div style={s.aviso}>
          En este grupo participa gente que no se conoce, por eso compartir
          pantalla es obligatorio para entrar a la sesión.
        </div>
      )}

      <div style={s.card}>
        <h2 style={s.cardTitle}>
          En la sala <span style={s.count}>{lobby?.present.length ?? 0}</span>
        </h2>

        {(lobby?.present.length ?? 0) === 0 ? (
          <p style={s.empty}>Todavía no ha llegado nadie más. Espera un momento.</p>
        ) : (
          lobby!.present.map((p) => (
            <div key={p.user_id} style={s.row}>
              <span style={{ ...s.estado, background: p.ready ? "#7fa05a" : "#4a4238" }} />
              <span style={s.name}>
                {p.username}
                {p.is_owner && <span style={s.tag}>dueño</span>}
              </span>
              <span style={s.muted}>
                {p.ready ? "listo" : "esperando"}
                {group?.requires_screen_share && (p.sharing_screen ? " · pantalla ✓" : " · sin pantalla")}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={s.actions}>
        <button
          style={{ ...s.btn, background: listo ? "#4a5d3a" : "#2f2a24" }}
          onClick={alternarListo}
        >
          {listo ? "✓ Estoy listo" : "Marcarme listo"}
        </button>

        {group?.requires_screen_share && (
          <button
            style={{ ...s.btn, background: compartiendo ? "#4a5d3a" : "#2f2a24" }}
            onClick={alternarPantalla}
          >
            {compartiendo ? "✓ Compartiendo pantalla" : "Compartir pantalla"}
          </button>
        )}
      </div>

      {soyDueno && (
        <div style={s.card}>
          <button
            style={{ ...s.btnPrimary, opacity: lobby?.can_start ? 1 : 0.45 }}
            disabled={!lobby?.can_start}
            onClick={() => enviar("START")}
          >
            Iniciar sesión conjunta
          </button>
          {!lobby?.can_start && lobby?.reason && (
            <p style={s.muted}>{lobby.reason}</p>
          )}
        </div>
      )}

      {!soyDueno && (
        <p style={s.muted}>
          {yo?.ready
            ? "Estás listo. La sesión empieza cuando el dueño del grupo la inicie."
            : "Márcate listo para participar en la próxima sesión."}
        </p>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 14, marginBottom: 20 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 24, margin: 0, marginRight: "auto" },
  dot:    { width: 9, height: 9, borderRadius: "50%" },
  card:      { background: "#221e1a", borderRadius: 12, padding: 20, marginBottom: 16, maxWidth: 560 },
  cardTitle: { fontSize: 16, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 },
  count:  { background: "#2f2a24", borderRadius: 10, padding: "1px 8px", fontSize: 12 },
  row: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 0", borderBottom: "1px solid #2f2a24",
  },
  estado: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  name:   { fontWeight: 600, fontSize: 14, flex: 1, display: "flex", alignItems: "center", gap: 6 },
  tag: {
    fontSize: 10, padding: "2px 6px", borderRadius: 6,
    background: "#2f2a24", color: "#8b8378", fontWeight: 400,
  },
  muted:  { color: "#8b8378", fontSize: 12, lineHeight: 1.6, margin: "8px 0 0" },
  empty:  { color: "#8b8378", fontSize: 13, margin: 0 },
  actions: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" },
  btn: {
    padding: "11px 20px", borderRadius: 8, border: "1px solid #3a332b",
    color: "#f5f0e8", cursor: "pointer", fontSize: 14,
  },
  btnPrimary: {
    width: "100%", padding: "13px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer",
    fontSize: 15, fontWeight: 600,
  },
  aviso: {
    background: "#2a2318", color: "#c4a05a", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13,
    lineHeight: 1.6, maxWidth: 560,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 560,
  },
};
