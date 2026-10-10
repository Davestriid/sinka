"use client";

/**
 * Vinculos — amigos y solicitudes.
 *
 * Una sola lista con los amigos, y a la derecha una columna fija con las
 * solicitudes pendientes. En pantallas angostas la columna se apila abajo.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  friendsApi,
  profileApi,
  reportsApi,
  type Friend,
  type RequestsPayload,
  type UserResponse,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, pageBackground } from "@/lib/theme";

export default function VinculosPage() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [friends,  setFriends]  = useState<Friend[]>([]);
  const [requests, setRequests] = useState<RequestsPayload | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Buscador
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<UserResponse[]>([]);
  const [searching, setSearching] = useState(false);

  const cargar = useCallback(async () => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    try {
      const [f, r] = await Promise.all([
        friendsApi.list(token),
        friendsApi.requests(token),
      ]);
      setFriends(f);
      setRequests(r);
      setError("");
    } catch {
      setError("No pudimos cargar tus vínculos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [token, router, hidratado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Buscar con un respiro para no disparar una petición por cada tecla
  useEffect(() => {
    if (!token || query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setResults(await profileApi.search(token, query.trim())); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query, token]);

  const accion = async (fn: () => Promise<unknown>) => {
    try { await fn(); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal."); }
  };

  const [mensaje, setMensaje] = useState("");

  /**
   * Reportar a un amigo: texto libre en vez de un formulario aparte — para
   * algo que se usa poco, un prompt() es mas simple que montar un modal.
   * La razon queda como "otro" y el texto del usuario va en `details`; quien
   * modera lo lee igual en el panel de administracion.
   */
  const reportar = async (u: { id: string; alias?: string | null; username: string }) => {
    if (!token) return;
    const motivo = window.prompt(
      `¿Por qué quieres reportar a ${u.alias || u.username}? Describe brevemente qué pasó.`
    );
    if (!motivo || !motivo.trim()) return;
    if (!window.confirm(`¿Enviar este reporte sobre ${u.alias || u.username} al equipo de moderación?`)) return;
    try {
      await reportsApi.crear(token, u.id, "otro", motivo.trim());
      setMensaje("Reporte enviado. Gracias por avisarnos.");
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el reporte.");
    }
  };

  if (loading) {
    return <div style={s.page}><p style={s.muted}>Cargando tus vínculos…</p></div>;
  }

  const sinCuota = requests !== null && requests.remaining === 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Vínculos</h1>
      </header>

      {error && <div style={s.error}>{error}</div>}
      {mensaje && <div style={s.ok}>{mensaje}</div>}

      <div style={s.layout}>
        {/* ── Columna principal: amigos ── */}
        <main style={s.main}>
          <div style={s.searchBox}>
            <input
              style={s.input}
              placeholder="Buscar a alguien por su nombre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && <span style={s.muted}>Buscando…</span>}
          </div>

          {results.length > 0 && (
            <section style={s.card}>
              <h2 style={s.cardTitle}>Resultados</h2>
              {results.map((u) => (
                <div key={u.id} style={s.row}>
                  <Avatar url={u.avatar_url} nombre={u.alias || u.username} />
                  <span style={s.name}>{u.alias || u.username}</span>
                  <button
                    style={{ ...s.btn, opacity: sinCuota ? 0.45 : 1 }}
                    disabled={sinCuota}
                    onClick={() => accion(() => friendsApi.send(token!, u.id))}
                  >
                    {sinCuota ? "Sin solicitudes hoy" : "Enviar solicitud"}
                  </button>
                </div>
              ))}
            </section>
          )}

          <section style={s.card}>
            <h2 style={s.cardTitle}>
              Mis amigos <span style={s.count}>{friends.length}</span>
            </h2>

            {friends.length === 0 ? (
              <p style={s.empty}>
                Todavía no tienes vínculos. Cuando termines una sesión con alguien,
                podrás enviarle una solicitud desde la pantalla final.
              </p>
            ) : (
              friends.map((f) => (
                <div key={f.friendship_id} style={s.row}>
                  <button
                    style={s.avatarBtn}
                    onClick={() => router.push(`/perfil/${f.user.id}`)}
                    title="Ver perfil"
                  >
                    <Avatar url={f.user.avatar_url} nombre={f.user.alias || f.user.username} />
                  </button>
                  <div style={s.rowInfo}>
                    <span
                      style={{ ...s.name, cursor: "pointer" }}
                      onClick={() => router.push(`/perfil/${f.user.id}`)}
                    >
                      {f.user.alias || f.user.username}
                    </span>
                    {f.plant && (
                      <span style={s.muted}>
                        {f.plant.emoji} {f.plant.sessions_together} sesiones juntos
                      </span>
                    )}
                  </div>
                  <div style={s.rowActions}>
                    <button
                      style={{ ...s.btnGhost, marginLeft: 0 }}
                      onClick={() => router.push(`/citas?con=${f.user.id}`)}
                    >
                      Agendar cita
                    </button>
                    <button
                      style={{ ...s.btnGhost, marginLeft: 0 }}
                      onClick={() => router.push(`/jardin/${f.friendship_id}`)}
                    >
                      Ver planta
                    </button>
                    <button
                      style={{ ...s.btnGhost, marginLeft: 0, color: color.accent }}
                      onClick={() => reportar(f.user)}
                    >
                      Reportar
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>

        {/* ── Columna fija: solicitudes ── */}
        <aside style={s.aside}>
          <h2 style={s.cardTitle}>Solicitudes</h2>

          {requests && (
            <p style={s.quota}>
              {requests.remaining}/{requests.daily_limit} disponibles hoy
            </p>
          )}

          {requests?.incoming.length === 0 && requests?.outgoing.length === 0 && (
            <p style={s.empty}>No tienes solicitudes pendientes.</p>
          )}

          {requests?.incoming.map((r) => (
            <div key={r.friendship_id} style={s.reqCard}>
              <span style={s.name}>{r.user.alias || r.user.username}</span>
              <span style={s.muted}>quiere conectar contigo</span>
              <div style={s.reqActions}>
                <button
                  style={s.btnSmall}
                  onClick={() => accion(() => friendsApi.accept(token!, r.friendship_id))}
                >
                  Aceptar
                </button>
                <button
                  style={s.btnSmallGhost}
                  onClick={() => accion(() => friendsApi.reject(token!, r.friendship_id))}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}

          {requests?.outgoing.map((r) => (
            <div key={r.friendship_id} style={s.reqCard}>
              <span style={s.name}>{r.user.alias || r.user.username}</span>
              <span style={s.muted}>esperando respuesta</span>
              <button
                style={s.btnSmallGhost}
                onClick={() => accion(() => friendsApi.cancel(token!, r.friendship_id))}
              >
                Cancelar
              </button>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

function Avatar({ url, nombre }: { url: string | null; nombre: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={nombre} style={s.avatar} />;
  }
  return <div style={s.avatarFallback}>{nombre.charAt(0).toUpperCase()}</div>;
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: pageBackground, color: color.text, padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  back:   { background: "none", border: "none", color: color.textMuted, cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0 },
  layout: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" },
  main:   { flex: "1 1 480px", minWidth: 320 },
  aside:  {
    width: 280, flexShrink: 0, background: color.surface, borderRadius: radius.md,
    padding: 16, position: "sticky", top: 24,
  },
  card:      { background: color.surface, borderRadius: radius.md, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 },
  count:     { background: color.borderSoft, borderRadius: radius.sm, padding: "1px 8px", fontSize: 12 },
  searchBox: { marginBottom: 16 },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: color.bg, color: color.text, fontSize: 14,
  },
  row: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 0", borderBottom: `1px solid ${color.border}`,
  },
  rowInfo: { display: "flex", flexDirection: "column", flex: 1 },
  rowActions: { display: "flex", gap: 8, marginLeft: "auto" },
  name:    { fontWeight: 600, fontSize: 14 },
  muted:   { color: color.textFaint, fontSize: 12 },
  empty:   { color: color.textFaint, fontSize: 13, lineHeight: 1.6, margin: 0 },
  quota:   { color: color.sand, fontSize: 12, margin: "0 0 12px" },
  reqCard: {
    display: "flex", flexDirection: "column", gap: 4,
    padding: 12, background: color.bg, borderRadius: radius.sm, marginBottom: 8,
  },
  reqActions: { display: "flex", gap: 8, marginTop: 6 },
  btn: {
    marginLeft: "auto", padding: "6px 14px", borderRadius: radius.sm, border: "none",
    background: color.moss, color: color.bg, cursor: "pointer", fontSize: 13,
  },
  btnGhost: {
    marginLeft: "auto", padding: "6px 14px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: "none", color: color.sand,
    cursor: "pointer", fontSize: 13,
  },
  btnSmall: {
    flex: 1, padding: "5px 10px", borderRadius: radius.sm, border: "none",
    background: color.moss, color: color.bg, cursor: "pointer", fontSize: 12,
  },
  btnSmallGhost: {
    flex: 1, padding: "5px 10px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: "none", color: color.textFaint,
    cursor: "pointer", fontSize: 12,
  },
  avatarBtn: {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    borderRadius: "50%", lineHeight: 0, flexShrink: 0,
  },
  avatar: { width: 36, height: 36, borderRadius: "50%", objectFit: "cover" },
  avatarFallback: {
    width: 36, height: 36, borderRadius: "50%", background: color.border,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 15,
  },
  error: {
    background: color.accentSoft, color: color.accent, padding: 12,
    borderRadius: radius.sm, marginBottom: 16, fontSize: 13,
  },
  ok: {
    background: color.mossSoft, color: color.moss, padding: 12,
    borderRadius: radius.sm, marginBottom: 16, fontSize: 13,
  },
};
