"use client";

/**
 * Campana de notificaciones.
 *
 * Por ahora muestra las solicitudes de amistad que te llegaron, con sus
 * botones de aceptar y rechazar. Antes solo se veian entrando a /vinculos, asi
 * que una solicitud podia quedar semanas sin respuesta porque nadie se
 * enteraba de que existia.
 *
 * Se revisa cada treinta segundos. No hace falta tiempo real para esto: una
 * solicitud de amistad no es urgente, y un WebSocket mas seria un gasto que no
 * se justifica.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { friendsApi, type FriendRequest } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const INTERVALO_MS = 30_000;

export function Notificaciones() {
  const { accessToken: token } = useAuthStore();

  const [solicitudes, setSolicitudes] = useState<FriendRequest[]>([]);
  const [abierto,     setAbierto]     = useState(false);
  const [ocupada,     setOcupada]     = useState<string | null>(null);
  const [aviso,       setAviso]       = useState<string | null>(null);

  const cajaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const datos = await friendsApi.requests(token);
      setSolicitudes(datos.incoming);
    } catch {
      // Un fallo puntual no debe romper la barra. Se reintenta al siguiente giro.
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void cargar();
    const id = setInterval(() => { void cargar(); }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [token, cargar]);

  // Cerrar al tocar fuera del panel
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const responder = async (id: string, aceptar: boolean, nombre: string) => {
    if (!token || ocupada) return;
    setOcupada(id);
    // Se quita de la lista al instante; si falla, se vuelve a cargar
    setSolicitudes(prev => prev.filter(s => s.friendship_id !== id));
    try {
      if (aceptar) await friendsApi.accept(token, id);
      else         await friendsApi.reject(token, id);
      setAviso(aceptar ? `Ahora eres amigo de ${nombre}` : `Solicitud rechazada`);
      setTimeout(() => setAviso(null), 4000);
    } catch {
      setAviso("No se pudo completar. Intenta de nuevo.");
      setTimeout(() => setAviso(null), 4000);
      void cargar();
    } finally {
      setOcupada(null);
    }
  };

  if (!token) return null;

  const cuantas = solicitudes.length;

  return (
    <div style={s.contenedor} ref={cajaRef}>
      <button
        style={s.campana}
        onClick={() => setAbierto(v => !v)}
        title={cuantas ? `${cuantas} solicitud${cuantas > 1 ? "es" : ""} de amistad` : "Sin notificaciones"}
        aria-label="Notificaciones"
      >
        🔔
        {cuantas > 0 && <span style={s.globo}>{cuantas > 9 ? "9+" : cuantas}</span>}
      </button>

      {abierto && (
        <div style={s.panel}>
          <div style={s.tituloPanel}>Notificaciones</div>

          {cuantas === 0 && (
            <p style={s.vacio}>No tienes solicitudes pendientes.</p>
          )}

          {solicitudes.map(sol => {
            const nombre = sol.user.alias || sol.user.username;
            return (
              <div key={sol.friendship_id} style={s.fila}>
                <div style={s.avatar}>
                  {nombre.slice(0, 2).toUpperCase()}
                </div>
                <div style={s.texto}>
                  <strong style={{ color: "#f5f0e8" }}>{nombre}</strong>
                  <span style={s.detalle}>quiere ser tu amigo</span>
                </div>
                <div style={s.acciones}>
                  <button
                    style={{ ...s.btn, ...s.btnAceptar }}
                    disabled={ocupada === sol.friendship_id}
                    onClick={() => void responder(sol.friendship_id, true, nombre)}
                  >
                    Aceptar
                  </button>
                  <button
                    style={{ ...s.btn, ...s.btnRechazar }}
                    disabled={ocupada === sol.friendship_id}
                    onClick={() => void responder(sol.friendship_id, false, nombre)}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aviso && <div style={s.aviso}>{aviso}</div>}
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
    width:        320,
    maxHeight:    400,
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
  vacio: { color: "#6b6358", fontSize: 13, textAlign: "center", padding: "16px 8px", margin: 0 },
  fila: {
    display:      "flex",
    alignItems:   "center",
    gap:          10,
    padding:      "9px 6px",
    borderTop:    "1px solid #2a2420",
    flexWrap:     "wrap",
  },
  avatar: {
    width:        34,
    height:       34,
    borderRadius: "50%",
    background:   "#2a2420",
    color:        "#f5f0e8",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:     12,
    fontWeight:   700,
    flexShrink:   0,
  },
  texto: { display: "flex", flexDirection: "column", fontSize: 13, minWidth: 0, flex: 1 },
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
  aviso: {
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
