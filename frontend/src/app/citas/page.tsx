"use client";

/**
 * Citas programadas.
 *
 * Agenda con las proximas sesiones acordadas y las invitaciones por responder.
 * El cupo diario aparece siempre a la vista para que se sepa cuantas quedan.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  appointmentsApi,
  catalogApi,
  friendsApi,
  type Agenda,
  type Appointment,
  type Friend,
  type Topic,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const DURACIONES = [
  { value: 25, label: "25 min" },
  { value: 50, label: "50 min" },
  { value: 90, label: "90 min" },
];

export default function CitasPage() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [agenda,       setAgenda]       = useState<Agenda | null>(null);
  const [invitaciones, setInvitaciones] = useState<Appointment[]>([]);
  const [amigos,       setAmigos]       = useState<Friend[]>([]);
  const [topics,       setTopics]       = useState<Topic[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [creando,      setCreando]      = useState(false);

  const [nueva, setNueva] = useState({
    invitee_id: "", topic: "", fecha: "", hora: "", duration_minutes: 25, title: "",
  });

  const cargar = useCallback(async () => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    try {
      const [a, i, f] = await Promise.all([
        appointmentsApi.agenda(token),
        appointmentsApi.invitations(token),
        friendsApi.list(token),
      ]);
      setAgenda(a);
      setInvitaciones(i);
      setAmigos(f);
      setError("");
    } catch {
      setError("No pudimos cargar tu agenda.");
    } finally {
      setLoading(false);
    }
  }, [token, router, hidratado]);

  useEffect(() => {
    cargar();
    catalogApi.topics().then((r) => setTopics(r.topics)).catch(() => setTopics([]));
  }, [cargar]);

  // Si llegaron desde "Agendar cita" en Vínculos (?con=userId), abrimos el
  // formulario con esa persona ya elegida.
  useEffect(() => {
    const conId = new URLSearchParams(window.location.search).get("con");
    if (conId) {
      setNueva((n) => ({ ...n, invitee_id: conId }));
      setCreando(true);
    }
  }, []);

  /** Devuelve true solo si la accion salio bien. */
  const accion = async (fn: () => Promise<unknown>): Promise<boolean> => {
    try { await fn(); await cargar(); setError(""); return true; }
    catch (e) {
      setError(e instanceof Error ? e.message : "Algo salió mal.");
      return false;
    }
  };

  const crear = async () => {
    if (!token) return;
    // La fecha y la hora se combinan en el huso del navegador y viajan en ISO
    const cuando = new Date(`${nueva.fecha}T${nueva.hora}`);
    const ok = await accion(() => appointmentsApi.create(token, {
      scheduled_for: cuando.toISOString(),
      topic: nueva.topic,
      duration_minutes: nueva.duration_minutes,
      invitee_id: nueva.invitee_id,
      title: nueva.title.trim() || undefined,
    }));

    // El formulario solo se cierra y se limpia si la cita quedo agendada.
    // Antes se cerraba siempre, asi que un rechazo del servidor se veia igual
    // que un exito: el formulario desaparecia y la cita no estaba en ningun
    // lado, sin que se entendiera por que.
    if (!ok) return;

    setCreando(false);
    setNueva({ invitee_id: "", topic: "", fecha: "", hora: "", duration_minutes: 25, title: "" });
  };

  const unirse = async (id: string) => {
    if (!token) return;
    try {
      const { session_id } = await appointmentsApi.join(token, id);
      router.push(`/session/${session_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos iniciar la sesión.");
    }
  };

  const completo = nueva.invitee_id && nueva.topic && nueva.fecha && nueva.hora;
  const sinCupo  = agenda !== null && agenda.remaining === 0;

  const formatear = (iso: string) =>
    new Date(iso).toLocaleString("es-EC", {
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Citas</h1>
        {agenda && (
          <span style={s.quota}>{agenda.remaining}/{agenda.daily_limit} disponibles hoy</span>
        )}
      </header>

      {error && <div style={s.error}>{error}</div>}

      <button
        style={{ ...s.btn, marginBottom: 16, opacity: sinCupo && !creando ? 0.45 : 1 }}
        disabled={sinCupo && !creando}
        onClick={() => setCreando(!creando)}
      >
        {creando ? "Cancelar" : sinCupo ? "Sin cupos por hoy" : "+ Agendar sesión"}
      </button>

      {creando && (
        <section style={s.card}>
          <h2 style={s.cardTitle}>Nueva cita</h2>

          {amigos.length === 0 ? (
            <p style={s.empty}>
              Solo puedes agendar con tus amigos. Agrega a alguien primero desde
              la pantalla de vínculos.
            </p>
          ) : (
            <>
              <p style={s.label}>¿Con quién?</p>
              <div style={s.chips}>
                {amigos.map((f) => (
                  <button
                    key={f.user.id}
                    style={{ ...s.chip, ...(nueva.invitee_id === f.user.id ? s.chipOn : {}) }}
                    onClick={() => setNueva({ ...nueva, invitee_id: f.user.id })}
                  >
                    {f.user.alias || f.user.username}
                  </button>
                ))}
              </div>

              <p style={s.label}>¿En qué van a trabajar?</p>
              <div style={s.chips}>
                {topics.map((t) => (
                  <button
                    key={t.slug}
                    style={{ ...s.chip, ...(nueva.topic === t.slug ? s.chipOn : {}) }}
                    onClick={() => setNueva({ ...nueva, topic: t.slug })}
                  >
                    {t.label_es}
                  </button>
                ))}
              </div>

              <div style={s.dateRow}>
                <div style={{ flex: 1 }}>
                  <p style={s.label}>Día</p>
                  <input
                    type="date"
                    style={s.input}
                    value={nueva.fecha}
                    onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={s.label}>Hora</p>
                  <input
                    type="time"
                    style={s.input}
                    value={nueva.hora}
                    onChange={(e) => setNueva({ ...nueva, hora: e.target.value })}
                  />
                </div>
              </div>

              <p style={s.label}>Duración</p>
              <div style={s.chips}>
                {DURACIONES.map((d) => (
                  <button
                    key={d.value}
                    style={{ ...s.chip, ...(nueva.duration_minutes === d.value ? s.chipOn : {}) }}
                    onClick={() => setNueva({ ...nueva, duration_minutes: d.value })}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <input
                style={{ ...s.input, marginTop: 14 }}
                placeholder="Tarea de la sesión (opcional)"
                maxLength={80}
                value={nueva.title}
                onChange={(e) => setNueva({ ...nueva, title: e.target.value })}
              />

              <button
                style={{ ...s.btn, width: "100%", marginTop: 14, opacity: completo ? 1 : 0.45 }}
                disabled={!completo}
                onClick={crear}
              >
                Enviar invitación
              </button>
            </>
          )}
        </section>
      )}

      {invitaciones.length > 0 && (
        <section style={s.card}>
          <h2 style={s.cardTitle}>Invitaciones por responder</h2>
          {invitaciones.map((c) => (
            <div key={c.id} style={s.apptRow}>
              <div style={s.apptInfo}>
                <span style={s.name}>
                  {c.other_party?.alias || c.other_party?.username}
                </span>
                <span style={s.muted}>
                  {formatear(c.scheduled_for)} · {c.duration_minutes} min
                  {c.title && ` · ${c.title}`}
                </span>
              </div>
              <div style={s.apptActions}>
                <button
                  style={s.btnSmall}
                  onClick={() => accion(() => appointmentsApi.accept(token!, c.id))}
                >
                  Aceptar
                </button>
                <button
                  style={s.btnSmallGhost}
                  onClick={() => accion(() => appointmentsApi.decline(token!, c.id))}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section style={s.card}>
        <h2 style={s.cardTitle}>Próximas sesiones</h2>

        {loading ? (
          <p style={s.muted}>Cargando…</p>
        ) : (agenda?.appointments.length ?? 0) === 0 ? (
          <p style={s.empty}>
            No tienes sesiones agendadas. Acordar una hora con alguien ayuda a
            que la sesión ocurra de verdad.
          </p>
        ) : (
          agenda!.appointments.map((c) => (
            <div key={c.id} style={s.apptRow}>
              <div style={s.apptInfo}>
                <span style={s.name}>
                  {c.is_group
                    ? `Grupo: ${c.group?.name}`
                    : c.other_party?.alias || c.other_party?.username}
                </span>
                <span style={s.muted}>
                  {formatear(c.scheduled_for)} · {c.duration_minutes} min
                  {c.title && ` · ${c.title}`}
                </span>
              </div>
              <span style={{
                ...s.estado,
                color: c.status === "confirmed" ? "#7fa05a" : "#c4a05a",
              }}>
                {c.status === "confirmed" ? "confirmada" : "pendiente"}
              </span>
              <div style={s.apptActions}>
                {c.status === "confirmed" && !c.is_group && (
                  <button style={s.btnSmall} onClick={() => unirse(c.id)}>
                    Unirse
                  </button>
                )}
                <button
                  style={s.btnSmallGhost}
                  onClick={() => accion(() => appointmentsApi.cancel(token!, c.id))}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0, marginRight: "auto" },
  quota:  { color: "#c4b99a", fontSize: 13 },
  card:      { background: "#221e1a", borderRadius: 12, padding: 20, marginBottom: 16, maxWidth: 640 },
  cardTitle: { fontSize: 16, margin: "0 0 14px" },
  label:  { color: "#c4b99a", fontSize: 13, margin: "14px 0 8px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#f5f0e8", fontSize: 14,
  },
  dateRow: { display: "flex", gap: 12 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "7px 13px", borderRadius: 18, fontSize: 12,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#c4b99a", cursor: "pointer",
  },
  chipOn: { borderColor: "#7fa05a", background: "#2a3524", color: "#f5f0e8" },
  apptRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 0", borderBottom: "1px solid #2f2a24", flexWrap: "wrap",
  },
  apptInfo:    { display: "flex", flexDirection: "column", flex: 1, gap: 3, minWidth: 180 },
  apptActions: { display: "flex", gap: 8 },
  name:   { fontWeight: 600, fontSize: 14 },
  muted:  { color: "#8b8378", fontSize: 12, lineHeight: 1.6 },
  estado: { fontSize: 11, fontWeight: 600 },
  empty:  { color: "#8b8378", fontSize: 13, lineHeight: 1.7, margin: 0 },
  btn: {
    padding: "10px 18px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 14,
  },
  btnSmall: {
    padding: "6px 12px", borderRadius: 6, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 12,
  },
  btnSmallGhost: {
    padding: "6px 12px", borderRadius: 6, border: "1px solid #3a332b",
    background: "none", color: "#8b8378", cursor: "pointer", fontSize: 12,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 640,
  },
};
