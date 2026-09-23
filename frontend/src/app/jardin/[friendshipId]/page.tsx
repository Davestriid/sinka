"use client";

/**
 * Detalle de una planta del jardin.
 *
 * Muestra el progreso hacia la siguiente fase y el historial compartido con
 * esa persona. Los dos amigos pueden ponerle nombre.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { gardenApi, type Plant } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function PlantaPage() {
  const router = useRouter();
  const params = useParams<{ friendshipId: string }>();
  const { accessToken: token, hidratado } = useAuthStore();

  const [plant,   setPlant]   = useState<Plant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [nombre,  setNombre]  = useState("");

  const cargar = useCallback(async () => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    try {
      const p = await gardenApi.detail(token, params.friendshipId);
      setPlant(p);
      setNombre(p.name ?? "");
    } catch {
      setPlant(null);
    } finally {
      setLoading(false);
    }
  }, [token, params.friendshipId, router, hidratado]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarNombre = async () => {
    if (!token) return;
    try {
      setPlant(await gardenApi.rename(token, params.friendshipId, nombre));
      setEditando(false);
    } catch { /* se conserva el nombre anterior */ }
  };

  if (loading) return <div style={s.page}><p style={s.muted}>Cargando…</p></div>;

  if (!plant) {
    return (
      <div style={s.page}>
        <p style={s.muted}>No encontramos esa planta.</p>
        <button style={s.btn} onClick={() => router.push("/jardin")}>Volver al jardín</button>
      </div>
    );
  }

  const amigo = plant.friend.alias || plant.friend.username;
  const falta = Math.max(0, plant.next_phase_cost - plant.nourishment);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/jardin")}>← Al jardín</button>
      </header>

      <div style={s.card}>
        <div style={s.emoji}>{plant.emoji}</div>

        {editando ? (
          <div style={s.editRow}>
            <input
              style={s.input}
              value={nombre}
              maxLength={60}
              placeholder="Ponle un nombre"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); }}
            />
            <button style={s.btnSmall} onClick={guardarNombre}>Guardar</button>
          </div>
        ) : (
          <h1 style={s.title} onClick={() => setEditando(true)}>
            {plant.name || `Vínculo con ${amigo}`}
            <span style={s.editHint}> ✎</span>
          </h1>
        )}

        <p style={s.phase}>{plant.phase_label}</p>

        {plant.is_max_phase ? (
          <p style={s.maxed}>
            Esta planta llegó a su fase máxima. Siguen sumando horas juntos.
          </p>
        ) : (
          <>
            <div style={s.barTrack}>
              <div style={{ ...s.barFill, width: `${Math.round(plant.progress_pct * 100)}%` }} />
            </div>
            <p style={s.muted}>
              Faltan {Math.round(falta)} de abono para la siguiente fase.
              Cada sesión completada suma, y la primera de cada día rinde más.
            </p>
          </>
        )}

        <div style={s.stats}>
          <Stat valor={String(plant.sessions_together)} etiqueta="sesiones juntos" />
          <Stat valor={`${plant.hours_together} h`}     etiqueta="tiempo compartido" />
          <Stat valor={amigo}                            etiqueta="tu compañero" />
        </div>

        {plant.last_watered_on && (
          <p style={s.muted}>Última sesión: {plant.last_watered_on}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div style={s.stat}>
      <span style={s.statValue}>{valor}</span>
      <span style={s.muted}>{etiqueta}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { marginBottom: 24 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  card: {
    background: "#221e1a", borderRadius: 16, padding: 32,
    maxWidth: 520, margin: "0 auto", textAlign: "center",
  },
  emoji:  { fontSize: 72, lineHeight: 1 },
  title:  { fontSize: 22, margin: "12px 0 4px", cursor: "pointer" },
  editHint: { color: "#5f574c", fontSize: 15 },
  editRow: { display: "flex", gap: 8, margin: "12px 0" },
  input: {
    flex: 1, padding: "8px 12px", borderRadius: 8,
    border: "1px solid #3a332b", background: "#1a1714", color: "#f5f0e8", fontSize: 14,
  },
  phase:  { color: "#7fa05a", fontWeight: 600, margin: "0 0 16px" },
  barTrack: {
    width: "100%", height: 10, background: "#2f2a24",
    borderRadius: 5, overflow: "hidden", marginBottom: 8,
  },
  barFill: { height: "100%", background: "#7fa05a", borderRadius: 5 },
  maxed: { color: "#c4a05a", fontSize: 13, lineHeight: 1.6 },
  muted: { color: "#8b8378", fontSize: 12, lineHeight: 1.6 },
  stats: {
    display: "flex", justifyContent: "space-around",
    gap: 12, margin: "24px 0 12px",
  },
  stat:      { display: "flex", flexDirection: "column", gap: 2 },
  statValue: { fontSize: 18, fontWeight: 700 },
  btn: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 14,
  },
  btnSmall: {
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 13,
  },
};
