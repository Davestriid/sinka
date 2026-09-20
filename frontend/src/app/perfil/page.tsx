"use client";

/**
 * Perfil y ajustes.
 *
 * Datos personales, idioma, tema y el puntaje de confianza con su explicacion.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { profileApi, trustApi, type TrustState } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const AVATARES = ["🌱", "🌿", "🍃", "🌸", "🌻", "🌙", "⭐", "🔥", "💧", "🗻"];

export default function PerfilPage() {
  const router = useRouter();
  const { accessToken: token, user, setUser, logout } = useAuthStore();

  const [alias,  setAlias]  = useState("");
  const [bio,    setBio]    = useState("");
  const [avatar, setAvatar] = useState("");
  const [idioma, setIdioma] = useState<"es" | "en">("es");
  const [tema,   setTema]   = useState<"light" | "dark">("dark");

  const [trust,   setTrust]   = useState<TrustState | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    if (user) {
      setAlias(user.alias ?? user.username);
      setBio(user.bio ?? "");
      setAvatar(user.avatar_url ?? AVATARES[0]);
      setIdioma(user.language);
      setTema(user.theme);
    }
    trustApi.me(token).then(setTrust).catch(() => setTrust(null));
  }, [token, user, router]);

  const guardar = useCallback(async () => {
    if (!token) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const actualizado = await profileApi.update(token, {
        alias: alias.trim(),
        bio: bio.trim(),
        avatar_url: avatar,
        language: idioma,
        theme: tema,
      });
      setUser(actualizado);
      setMensaje("Cambios guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }, [token, alias, bio, avatar, idioma, tema, setUser]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Perfil</h1>
      </header>

      {error   && <div style={s.error}>{error}</div>}
      {mensaje && <div style={s.ok}>{mensaje}</div>}

      <section style={s.card}>
        <h2 style={s.cardTitle}>Cómo te ven los demás</h2>

        <p style={s.label}>Tu símbolo</p>
        <div style={s.avatarGrid}>
          {AVATARES.map((a) => (
            <button
              key={a}
              style={{ ...s.avatarBtn, ...(avatar === a ? s.avatarOn : {}) }}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>

        <p style={s.label}>Nombre visible</p>
        <input
          style={s.input}
          value={alias}
          maxLength={50}
          onChange={(e) => setAlias(e.target.value)}
        />

        <p style={s.label}>Sobre ti</p>
        <textarea
          style={{ ...s.input, minHeight: 70, resize: "vertical" }}
          value={bio}
          maxLength={280}
          placeholder="Una línea sobre en qué trabajas"
          onChange={(e) => setBio(e.target.value)}
        />
        <span style={s.muted}>{bio.length}/280</span>
      </section>

      <section style={s.card}>
        <h2 style={s.cardTitle}>Preferencias</h2>

        <p style={s.label}>Idioma</p>
        <div style={s.chips}>
          <button
            style={{ ...s.chip, ...(idioma === "es" ? s.chipOn : {}) }}
            onClick={() => setIdioma("es")}
          >
            Español
          </button>
          <button
            style={{ ...s.chip, ...(idioma === "en" ? s.chipOn : {}) }}
            onClick={() => setIdioma("en")}
          >
            English
          </button>
        </div>

        <p style={s.label}>Tema</p>
        <div style={s.chips}>
          <button
            style={{ ...s.chip, ...(tema === "dark" ? s.chipOn : {}) }}
            onClick={() => setTema("dark")}
          >
            Oscuro
          </button>
          <button
            style={{ ...s.chip, ...(tema === "light" ? s.chipOn : {}) }}
            onClick={() => setTema("light")}
          >
            Claro
          </button>
        </div>
      </section>

      {trust && (
        <section style={s.card}>
          <h2 style={s.cardTitle}>Confianza</h2>

          <div style={s.trustRow}>
            <span style={s.trustScore}>{trust.score}</span>
            <span style={s.muted}>de {trust.max_score} · {trust.level}</span>
          </div>

          <div style={s.barTrack}>
            <div style={{
              ...s.barFill,
              width: `${trust.score}%`,
              background: trust.low_priority ? "#c48a5a" : "#7fa05a",
            }} />
          </div>

          {trust.should_warn ? (
            <p style={s.aviso}>
              Tu puntaje bajó porque saliste de {trust.sessions_abandoned}{" "}
              {trust.sessions_abandoned === 1 ? "sesión" : "sesiones"} antes de
              terminar. Completar sesiones lo recupera poco a poco.
              {trust.low_priority && " Mientras esté bajo, la espera para encontrar compañero será más larga."}
            </p>
          ) : (
            <p style={s.muted}>
              Terminas las sesiones a las que te comprometes. Eso te da
              prioridad al buscar compañero.
            </p>
          )}
        </section>
      )}

      <div style={s.actions}>
        <button
          style={{ ...s.btn, opacity: guardando ? 0.6 : 1 }}
          disabled={guardando}
          onClick={guardar}
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          style={s.btnGhost}
          onClick={() => { logout(); router.push("/login"); }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0 },
  card:      { background: "#221e1a", borderRadius: 12, padding: 20, marginBottom: 16, maxWidth: 520 },
  cardTitle: { fontSize: 16, margin: "0 0 14px" },
  label:  { color: "#c4b99a", fontSize: 13, margin: "14px 0 8px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#f5f0e8", fontSize: 14, fontFamily: "inherit",
  },
  avatarGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  avatarBtn: {
    width: 42, height: 42, fontSize: 20, borderRadius: 10,
    border: "1px solid #3a332b", background: "#1a1714", cursor: "pointer",
  },
  avatarOn: { borderColor: "#7fa05a", background: "#2a3524" },
  chips: { display: "flex", gap: 8 },
  chip: {
    padding: "8px 16px", borderRadius: 18, fontSize: 13,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#c4b99a", cursor: "pointer",
  },
  chipOn: { borderColor: "#7fa05a", background: "#2a3524", color: "#f5f0e8" },
  trustRow:   { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 },
  trustScore: { fontSize: 32, fontWeight: 700 },
  barTrack: {
    width: "100%", height: 8, background: "#2f2a24",
    borderRadius: 4, overflow: "hidden", marginBottom: 12,
  },
  barFill: { height: "100%", borderRadius: 4 },
  aviso:  { color: "#c4a05a", fontSize: 12, lineHeight: 1.7, margin: 0 },
  muted:  { color: "#8b8378", fontSize: 12, lineHeight: 1.7 },
  actions: { display: "flex", gap: 10, maxWidth: 520 },
  btn: {
    flex: 1, padding: "12px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer",
    fontSize: 14, fontWeight: 600,
  },
  btnGhost: {
    padding: "12px 18px", borderRadius: 8, border: "1px solid #3a332b",
    background: "none", color: "#8b8378", cursor: "pointer", fontSize: 14,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 520,
  },
  ok: {
    background: "#243a24", color: "#a0d090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 520,
  },
};
