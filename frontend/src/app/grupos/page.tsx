"use client";

/**
 * Grupos: explorar los publicos, ver los propios, crear uno nuevo y entrar
 * por codigo de invitacion.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { catalogApi, groupsApi, type Group, type Topic } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

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

  const accion = async (fn: () => Promise<unknown>) => {
    try { await fn(); await cargar(); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Algo salió mal."); }
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
                <p style={s.code}>Código: <strong>{g.invite_code}</strong></p>
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
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0, marginRight: "auto" },
  card:      { background: "#221e1a", borderRadius: 12, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, margin: "0 0 14px" },
  label:  { color: "#c4b99a", fontSize: 13, margin: "14px 0 8px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 10,
    border: "1px solid #3a332b", background: "#1a1714", color: "#f5f0e8", fontSize: 14,
  },
  joinRow: { display: "flex", gap: 10 },
  chips:  { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "7px 13px", borderRadius: 18, fontSize: 12,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#c4b99a", cursor: "pointer",
  },
  chipOn: { borderColor: "#7fa05a", background: "#2a3524", color: "#f5f0e8" },
  aviso: {
    color: "#c4a05a", fontSize: 12, lineHeight: 1.6,
    background: "#2a2318", padding: 10, borderRadius: 8, margin: "12px 0",
  },
  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: {
    padding: "8px 16px", borderRadius: 8, fontSize: 13,
    border: "1px solid #3a332b", background: "none",
    color: "#8b8378", cursor: "pointer",
  },
  tabOn: { background: "#2f2a24", color: "#f5f0e8", borderColor: "#4a4238" },
  grid: {
    display: "grid", gap: 14,
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  },
  groupCard: {
    background: "#221e1a", border: "1px solid #2f2a24",
    borderRadius: 12, padding: 18,
  },
  groupHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  groupName: { fontWeight: 700, fontSize: 15 },
  tag: {
    fontSize: 10, padding: "2px 7px", borderRadius: 8,
    background: "#2f2a24", color: "#8b8378",
  },
  code:  { fontSize: 12, color: "#7fa05a", margin: "6px 0" },
  groupActions: { marginTop: 12 },
  muted: { color: "#8b8378", fontSize: 12, lineHeight: 1.6, margin: "4px 0" },
  empty: { color: "#8b8378", fontSize: 13, lineHeight: 1.7 },
  btn: {
    padding: "9px 16px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 13,
  },
  btnSmall: {
    width: "100%", padding: "8px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer", fontSize: 13,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
};
