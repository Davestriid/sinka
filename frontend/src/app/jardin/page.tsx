"use client";

/**
 * Jardin de vinculos.
 *
 * Una planta por cada amistad. Se recorre en horizontal con la rueda del
 * raton, igual que se camina por un jardin de verdad.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { gardenApi, type Plant } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function JardinPage() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [plants,  setPlants]  = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    try { setPlants((await gardenApi.list(token)).plants); }
    catch { setPlants([]); }
    finally { setLoading(false); }
  }, [token, router, hidratado]);

  useEffect(() => { cargar(); }, [cargar]);

  // La rueda vertical mueve el jardin en horizontal
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [plants]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Mi jardín</h1>
        <span style={s.count}>{plants.length} plantas</span>
      </header>

      {loading ? (
        <p style={s.muted}>Cargando el jardín…</p>
      ) : plants.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 48 }}>🌱</div>
          <h2 style={{ margin: "12px 0 8px", fontSize: 18 }}>Tu jardín está vacío</h2>
          <p style={s.empty}>
            Cada amistad hace crecer una planta. Agrega a alguien como amigo y
            completen sesiones juntos para verla crecer.
          </p>
          <button style={s.btn} onClick={() => router.push("/vinculos")}>
            Ir a vínculos
          </button>
        </div>
      ) : (
        <div ref={scrollRef} style={s.scroller}>
          {plants.map((p) => (
            <button
              key={p.friendship_id}
              style={s.plantCard}
              onClick={() => router.push(`/jardin/${p.friendship_id}`)}
            >
              <div style={s.plantEmoji}>{p.emoji}</div>
              <span style={s.plantName}>
                {p.name || p.friend.alias || p.friend.username}
              </span>
              <span style={s.phase}>{p.phase_label}</span>

              <div style={s.barTrack}>
                <div style={{ ...s.barFill, width: `${Math.round(p.progress_pct * 100)}%` }} />
              </div>

              <span style={s.muted}>
                {p.sessions_together} sesiones · {p.hours_together} h
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0 },
  count:  { marginLeft: "auto", color: "#8b8378", fontSize: 13 },
  scroller: {
    display: "flex", gap: 16, overflowX: "auto", paddingBottom: 16,
    scrollbarWidth: "thin",
  },
  plantCard: {
    flex: "0 0 200px", background: "#221e1a", border: "1px solid #2f2a24",
    borderRadius: 14, padding: 20, cursor: "pointer", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    color: "#f5f0e8",
  },
  plantEmoji: { fontSize: 52, lineHeight: 1 },
  plantName:  { fontWeight: 700, fontSize: 15 },
  phase:      { color: "#7fa05a", fontSize: 12, fontWeight: 600 },
  barTrack: {
    width: "100%", height: 6, background: "#2f2a24",
    borderRadius: 3, overflow: "hidden", margin: "6px 0",
  },
  barFill: { height: "100%", background: "#7fa05a", borderRadius: 3 },
  muted:   { color: "#8b8378", fontSize: 12 },
  emptyCard: {
    background: "#221e1a", borderRadius: 14, padding: 40,
    textAlign: "center", maxWidth: 420,
  },
  empty: { color: "#8b8378", fontSize: 13, lineHeight: 1.7, margin: "0 0 20px" },
  btn: {
    padding: "10px 20px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 14,
  },
};
