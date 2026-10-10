"use client";

/**
 * Tarjeta de jugador de otra persona — al estilo Clash Royale: avatar
 * grande, nivel, barra de XP, racha, sesiones y los logros que ya
 * desbloqueó. Se abre al tocar la foto de alguien en vínculos, grupos o
 * el ranking.
 *
 * Nunca muestra correo ni el puntaje de confianza (trust_score): ese es
 * un dato interno de emparejamiento, no algo para presumir o comparar.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Target, UserCircle, Users, Flame, Handshake, Sprout, ShoppingBag,
  ArrowLeft, Trophy, Zap, Calendar, type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

import { authApi, type PublicProfileFull } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, shadow, fontSerif, pageBackground } from "@/lib/theme";

const ICONOS: Record<string, ComponentType<LucideProps>> = {
  Target, UserCircle, Users, Flame, Handshake, Sprout, ShoppingBag,
};

export default function PerfilPublicoPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const { accessToken: token, user: propio, hidratado } = useAuthStore();

  const [perfil, setPerfil] = useState<PublicProfileFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    if (!hidratado) return;
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    setError("");
    try {
      setPerfil(await authApi.getPublicFull(token, params.userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar este perfil.");
    } finally {
      setLoading(false);
    }
  }, [token, params.userId, router, hidratado]);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) {
    return <div style={s.page}><p style={s.muted}>Cargando perfil…</p></div>;
  }

  if (error || !perfil) {
    return (
      <div style={s.page}>
        <div style={s.centro}>
          <p style={s.error}>{error || "Ese perfil no existe."}</p>
          <button style={s.back} onClick={() => router.back()}>← Volver</button>
        </div>
      </div>
    );
  }

  const nombre = perfil.alias || perfil.username;
  const esMiPropioPerfil = propio?.id === perfil.id;
  const miembroDesde = new Date(perfil.member_since).toLocaleDateString(undefined, {
    year: "numeric", month: "long",
  });

  return (
    <div style={s.page}>
      <div style={s.centro}>
        <button style={s.backBtn} onClick={() => router.back()}>
          <ArrowLeft size={16} /> Volver
        </button>

        {/* ── Tarjeta principal ─────────────────────────────────────── */}
        <div style={s.card}>
          <div style={s.cardTop}>
            {perfil.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.avatar_url} alt={nombre} style={s.avatar} />
            ) : (
              <div style={s.avatarFallback}>{nombre.charAt(0).toUpperCase()}</div>
            )}
            <div style={s.levelBadge}>Nv. {perfil.level}</div>
          </div>

          <h1 style={s.name}>{nombre}</h1>
          {perfil.bio && <p style={s.bio}>{perfil.bio}</p>}

          <div style={s.xpRow}>
            <div style={s.xpBarTrack}>
              <div style={{ ...s.xpBarFill, width: `${Math.round(perfil.xp_progress_pct * 100)}%` }} />
            </div>
            <span style={s.xpLabel}>
              {perfil.xp_in_level} / {perfil.xp_for_next_level || perfil.xp_in_level} XP
            </span>
          </div>

          <p style={s.memberSince}>
            <Calendar size={13} /> Miembro desde {miembroDesde}
          </p>

          {esMiPropioPerfil && (
            <button style={s.editBtn} onClick={() => router.push("/perfil")}>
              Editar mi perfil
            </button>
          )}
        </div>

        {/* ── Trofeos / estadísticas ────────────────────────────────── */}
        <div style={s.trophyGrid}>
          <Trofeo icono={<Trophy size={20} />} valor={perfil.xp_total} etiqueta="XP total" />
          <Trofeo icono={<Flame size={20} />} valor={perfil.streak_current} etiqueta="Racha actual" />
          <Trofeo icono={<Zap size={20} />} valor={perfil.streak_max} etiqueta="Mejor racha" />
          <Trofeo icono={<Target size={20} />} valor={perfil.sessions_completed} etiqueta="Sesiones" />
        </div>

        {/* ── Logros ────────────────────────────────────────────────── */}
        <div style={s.card}>
          <h2 style={s.sectionTitle}>
            Logros <span style={s.count}>{perfil.achievements_unlocked}/{perfil.achievements_total}</span>
          </h2>
          {perfil.badges.length === 0 ? (
            <p style={s.muted}>Todavía no desbloquea ningún logro.</p>
          ) : (
            <div style={s.badgeGrid}>
              {perfil.badges.map((b) => {
                const Icono = ICONOS[b.icon] ?? Target;
                return (
                  <div key={b.id} style={s.badge} title={b.name_es}>
                    <div style={s.badgeIcon}><Icono size={22} /></div>
                    <span style={s.badgeName}>{b.name_es}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Trofeo({ icono, valor, etiqueta }: { icono: React.ReactNode; valor: number; etiqueta: string }) {
  return (
    <div style={s.trofeo}>
      <div style={s.trofeoIcono}>{icono}</div>
      <div style={s.trofeoValor}>{valor}</div>
      <div style={s.trofeoEtiqueta}>{etiqueta}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: pageBackground, color: color.text, padding: 24 },
  centro: { maxWidth: 560, margin: "0 auto" },
  muted:  { color: color.textFaint, fontSize: 13 },
  error: {
    background: color.accentSoft, color: color.accent, padding: 12,
    borderRadius: radius.sm, marginBottom: 16, fontSize: 13,
  },
  back: {
    background: "none", border: "none", color: color.textMuted,
    cursor: "pointer", fontSize: 14,
  },
  backBtn: {
    display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
    color: color.textMuted, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0,
  },

  card: {
    background: color.surface, borderRadius: radius.lg, padding: 24,
    marginBottom: 16, boxShadow: shadow.card,
  },
  cardTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  avatar:  { width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: `2px solid ${color.accent}` },
  avatarFallback: {
    width: 84, height: 84, borderRadius: "50%", background: color.border,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 32, border: `2px solid ${color.accent}`,
  },
  levelBadge: {
    background: color.accent, color: color.bg, fontWeight: 700, fontSize: 13,
    padding: "6px 14px", borderRadius: radius.pill,
  },
  name: { fontFamily: fontSerif, fontSize: 26, margin: "16px 0 2px" },
  bio:  { color: color.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" },

  xpRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  xpBarTrack: {
    flex: 1, height: 8, borderRadius: radius.pill, background: color.borderSoft, overflow: "hidden",
  },
  xpBarFill: { height: "100%", background: color.moss, borderRadius: radius.pill },
  xpLabel: { fontSize: 12, color: color.textFaint, whiteSpace: "nowrap" },

  memberSince: {
    display: "flex", alignItems: "center", gap: 6, color: color.textFaint,
    fontSize: 12, marginTop: 14,
  },
  editBtn: {
    marginTop: 16, padding: "9px 16px", borderRadius: radius.sm, border: `1px solid ${color.border}`,
    background: "none", color: color.text, cursor: "pointer", fontSize: 13,
  },

  trophyGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16,
  },
  trofeo: {
    background: color.surface, borderRadius: radius.md, padding: "16px 8px",
    textAlign: "center", boxShadow: shadow.card,
  },
  trofeoIcono:   { color: color.accent, display: "flex", justifyContent: "center", marginBottom: 6 },
  trofeoValor:   { fontFamily: fontSerif, fontSize: 20, fontWeight: 700 },
  trofeoEtiqueta: { fontSize: 11, color: color.textFaint, marginTop: 2 },

  sectionTitle: { fontSize: 16, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 },
  count: { background: color.surfaceRaised, borderRadius: radius.sm, padding: "1px 8px", fontSize: 12 },

  badgeGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 12,
  },
  badge: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" },
  badgeIcon: {
    width: 48, height: 48, borderRadius: "50%", background: color.mossSoft, color: color.moss,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  badgeName: { fontSize: 11, color: color.textMuted, lineHeight: 1.3 },
};
