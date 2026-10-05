"use client";

/**
 * Panel de administracion.
 *
 * Solo entra gente con role "admin" o "superadmin" (ver backend/modules/admin).
 * Tres pestañas: usuarios (buscar, banear, cambiar rol), tienda (editar
 * precios/activo) y estadisticas (numeros generales de la app).
 *
 * Deliberadamente simple: tablas planas, sin librerias de grillas nuevas.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  adminApi,
  type AdminRevenue,
  type AdminShopItemRow,
  type AdminStats,
  type AdminUserRow,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius } from "@/lib/theme";

type Pestana = "usuarios" | "tienda" | "stats" | "ingresos";

export default function AdminPage() {
  const router = useRouter();
  const { accessToken: token, user, hidratado } = useAuthStore();
  const [pestana, setPestana] = useState<Pestana>("stats");

  const [negado, setNegado] = useState(false);

  useEffect(() => {
    if (!hidratado) return;
    if (!token) { router.push("/login"); return; }
    if (user && user.role !== "admin" && user.role !== "superadmin") {
      setNegado(true);
    }
  }, [token, user, router, hidratado]);

  if (negado) {
    return (
      <div style={s.page}>
        <div style={s.centro}>
          <p style={s.muted}>No tienes permisos para ver esta página.</p>
          <button style={s.btnGhost} onClick={() => router.push("/dashboard")}>← Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.centro}>
        <header style={s.header}>
          <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
          <h1 style={s.title}>Administración</h1>
        </header>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(pestana === "stats" ? s.tabOn : {}) }} onClick={() => setPestana("stats")}>
            Estadísticas
          </button>
          <button style={{ ...s.tab, ...(pestana === "usuarios" ? s.tabOn : {}) }} onClick={() => setPestana("usuarios")}>
            Usuarios
          </button>
          <button style={{ ...s.tab, ...(pestana === "tienda" ? s.tabOn : {}) }} onClick={() => setPestana("tienda")}>
            Tienda
          </button>
          {user?.role === "superadmin" && (
            <button style={{ ...s.tab, ...(pestana === "ingresos" ? s.tabOn : {}) }} onClick={() => setPestana("ingresos")}>
              Ingresos
            </button>
          )}
        </div>

        {pestana === "stats"    && <PanelStats token={token} />}
        {pestana === "usuarios" && <PanelUsuarios token={token} esSuperadmin={user?.role === "superadmin"} propioId={user?.id} />}
        {pestana === "tienda"   && <PanelTienda token={token} esSuperadmin={user?.role === "superadmin"} />}
        {pestana === "ingresos" && user?.role === "superadmin" && <PanelIngresos token={token} />}
      </div>
    </div>
  );
}

// ── Estadísticas ─────────────────────────────────────────────────────────
function PanelStats({ token }: { token: string | null }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    adminApi.getStats(token).then(setStats).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  if (error) return <p style={s.error}>{error}</p>;
  if (!stats) return <p style={s.muted}>Cargando…</p>;

  const tarjetas: [string, number][] = [
    ["Usuarios totales",        stats.total_usuarios],
    ["Usuarios suspendidos",    stats.usuarios_banneados],
    ["Sesiones completadas",    stats.total_sesiones],
    ["Pomodoros completados",   stats.total_pomodoros],
    ["FocusCoins en circulación", stats.focuscoins_en_circulacion],
    ["Ítems en la tienda",      stats.items_en_tienda],
  ];

  return (
    <div style={s.grid}>
      {tarjetas.map(([label, valor]) => (
        <div key={label} style={s.card}>
          <div style={s.cardValor}>{valor}</div>
          <div style={s.muted}>{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Usuarios ─────────────────────────────────────────────────────────────
function PanelUsuarios({
  token, esSuperadmin, propioId,
}: { token: string | null; esSuperadmin: boolean; propioId?: string }) {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<AdminUserRow[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const res = await adminApi.getUsers(token, q, 1);
      setLista(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }, [token, q]);

  useEffect(() => { cargar(); }, [cargar]);

  const act = async (fn: () => Promise<AdminUserRow>) => {
    try {
      const actualizado = await fn();
      setLista((l) => l.map((u) => (u.id === actualizado.id ? actualizado : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar el cambio.");
    }
  };

  return (
    <div>
      <input
        style={s.input}
        placeholder="Buscar por usuario o correo…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p style={s.error}>{error}</p>}
      {cargando ? (
        <p style={s.muted}>Cargando…</p>
      ) : (
        <div style={s.tabla}>
          {lista.map((u) => (
            <div key={u.id} style={s.fila}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{u.alias || u.username}</div>
                <div style={s.muted}>{u.email}</div>
              </div>
              <span style={s.rolBadge}>{u.role}</span>
              {u.is_banned && <span style={s.banBadge}>suspendido</span>}

              {esSuperadmin && u.id !== propioId && (
                <select
                  style={s.selectRol}
                  value={u.role}
                  onChange={(e) => act(() => token ? adminApi.changeRole(token, u.id, e.target.value) : Promise.reject())}
                >
                  <option value="usuario">usuario</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              )}

              {u.id !== propioId && (
                <button
                  style={u.is_banned ? s.btnGhost : s.btnDanger}
                  onClick={() => act(() =>
                    token
                      ? (u.is_banned ? adminApi.unbanUser(token, u.id) : adminApi.banUser(token, u.id))
                      : Promise.reject())
                  }
                >
                  {u.is_banned ? "Reactivar" : "Suspender"}
                </button>
              )}
            </div>
          ))}
          {lista.length === 0 && <p style={s.muted}>Sin resultados.</p>}
        </div>
      )}
    </div>
  );
}

// ── Tienda ───────────────────────────────────────────────────────────────
function PanelTienda({ token, esSuperadmin }: { token: string | null; esSuperadmin: boolean }) {
  const [items, setItems] = useState<AdminShopItemRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    adminApi.getShopItems(token).then(setItems).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  const guardarPrecio = async (item: AdminShopItemRow, precio: number) => {
    if (!token) return;
    try {
      const actualizado = await adminApi.editShopItem(token, item.id, { price_fc: precio });
      setItems((l) => l.map((i) => (i.id === item.id ? actualizado : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  const alternarActivo = async (item: AdminShopItemRow) => {
    if (!token) return;
    try {
      const actualizado = await adminApi.editShopItem(token, item.id, { is_active: !item.is_active });
      setItems((l) => l.map((i) => (i.id === item.id ? actualizado : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      {!esSuperadmin && (
        <p style={s.muted}>Solo un superadmin puede editar precios o activar/desactivar ítems.</p>
      )}
      <div style={s.tabla}>
        {items.map((item) => (
          <div key={item.id} style={s.fila}>
            <span style={{ fontSize: 20 }}>{item.preview || "🎁"}</span>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div style={s.muted}>{item.category}</div>
            </div>
            <input
              type="number"
              style={s.inputPrecio}
              defaultValue={item.price_fc}
              disabled={!esSuperadmin}
              onBlur={(e) => guardarPrecio(item, Number(e.target.value))}
            />
            <button
              style={item.is_active ? s.btnGhost : s.btn}
              disabled={!esSuperadmin}
              onClick={() => alternarActivo(item)}
            >
              {item.is_active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
        {items.length === 0 && !error && <p style={s.muted}>Cargando…</p>}
      </div>
    </div>
  );
}

// ── Ingresos (solo superadmin) ────────────────────────────────────────────
function PanelIngresos({ token }: { token: string | null }) {
  const [datos, setDatos] = useState<AdminRevenue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    adminApi.getRevenue(token).then(setDatos).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  if (error) return <p style={s.error}>{error}</p>;
  if (!datos) return <p style={s.muted}>Cargando…</p>;

  return (
    <div>
      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardValor}>${(datos.ingresos_centavos / 100).toFixed(2)}</div>
          <div style={s.muted}>Ingresos totales (pagados)</div>
        </div>
        <div style={s.card}>
          <div style={s.cardValor}>{datos.compras_pagadas}</div>
          <div style={s.muted}>Compras pagadas</div>
        </div>
      </div>

      <h3 style={{ margin: "20px 0 10px", fontSize: 15 }}>Compras recientes</h3>
      <div style={s.tabla}>
        {datos.compras.map((c) => (
          <div key={c.id} style={s.fila}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 600 }}>{c.pack_id}</div>
              <div style={s.muted}>{new Date(c.created_at).toLocaleString()}</div>
            </div>
            <span style={s.muted}>{c.coins} FC</span>
            <span style={{ fontWeight: 600 }}>${(c.precio_centavos / 100).toFixed(2)}</span>
            <span
              style={c.estado === "pagado" ? s.rolBadge : c.estado === "fallido" ? s.banBadge : s.muted}
            >
              {c.estado}
            </span>
          </div>
        ))}
        {datos.compras.length === 0 && <p style={s.muted}>Todavía no hay compras.</p>}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: color.bg, color: color.text, padding: 24, display: "flex", justifyContent: "center" },
  centro: { width: "100%", maxWidth: 720 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  back:   { background: "none", border: "none", color: color.textMuted, cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0 },
  tabs:   { display: "flex", gap: 8, marginBottom: 20 },
  tab: {
    padding: "8px 16px", borderRadius: radius.pill, fontSize: 13,
    border: `1px solid ${color.border}`, background: color.bg, color: color.sand, cursor: "pointer",
  },
  tabOn: { borderColor: color.moss, background: color.mossSoft, color: color.text },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 },
  card: { background: color.surface, borderRadius: radius.md, padding: 18 },
  cardValor: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  muted: { color: color.textFaint, fontSize: 12, lineHeight: 1.7 },
  error: {
    background: color.accentSoft, color: color.accent, padding: 12,
    borderRadius: radius.sm, marginBottom: 16, fontSize: 13,
  },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: color.surface,
    color: color.text, fontSize: 14, marginBottom: 14, fontFamily: "inherit",
  },
  tabla: { display: "flex", flexDirection: "column", gap: 10 },
  fila: {
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    background: color.surface, borderRadius: radius.md, padding: "12px 16px",
  },
  rolBadge: {
    fontSize: 11, padding: "3px 10px", borderRadius: radius.pill,
    background: color.mossSoft, color: color.moss,
  },
  banBadge: {
    fontSize: 11, padding: "3px 10px", borderRadius: radius.pill,
    background: color.accentSoft, color: color.accent,
  },
  selectRol: {
    padding: "6px 10px", borderRadius: radius.sm, border: `1px solid ${color.border}`,
    background: color.bg, color: color.text, fontSize: 12,
  },
  inputPrecio: {
    width: 80, padding: "6px 10px", borderRadius: radius.sm,
    border: `1px solid ${color.border}`, background: color.bg, color: color.text, fontSize: 13,
  },
  btn: {
    padding: "8px 14px", borderRadius: radius.sm, border: "none",
    background: color.moss, color: color.bg, cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  btnGhost: {
    padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${color.border}`,
    background: "none", color: color.textMuted, cursor: "pointer", fontSize: 13,
  },
  btnDanger: {
    padding: "8px 14px", borderRadius: radius.sm, border: `1px solid ${color.accent}`,
    background: "none", color: color.accent, cursor: "pointer", fontSize: 13,
  },
};
