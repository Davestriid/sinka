"use client";

/**
 * Campana de notificaciones.
 *
 * Reune en un solo lugar todo lo que necesita tu atencion:
 *
 *   - solicitudes de amistad que te llegaron, con aceptar y rechazar
 *   - amistades que aceptaron tu solicitud
 *   - invitaciones a citas, con aceptar y rechazar
 *   - citas confirmadas que empiezan dentro de la proxima hora
 *
 * Se revisa cada treinta segundos. No hace falta tiempo real para esto: nada
 * de lo que aparece aqui es urgente al segundo, y abrir una conexion
 * permanente por cada persona conectada seria gastar servidor sin ganar nada.
 *
 * Lo que ya viste se recuerda en el navegador, asi el globo rojo solo cuenta
 * lo que es nuevo para vos.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import {
  appointmentsApi,
  friendsApi,
  type Appointment,
  type Friend,
  type FriendRequest,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const INTERVALO_MS = 30_000;
const CLAVE_VISTAS = "sinka-notificaciones-vistas";
const VENTANA_PROXIMA_MS = 60 * 60 * 1000;   // una hora

type Clase = "amistad" | "amistad-ok" | "cita" | "cita-pronto";

interface Aviso {
  id:      string;
  clase:   Clase;
  icono:   string;
  titulo:  string;
  detalle: string;
  cuando:  number;
  /** Accion afirmativa, si la hay */
  aceptar?: () => Promise<unknown>;
  /** Accion negativa, si la hay */
  rechazar?: () => Promise<unknown>;
  /** A donde lleva al tocarlo, si no tiene botones */
  ir?: string;
}

function leerVistas(): Set<string> {
  try {
    const crudo = localStorage.getItem(CLAVE_VISTAS);
    return new Set<string>(crudo ? (JSON.parse(crudo) as string[]) : []);
  } catch {
    return new Set();
  }
}

function guardarVistas(ids: Set<string>) {
  try {
    // Se recortan para que la lista no crezca sin limite
    localStorage.setItem(CLAVE_VISTAS, JSON.stringify(Array.from(ids).slice(-200)));
  } catch {
    // Modo privado o almacenamiento lleno. No es grave: solo se vuelve a contar.
  }
}

/** "en 25 minutos", "hace 2 horas", "el 4 de octubre" */
function cuandoTexto(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  const dif = t - Date.now();
  const abs = Math.abs(dif);
  const min = Math.round(abs / 60000);

  if (min < 1)   return dif >= 0 ? "en un momento" : "recién";
  if (min < 60)  return dif >= 0 ? `en ${min} min` : `hace ${min} min`;

  const horas = Math.round(min / 60);
  if (horas < 24) return dif >= 0 ? `en ${horas} h` : `hace ${horas} h`;

  return new Date(t).toLocaleDateString("es", { day: "numeric", month: "long" });
}

export function Notificaciones() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [solicitudes,  setSolicitudes]  = useState<FriendRequest[]>([]);
  const [amigos,       setAmigos]       = useState<Friend[]>([]);
  const [invitaciones, setInvitaciones] = useState<Appointment[]>([]);
  const [proximas,     setProximas]     = useState<Appointment[]>([]);

  const [abierto, setAbierto] = useState(false);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [aviso,   setAviso]   = useState<string | null>(null);
  const [vistas,  setVistas]  = useState<Set<string>>(new Set());

  const cajaRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVistas(leerVistas()); }, []);

  const cargar = useCallback(async () => {
    if (!token) return;
    // Cada fuente se pide por separado: si una falla, las demas igual se ven
    const [pedidos, lista, invit, agenda] = await Promise.allSettled([
      friendsApi.requests(token),
      friendsApi.list(token),
      appointmentsApi.invitations(token),
      appointmentsApi.agenda(token),
    ]);

    if (pedidos.status === "fulfilled") setSolicitudes(pedidos.value.incoming);
    if (lista.status   === "fulfilled") setAmigos(lista.value);
    if (invit.status   === "fulfilled") setInvitaciones(invit.value);
    if (agenda.status  === "fulfilled") {
      const limite = Date.now() + VENTANA_PROXIMA_MS;
      setProximas(
        agenda.value.appointments.filter(c => {
          const t = new Date(c.scheduled_for).getTime();
          return c.status === "confirmed" && t > Date.now() && t <= limite;
        }),
      );
    }
  }, [token]);

  useEffect(() => {
    if (!hidratado || !token) return;
    void cargar();
    const id = setInterval(() => { void cargar(); }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [hidratado, token, cargar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const responder = async (
    id:     string,
    fn:     () => Promise<unknown>,
    exito:  string,
  ) => {
    if (ocupada) return;
    setOcupada(id);
    try {
      await fn();
      setAviso(exito);
      await cargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setOcupada(null);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  // ── Armar la lista unica, ordenada de lo mas reciente a lo mas viejo ──────
  const avisos = useMemo<Aviso[]>(() => {
    if (!token) return [];
    const lista: Aviso[] = [];

    for (const s of solicitudes) {
      const nombre = s.user.alias || s.user.username;
      lista.push({
        id:      `amistad:${s.friendship_id}`,
        clase:   "amistad",
        icono:   "👋",
        titulo:  nombre,
        detalle: `quiere ser tu amigo · ${cuandoTexto(s.created_at)}`,
        cuando:  s.created_at ? new Date(s.created_at).getTime() : Date.now(),
        aceptar:  () => friendsApi.accept(token, s.friendship_id),
        rechazar: () => friendsApi.reject(token, s.friendship_id),
      });
    }

    // Amistades nuevas: las que se sellaron en las ultimas 48 horas
    const limiteAmistad = Date.now() - 48 * 60 * 60 * 1000;
    for (const a of amigos) {
      if (!a.since) continue;
      const t = new Date(a.since).getTime();
      if (t < limiteAmistad) continue;
      lista.push({
        id:      `amigo:${a.friendship_id}`,
        clase:   "amistad-ok",
        icono:   "🤝",
        titulo:  a.user.alias || a.user.username,
        detalle: `ahora son amigos · ${cuandoTexto(a.since)}`,
        cuando:  t,
        ir:      "/vinculos",
      });
    }

    for (const c of invitaciones) {
      const quien = c.creator?.alias || c.creator?.username || "Alguien";
      lista.push({
        id:      `cita:${c.id}`,
        clase:   "cita",
        icono:   "📅",
        titulo:  quien,
        detalle: `te invitó a una sesión ${cuandoTexto(c.scheduled_for)}`,
        cuando:  c.created_at ? new Date(c.created_at).getTime() : Date.now(),
        aceptar:  () => appointmentsApi.accept(token, c.id),
        rechazar: () => appointmentsApi.decline(token, c.id),
      });
    }

    for (const c of proximas) {
      const quien = c.other_party?.alias || c.other_party?.username || c.group?.name || "tu pareja";
      lista.push({
        id:      `pronto:${c.id}`,
        clase:   "cita-pronto",
        icono:   "⏰",
        titulo:  c.title || "Sesión agendada",
        detalle: `con ${quien} · empieza ${cuandoTexto(c.scheduled_for)}`,
        cuando:  new Date(c.scheduled_for).getTime(),
        ir:      "/citas",
      });
    }

    return lista.sort((a, b) => b.cuando - a.cuando);
  }, [token, solicitudes, amigos, invitaciones, proximas]);

  const sinVer = avisos.filter(a => !vistas.has(a.id)).length;

  const alternar = () => {
    const abriendo = !abierto;
    setAbierto(abriendo);
    if (abriendo && avisos.length) {
      const nuevas = new Set(Array.from(vistas).concat(avisos.map(a => a.id)));
      setVistas(nuevas);
      guardarVistas(nuevas);
    }
  };

  if (!token) return null;

  return (
    <div style={s.contenedor} ref={cajaRef}>
      <button
        style={s.campana}
        onClick={alternar}
        title={sinVer ? `${sinVer} novedad${sinVer > 1 ? "es" : ""}` : "Notificaciones"}
        aria-label="Notificaciones"
      >
        🔔
        {sinVer > 0 && <span style={s.globo}>{sinVer > 9 ? "9+" : sinVer}</span>}
      </button>

      {abierto && (
        <div style={s.panel}>
          <div style={s.tituloPanel}>Notificaciones</div>

          {avisos.length === 0 && (
            <p style={s.vacio}>No tienes nada pendiente.</p>
          )}

          {avisos.map(a => (
            <div
              key={a.id}
              style={{ ...s.fila, cursor: a.ir ? "pointer" : "default" }}
              onClick={() => { if (a.ir) { setAbierto(false); router.push(a.ir); } }}
            >
              <div style={s.avatar}>{a.icono}</div>

              <div style={s.texto}>
                <strong style={s.nombre}>{a.titulo}</strong>
                <span style={s.detalle}>{a.detalle}</span>
              </div>

              {(a.aceptar || a.rechazar) && (
                <div style={s.acciones}>
                  {a.aceptar && (
                    <button
                      style={{ ...s.btn, ...s.btnAceptar }}
                      disabled={ocupada === a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void responder(a.id, a.aceptar!, "Listo");
                      }}
                    >
                      Aceptar
                    </button>
                  )}
                  {a.rechazar && (
                    <button
                      style={{ ...s.btn, ...s.btnRechazar }}
                      disabled={ocupada === a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void responder(a.id, a.rechazar!, "Rechazado");
                      }}
                    >
                      Rechazar
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {aviso && <div style={s.toast}>{aviso}</div>}
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  contenedor: { position: "relative", display: "inline-flex" },
  campana: {
    position:     "relative",
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid transparent",
    borderRadius: 8,
    padding:      "7px 11px",
    cursor:       "pointer",
    fontSize:     16,
    lineHeight:   1,
  },
  globo: {
    position:     "absolute",
    top:          1,
    right:        1,
    minWidth:     17,
    height:       17,
    padding:      "0 4px",
    borderRadius: 999,
    background:   "#dc2626",
    color:        "#fff",
    fontSize:     10,
    fontWeight:   700,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
  },
  panel: {
    position:     "absolute",
    top:          "calc(100% + 8px)",
    right:        0,
    width:        340,
    maxWidth:     "90vw",
    maxHeight:    420,
    overflowY:    "auto",
    background:   "#211d19",
    border:       "1px solid #3a3028",
    borderRadius: 12,
    boxShadow:    "0 10px 30px rgba(0,0,0,0.45)",
    padding:      10,
    zIndex:       100,
  },
  tituloPanel: {
    fontSize:      12,
    fontWeight:    700,
    color:         "#a0998b",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding:       "2px 4px 8px",
  },
  vacio: { color: "#6b6358", fontSize: 13, textAlign: "center", padding: "18px 8px", margin: 0 },
  fila: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    padding:    "9px 6px",
    borderTop:  "1px solid #2a2420",
    flexWrap:   "wrap",
  },
  avatar: {
    width:        34,
    height:       34,
    borderRadius: "50%",
    background:   "#2a2420",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:     16,
    flexShrink:   0,
  },
  texto:   { display: "flex", flexDirection: "column", fontSize: 13, minWidth: 0, flex: 1 },
  nombre:  { color: "#f5f0e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  detalle: { color: "#a0998b", fontSize: 12 },
  acciones: { display: "flex", gap: 6 },
  btn: {
    border:       "1px solid #3a3028",
    borderRadius: 7,
    padding:      "5px 11px",
    fontSize:     12,
    cursor:       "pointer",
    fontWeight:   600,
  },
  btnAceptar:  { background: "#166534", color: "#f0fdf4", borderColor: "#15803d" },
  btnRechazar: { background: "transparent", color: "#a0998b" },
  toast: {
    position:     "absolute",
    top:          "calc(100% + 8px)",
    right:        0,
    whiteSpace:   "nowrap",
    background:   "#2a2420",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "8px 14px",
    fontSize:     12,
    color:        "#f5f0e8",
    zIndex:       101,
  },
};

export default Notificaciones;
