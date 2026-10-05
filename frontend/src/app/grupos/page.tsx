"use client";

/**
 * Grupos: explorar los publicos, ver los propios, crear uno nuevo y entrar
 * por codigo de invitacion.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { catalogApi, groupsApi, type Group, type Topic } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, fontSerif, pageBackground } from "@/lib/theme";

type Pestana = "explorar" | "mios";

export default function GruposPage() {
  const router = useRouter();
  const { accessToken: token, hidratado } = useAuthStore();

  const [pestana, setPestana] = useState<Pestana>("mios");
  const [explorar, setExplorar] = useState<Group[]>([]);
  const [mios,     setMios]     = useState<Group[]>([]);
  const [topics,   setTopics]   = useState<Topic[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [codigo, setCodigo] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState({
    name: "", topic: "", visibility: "public" as "public" | "private", default_task: "",
  });

  const cargar = useCallback(async () => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    try {
      const [e, m] = await Promise.all([groupsApi.explore(token), groupsApi.mine(token)]);
      setExplorar(e);
      setMios(m);
      setError("");
    } catch {
      setError("No pudimos cargar los grupos.");
    } finally {
      setLoading(false);
    }
  }, [token, router, hidratado]);

  useEffect(() => {
    cargar();
    catalogApi.topics().then((r) => setTopics(r.topics)).catch(() => setTopics([]));
  }, [cargar]);

  // Si llegaron desde un link de invitación (?codigo=XXXX), prellenamos el
  // campo de "entrar por código" para que solo tengan que tocar "Entrar".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const desdeLink = params.get("codigo");
    if (desdeLink) setCodigo(desdeLink.toUpperCase());
  }, []);

  const accion = async (fn: () => Promise<unknown>) => {
    try { await fn(); await cargar(); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal."); }
  };

  const copiar = async (texto: string, etiqueta: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etiqueta);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setError("No pudimos copiar al portapapeles.");
    }
  };

  const crear = async () => {
    if (!token || !nuevo.name.trim() || !nuevo.topic) return;
    await accion(() => groupsApi.create(token, {
      name: nuevo.name.trim(),
      topic: nuevo.topic,
      visibility: nuevo.visibility,
      default_task: nuevo.default_task.trim() || undefined,
    }));
    setCreando(false);
    setNuevo({ name: "", topic: "", visibility: "public", default_task: "" });
  };

  const lista = pestana === "explorar" ? explorar : mios;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Grupos</h1>
        <button style={s.btn} onClick={() => setCreando(!creando)}>
          {creando ? "Cancelar" : "+ Crear grupo"}
        </button>
      </header>

      {error && <div style={s.error}>{error}</div>}

      {creando && (
        <section style={s.card}>
          <h2 style={s.cardTitle}>Nuevo grupo</h2>

          <input
            style={s.input}
            placeholder="Nombre del grupo"
            maxLength={60}
            value={nuevo.name}
            onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
          />

          <p style={s.label}>Área del grupo</p>
          <div style={s.chips}>
            {topics.map((t) => (
              <button
                key={t.slug}
                style={{ ...s.chip, ...(nuevo.topic === t.slug ? s.chipOn : {}) }}
                onClick={() => setNuevo({ ...nuevo, topic: t.slug })}
              >
                {t.label_es}
              </button>
            ))}
          </div>

          <p style={s.label}>Visibilidad</p>
          <div style={s.chips}>
            <button
              style={{ ...s.chip, ...(nuevo.visibility === "public" ? s.chipOn : {}) }}
              onClick={() => setNuevo({ ...nuevo, visibility: "public" })}
            >
              Público
            </button>
            <button
              style={{ ...s.chip, ...(nuevo.visibility === "private" ? s.chipOn : {}) }}
              onClick={() => setNuevo({ ...nuevo, visibility: "private" })}
            >
              Privado (por código)
            </button>
          </div>

          {nuevo.visibility === "public" && (
            <p style={s.aviso}>
              En los grupos públicos entra gente que no conoces, por eso
              compartir pantalla será obligatorio durante la sesión.
            </p>
          )}

          <input
            style={s.input}
            placeholder="Tarea del grupo (opcional)"
            maxLength={80}
            value={nuevo.default_task}
            onChange={(e) => setNuevo({ ...nuevo, default_task: e.target.value })}
          />

          <button
            style={{ ...s.btn, width: "100%", marginTop: 14, opacity: nuevo.name.trim() && nuevo.topic ? 1 : 0.45 }}
            disabled={!nuevo.name.trim() || !nuevo.topic}
            onClick={crear}
          >
            Crear grupo
          </button>
        </section>
      )}

      <section style={s.card}>
        <div style={s.joinRow}>
          <input
            style={{ ...s.input, marginBottom: 0 }}
            placeholder="¿Tienes un código de invitación?"
            value={codigo}
            maxLength={12}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          />
          <button
            style={{ ...s.btn, opacity: codigo.trim() ? 1 : 0.45 }}
            disabled={!codigo.trim()}
            onClick={() => accion(async () => {
              await groupsApi.joinByCode(token!, codigo.trim());
              setCodigo("");
            })}
          >
            Entrar
          </button>
        </div>
      </section>

      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(pestana === "mios" ? s.tabOn : {}) }}
          onClick={() => setPestana("mios")}
        >
          Mis grupos ({mios.length})
        </button>
        <button
          style={{ ...s.tab, ...(pestana === "explorar" ? s.tabOn : {}) }}
          onClick={() => setPestana("explorar")}
        >
          Explorar ({explorar.length})
        </button>
      </div>

      {loading ? (
        <p style={s.muted}>Cargando grupos…</p>
      ) : lista.length === 0 ? (
        <p style={s.empty}>
          {pestana === "mios"
            ? "Todavía no perteneces a ningún grupo. Explora los públicos o crea el tuyo."
            : "No hay grupos públicos con cupo por ahora. Anímate a crear uno."}
        </p>
      ) : (
        <div style={s.grid}>
          {lista.map((g) => (
            <div key={g.id} style={s.groupCard}>
              <div style={s.groupHead}>
                <span style={s.groupName}>{g.name}</span>
                {g.visibility === "private" && <span style={s.tag}>privado</span>}
              </div>

              {g.description && <p style={s.muted}>{g.description}</p>}

              <p style={s.muted}>
                {g.member_count}/{g.max_members} integrantes
                {g.requires_screen_share && " · pantalla obligatoria"}
              </p>

              {g.invite_code && (
                <>
                  <p style={s.code}>Código: <strong>{g.invite_code}</strong></p>
                  <div style={s.inviteRow}>
                    <button
                      style={s.btnGhost}
                      onClick={() => copiar(g.invite_code!, `codigo-${g.id}`)}
                    >
                      {copiado === `codigo-${g.id}` ? "¡Copiado!" : "Copiar código"}
                    </button>
                    <button
                      style={s.btnGhost}
                      onClick={() => copiar(
                        `${window.location.origin}/grupos?codigo=${g.invite_code}`,
                        `link-${g.id}`,
                      )}
                    >
                      {copiado === `link-${g.id}` ? "¡Copiado!" : "Copiar link de invitación"}
                    </button>
                  </div>
                </>
              )}

              <div style={s.groupActions}>
                {g.is_member ? (
                  <button
                    style={s.btnSmall}
                    onClick={() => router.push(`/grupos/${g.id}`)}
                  >
                    Entrar a la sala
                  </button>
                ) : (
                  <button
                    style={{ ...s.btnSmall, opacity: g.is_full ? 0.45 : 1 }}
                    disabled={g.is_full}
                    onClick={() => accion(() => groupsApi.joinPublic(token!, g.id))}
                  >
                    {g.is_full ? "Lleno" : "Unirme"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: pageBackground, color: color.text, padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  back:   { background: "none", border: "none", color: color.textMuted, cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0, marginRight: "auto", fontFamily: fontSerif },
  card:      { background: color.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16, border: `1px solid ${color.border}` },
  cardTitle: { fontSize: 16, margin: "0 0 14px", fontFamily: fontSerif },
  label:  { color: color.textMuted, fontSize: 13, margin: "14px 0 8px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: radius.md, marginBottom: 10,
    border: `1px solid ${color.border}`, background: color.bg, color: color.text, fontSize: 14,
  },
  joinRow: { display: "flex", gap: 10 },
  chips:  { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "7px 13px", borderRadius: radius.pill, fontSize: 12,
    border: `1px solid ${color.border}`, background: color.bg,
    color: color.textMuted, cursor: "pointer",
  },
  chipOn: { borderColor: color.moss, background: color.mossSoft, color: color.text },
  aviso: {
    color: color.sand, fontSize: 12, lineHeight: 1.6,
    background: color.accentSoft, padding: 10, borderRadius: radius.md, margin: "12px 0",
  },
  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: {
    padding: "8px 16px", borderRadius: radius.md, fontSize: 13,
    border: `1px solid ${color.border}`, background: "none",
    color: color.textFaint, cursor: "pointer",
  },
  tabOn: { background: color.surfaceRaised, color: color.text, borderColor: color.borderSoft },
  grid: {
    display: "grid", gap: 14,
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  },
  groupCard: {
    background: color.surface, border: `1px solid ${color.border}`,
    borderRadius: radius.lg, padding: 18,
  },
  groupHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  groupName: { fontWeight: 500, fontSize: 15, fontFamily: fontSerif },
  tag: {
    fontSize: 10, padding: "2px 7px", borderRadius: radius.md,
    background: color.surfaceRaised, color: color.textFaint,
  },
  code:  { fontSize: 12, color: color.moss, margin: "6px 0" },
  inviteRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  btnGhost: {
    padding: "5px 10px", borderRadius: radius.sm, fontSize: 11,
    border: `1px solid ${color.border}`, background: "none",
    color: color.textMuted, cursor: "pointer",
  },
  groupActions: { marginTop: 12 },
  muted: { color: color.textFaint, fontSize: 12, lineHeight: 1.6, margin: "4px 0" },
  empty: { color: color.textFaint, fontSize: 13, lineHeight: 1.7 },
  btn: {
    padding: "9px 16px", borderRadius: radius.md, border: "none",
    background: color.accent, color: color.bg, cursor: "pointer", fontSize: 13, fontWeight: 500,
  },
  btnSmall: {
    width: "100%", padding: "8px", borderRadius: radius.md, border: "none",
    background: color.accent, color: color.bg, cursor: "pointer", fontSize: 13, fontWeight: 500,
  },
  error: {
    background: color.accentSoft, color: color.accent, padding: 12,
    borderRadius: radius.md, marginBottom: 16, fontSize: 13,
  },
};
