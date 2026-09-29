"use client";

/**
 * Logros: catalogo completo con el progreso del usuario, agrupado por
 * categoria. El backend ya hace el trabajo pesado (progreso + desbloqueo);
 * esta pantalla solo pinta lo que llega de /achievements.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Target, UserCircle, Users, Flame, Handshake, Sprout, ShoppingBag,
  Lock, type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

import { achievementsApi, type Achievement } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, fontSerif } from "@/lib/theme";

const ICONOS: Record<string, ComponentType<LucideProps>> = {
  Target, UserCircle, Users, Flame, Handshake, Sprout, ShoppingBag,
};

const CATEGORIAS: { key: string; label: string }[] = [
  { key: "primeros_pasos", label: "Primeros pasos" },
  { key: "constancia",     label: "Constancia" },
  { key: "vinculos",       label: "Vínculos" },
  { key: "jardin",         label: "Jardín" },
  { key: "tienda",         label: "Tienda" },
  { key: "grupos",         label: "Grupos" },
];

export default function LogrosPage() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [datos,   setDatos]   = useState<Achievement[]>([]);
  const [total,   setTotal]   = useState(0);
  const [unlocked, setUnlocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const cargar = useCallback(async () => {
    if (!token) return;
    try {
      const r = await achievementsApi.getMine(token);
      setDatos(r.achievements);
      setTotal(r.total);
      setUnlocked(r.unlocked);
      setError("");
    } catch {
      setError("No pudimos cargar tus logros.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hidratado) return;
    if (!token) { router.push("/login"); return; }
    cargar();
  }, [token, router, hidratado, cargar]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Logros</h1>
        {!loading && (
          <span style={s.contador}>{unlocked} / {total}</span>
        )}
      </header>

      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <p style={s.muted}>Cargando logros…</p>
      ) : (
        CATEGORIAS.map(({ key, label }) => {
          const items = datos.filter(a => a.category === key);
          if (items.length === 0) return null;
          return (
            <section key={key} style={s.categoria} className="sinka-fade-up">
              <h2 style={s.categoriaTitulo}>{label}</h2>
              <div style={s.grid}>
                {items.map(a => (
                  <TarjetaLogro key={a.id} logro={a} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function TarjetaLogro({ logro }: { logro: Achievement }) {
  const Icono = ICONOS[logro.icon] ?? Target;
  const pct = Math.min(100, Math.round((logro.progress / logro.target) * 100));

  return (
    <div style={{ ...s.card, ...(logro.unlocked ? s.cardOn : {}) }}>
      <div style={{ ...s.iconWrap, ...(logro.unlocked ? s.iconWrapOn : {}) }}>
        {logro.unlocked ? <Icono size={20} strokeWidth={2} /> : <Lock size={16} strokeWidth={2} />}
      </div>

      <div style={s.info}>
        <p style={s.nombre}>{logro.name_es}</p>
        <p style={s.descripcion}>{logro.description_es}</p>

        {logro.target > 1 && !logro.unlocked && (
          <div style={s.barraFondo}>
            <div style={{ ...s.barraLlena, width: `${pct}%` }} />
          </div>
        )}

        <div style={s.pie}>
          {logro.unlocked ? (
            <span style={s.desbloqueado}>Desbloqueado</span>
          ) : (
            <span style={s.progreso}>{logro.progress} / {logro.target}</span>
          )}
          <span style={s.recompensa}>+{logro.reward_fc} 🍃</span>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: color.bg, color: color.text, padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  back:   { background: "none", border: "none", color: color.textMuted, cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0, marginRight: "auto", fontFamily: fontSerif },
  contador: { fontSize: 14, color: color.textMuted, fontFamily: fontSerif },
  muted:  { color: color.textFaint, fontSize: 13 },
  error: {
    background: color.accentSoft, color: color.accent, padding: 12,
    borderRadius: radius.md, marginBottom: 16, fontSize: 13,
  },
  categoria: { marginBottom: 28 },
  categoriaTitulo: {
    fontSize: 15, fontFamily: fontSerif, color: color.sand,
    margin: "0 0 12px", letterSpacing: "0.02em",
  },
  grid: {
    display: "grid", gap: 12,
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  },
  card: {
    display: "flex", gap: 12, padding: 16,
    background: color.surface, border: `1px solid ${color.border}`,
    borderRadius: radius.lg, opacity: 0.7,
  },
  cardOn: {
    opacity: 1, borderColor: color.moss, background: color.mossSoft,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: radius.md, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: color.surfaceRaised, color: color.textFaint,
  },
  iconWrapOn: {
    background: color.moss, color: color.bg,
  },
  info: { flex: 1, minWidth: 0 },
  nombre: { margin: 0, fontWeight: 500, fontSize: 14, fontFamily: fontSerif },
  descripcion: { margin: "4px 0 8px", fontSize: 12, color: color.textMuted, lineHeight: 1.5 },
  barraFondo: {
    height: 5, borderRadius: radius.pill, background: color.borderSoft,
    overflow: "hidden", marginBottom: 8,
  },
  barraLlena: {
    height: "100%", background: color.accent, borderRadius: radius.pill,
    transition: "width 0.3s ease",
  },
  pie: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 },
  desbloqueado: { color: color.moss, fontWeight: 600 },
  progreso: { color: color.textFaint },
  recompensa: { color: color.sand, fontWeight: 600 },
};
