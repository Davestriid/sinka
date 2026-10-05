"use client";

/**
 * Panel de administracion.
 *
 * Solo entra gente con role "admin" o "superadmin" (ver backend/modules/admin).
 * Pestañas: estadisticas, usuarios (buscar, banear, cambiar rol), tienda
 * (editar precios/activo), reportes (moderar), anuncios (banner del
 * dashboard) e ingresos (solo superadmin).
 *
 * Toda accion que cambia algo (banear, cambiar rol, editar precio, resolver
 * un reporte, enviar o desactivar un anuncio) pide confirmacion antes de
 * ejecutarse — ver confirmar() mas abajo.
 *
 * Deliberadamente simple: tablas planas, sin librerias de grillas nuevas.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  adminApi,
  type AdminAnnouncementRow,
  type AdminAuditRow,
  type AdminReportRow,
  type AdminRevenue,
  type AdminSettingRow,
  type AdminShopItemRow,
  type AdminStats,
  type AdminUserRow,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, pageBackground } from "@/lib/theme";

type Pestana =
  | "usuarios" | "tienda" | "stats" | "ingresos" | "buzon" | "anuncios"
  | "parametros" | "auditoria";

const TIPOS_BUZON: Record<string, string> = {
  reporte_usuario: "Reporte de usuario",
  queja:           "Queja",
  sugerencia:      "Sugerencia",
  otro:            "Otro",
};

/** Confirmacion simple antes de cualquier accion de administracion. */
function confirmar(mensaje: string): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(mensaje);
}

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
          <button style={{ ...s.tab, ...(pestana === "buzon" ? s.tabOn : {}) }} onClick={() => setPestana("buzon")}>
            Buzón
          </button>
          <button style={{ ...s.tab, ...(pestana === "anuncios" ? s.tabOn : {}) }} onClick={() => setPestana("anuncios")}>
            Anuncios
          </button>
          {user?.role === "superadmin" && (
            <button style={{ ...s.tab, ...(pestana === "parametros" ? s.tabOn : {}) }} onClick={() => setPestana("parametros")}>
              Parámetros
            </button>
          )}
          {user?.role === "superadmin" && (
            <button style={{ ...s.tab, ...(pestana === "auditoria" ? s.tabOn : {}) }} onClick={() => setPestana("auditoria")}>
              Auditoría
            </button>
          )}
          {user?.role === "superadmin" && (
            <button style={{ ...s.tab, ...(pestana === "ingresos" ? s.tabOn : {}) }} onClick={() => setPestana("ingresos")}>
              Ingresos
            </button>
          )}
        </div>

        {pestana === "stats"      && <PanelStats token={token} />}
        {pestana === "usuarios"   && <PanelUsuarios token={token} esSuperadmin={user?.role === "superadmin"} propioId={user?.id} />}
        {pestana === "tienda"     && <PanelTienda token={token} esSuperadmin={user?.role === "superadmin"} />}
        {pestana === "buzon"      && <PanelBuzon token={token} />}
        {pestana === "anuncios"   && <PanelAnuncios token={token} />}
        {pestana === "parametros" && user?.role === "superadmin" && <PanelParametros token={token} />}
        {pestana === "auditoria"  && user?.role === "superadmin" && <PanelAuditoria token={token} />}
        {pestana === "ingresos"   && user?.role === "superadmin" && <PanelIngresos token={token} />}
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
  const [rolFiltro, setRolFiltro] = useState("");
  const [bannedFiltro, setBannedFiltro] = useState<"" | "true" | "false">("");
  const [lista, setLista] = useState<AdminUserRow[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!token) return;
    setCargando(true);
    try {
      const res = await adminApi.getUsers(token, q, 1, {
        role: rolFiltro || undefined,
        banned: bannedFiltro === "" ? undefined : bannedFiltro === "true",
      });
      setLista(res.items);
      setSeleccion(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }, [token, q, rolFiltro, bannedFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  const act = async (fn: () => Promise<AdminUserRow>) => {
    try {
      const actualizado = await fn();
      setLista((l) => l.map((u) => (u.id === actualizado.id ? actualizado : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar el cambio.");
    }
  };

  const alternarSeleccion = (id: string) => {
    setSeleccion((s) => {
      const copia = new Set(s);
      if (copia.has(id)) copia.delete(id); else copia.add(id);
      return copia;
    });
  };

  const seleccionables = lista.filter((u) => u.id !== propioId);
  const todoSeleccionado = seleccionables.length > 0 && seleccionables.every((u) => seleccion.has(u.id));

  const accionEnLote = async (banear: boolean) => {
    if (!token || seleccion.size === 0) return;
    const verbo = banear ? "suspender" : "reactivar";
    if (!confirmar(`¿${verbo.charAt(0).toUpperCase() + verbo.slice(1)} a ${seleccion.size} usuario(s) seleccionado(s)?`)) return;
    try {
      const actualizados = await adminApi.banUsersLote(token, Array.from(seleccion), banear);
      const mapa = new Map(actualizados.map((u) => [u.id, u]));
      setLista((l) => l.map((u) => mapa.get(u.id) ?? u));
      setSeleccion(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la acción en lote.");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          style={{ ...s.input, flex: 2, minWidth: 180, marginBottom: 0 }}
          placeholder="Buscar por usuario o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          style={{ ...s.selectRol, flex: 1 }}
          value={rolFiltro}
          onChange={(e) => setRolFiltro(e.target.value)}
        >
          <option value="">Todos los roles</option>
          <option value="usuario">usuario</option>
          <option value="admin">admin</option>
          <option value="superadmin">superadmin</option>
        </select>
        <select
          style={{ ...s.selectRol, flex: 1 }}
          value={bannedFiltro}
          onChange={(e) => setBannedFiltro(e.target.value as "" | "true" | "false")}
        >
          <option value="">Suspendidos y activos</option>
          <option value="true">Solo suspendidos</option>
          <option value="false">Solo activos</option>
        </select>
      </div>

      {seleccionables.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <label style={{ ...s.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={todoSeleccionado}
              onChange={() =>
                setSeleccion(todoSeleccionado ? new Set() : new Set(seleccionables.map((u) => u.id)))
              }
            />
            Seleccionar todos
          </label>
          {seleccion.size > 0 && (
            <>
              <span style={s.muted}>{seleccion.size} seleccionado(s)</span>
              <button style={s.btnDanger} onClick={() => accionEnLote(true)}>Suspender selección</button>
              <button style={s.btnGhost} onClick={() => accionEnLote(false)}>Reactivar selección</button>
            </>
          )}
        </div>
      )}

      {error && <p style={s.error}>{error}</p>}
      {cargando ? (
        <p style={s.muted}>Cargando…</p>
      ) : (
        <div style={s.tabla}>
          {lista.map((u) => (
            <div key={u.id} style={s.fila}>
              {u.id !== propioId && (
                <input
                  type="checkbox"
                  checked={seleccion.has(u.id)}
                  onChange={() => alternarSeleccion(u.id)}
                />
              )}
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
                  onChange={(e) => {
                    const nuevoRol = e.target.value;
                    if (!confirmar(`¿Cambiar el rol de ${u.alias || u.username} a "${nuevoRol}"?`)) return;
                    act(() => token ? adminApi.changeRole(token, u.id, nuevoRol) : Promise.reject());
                  }}
                >
                  <option value="usuario">usuario</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              )}

              {u.id !== propioId && (
                <button
                  style={u.is_banned ? s.btnGhost : s.btnDanger}
                  onClick={() => {
                    const accion = u.is_banned ? "reactivar" : "suspender";
                    if (!confirmar(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} a ${u.alias || u.username}?`)) return;
                    act(() =>
                      token
                        ? (u.is_banned ? adminApi.unbanUser(token, u.id) : adminApi.banUser(token, u.id))
                        : Promise.reject());
                  }}
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
    if (precio === item.price_fc) return;   // sin cambio real, no molestar con confirmacion
    if (!confirmar(`¿Cambiar el precio de "${item.name}" a ${precio} FocusCoins?`)) return;
    try {
      const actualizado = await adminApi.editShopItem(token, item.id, { price_fc: precio });
      setItems((l) => l.map((i) => (i.id === item.id ? actualizado : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  const alternarActivo = async (item: AdminShopItemRow) => {
    if (!token) return;
    const accion = item.is_active ? "desactivar" : "activar";
    if (!confirmar(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} "${item.name}" en la tienda?`)) return;
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

// ── Buzón (reportes + quejas/sugerencias/comentarios) ────────────────────
function PanelBuzon({ token }: { token: string | null }) {
  const [lista, setLista] = useState<AdminReportRow[]>([]);
  const [error, setError] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [tipoFiltro, setTipoFiltro] = useState("");

  const cargar = useCallback(() => {
    if (!token) return;
    adminApi.getReports(token, soloPendientes ? "pendiente" : undefined, tipoFiltro || undefined)
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token, soloPendientes, tipoFiltro]);

  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (r: AdminReportRow, nuevoEstado: "revisado" | "descartado") => {
    if (!token) return;
    const verbo = nuevoEstado === "revisado" ? "marcar como revisado" : "descartar";
    const objetivo = r.reported_username || r.reported_user_id || "este mensaje";
    if (!confirmar(`¿${verbo.charAt(0).toUpperCase() + verbo.slice(1)} ${r.tipo === "reporte_usuario" ? `el reporte contra ${objetivo}` : objetivo}?`)) return;
    try {
      await adminApi.resolveReport(token, r.id, nuevoEstado);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    }
  };

  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <label style={{ ...s.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
          Solo pendientes
        </label>
        <select style={s.selectRol} value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="reporte_usuario">Reportes de usuario</option>
          <option value="queja">Quejas</option>
          <option value="sugerencia">Sugerencias</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div style={s.tabla}>
        {lista.map((r) => (
          <div key={r.id} style={s.fila}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>
                {r.tipo === "reporte_usuario"
                  ? `${r.reporter_username || r.reporter_id} → ${r.reported_username || r.reported_user_id}`
                  : r.reporter_username || r.reporter_id}
              </div>
              <div style={s.muted}>
                <span style={s.tipoBadge}>{TIPOS_BUZON[r.tipo] ?? r.tipo}</span>
                {" "}{r.reason !== r.tipo ? r.reason : ""} {r.details ? `— ${r.details}` : ""}
              </div>
              <div style={s.muted}>{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <span style={r.status === "pendiente" ? s.banBadge : s.rolBadge}>{r.status}</span>
            {r.status === "pendiente" && (
              <>
                <button style={s.btn} onClick={() => resolver(r, "revisado")}>Marcar revisado</button>
                <button style={s.btnGhost} onClick={() => resolver(r, "descartado")}>Descartar</button>
              </>
            )}
          </div>
        ))}
        {lista.length === 0 && <p style={s.muted}>No hay nada{soloPendientes ? " pendiente" : ""} en el buzón.</p>}
      </div>
    </div>
  );
}

// ── Anuncios (banner del dashboard) ──────────────────────────────────────
function PanelAnuncios({ token }: { token: string | null }) {
  const [lista, setLista] = useState<AdminAnnouncementRow[]>([]);
  const [error, setError] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    if (!token) return;
    adminApi.getAnnouncements(token).then(setLista).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const enviar = async () => {
    if (!token || !titulo.trim() || !mensaje.trim()) return;
    if (!confirmar(`¿Enviar el anuncio "${titulo}" a todos los usuarios? Aparecerá como banner en su panel de inicio.`)) return;
    setEnviando(true);
    try {
      await adminApi.sendAnnouncement(token, titulo.trim(), mensaje.trim());
      setTitulo("");
      setMensaje("");
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el anuncio.");
    } finally {
      setEnviando(false);
    }
  };

  const desactivar = async (a: AdminAnnouncementRow) => {
    if (!token) return;
    if (!confirmar(`¿Ocultar el anuncio "${a.titulo}"? Dejará de verse en el dashboard.`)) return;
    try {
      await adminApi.deactivateAnnouncement(token, a.id);
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar.");
    }
  };

  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 16 }}>
        <input
          style={s.input}
          placeholder="Título"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <textarea
          style={{ ...s.input, minHeight: 70, resize: "vertical" }}
          placeholder="Mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
        <button
          style={{ ...s.btn, opacity: enviando || !titulo.trim() || !mensaje.trim() ? 0.6 : 1 }}
          disabled={enviando || !titulo.trim() || !mensaje.trim()}
          onClick={enviar}
        >
          {enviando ? "Enviando…" : "Enviar anuncio"}
        </button>
      </div>

      <div style={s.tabla}>
        {lista.map((a) => (
          <div key={a.id} style={s.fila}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>{a.titulo}</div>
              <div style={s.muted}>{a.mensaje}</div>
              <div style={s.muted}>{new Date(a.created_at).toLocaleString()}</div>
            </div>
            <span style={a.activo ? s.rolBadge : s.muted}>{a.activo ? "activo" : "oculto"}</span>
            {a.activo && (
              <button style={s.btnGhost} onClick={() => desactivar(a)}>Desactivar</button>
            )}
          </div>
        ))}
        {lista.length === 0 && <p style={s.muted}>Todavía no has enviado anuncios.</p>}
      </div>
    </div>
  );
}

// ── Parámetros configurables (solo superadmin) ───────────────────────────
function PanelParametros({ token }: { token: string | null }) {
  const [lista, setLista] = useState<AdminSettingRow[]>([]);
  const [error, setError] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});

  const cargar = useCallback(() => {
    if (!token) return;
    adminApi.getSettings(token)
      .then((res) => {
        setLista(res);
        setValores(Object.fromEntries(res.map((s2) => [s2.id, JSON.stringify(s2.value)])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (setting: AdminSettingRow) => {
    if (!token) return;
    let nuevo: Record<string, unknown>;
    try {
      nuevo = JSON.parse(valores[setting.id]);
    } catch {
      setError(`El valor de "${setting.name}" no es un JSON válido.`);
      return;
    }
    if (JSON.stringify(nuevo) === JSON.stringify(setting.value)) return;
    if (!confirmar(`¿Actualizar el parámetro "${setting.name}"? Esto puede cambiar el comportamiento de la app para todos los usuarios.`)) return;
    try {
      const actualizado = await adminApi.updateSetting(token, setting.id, nuevo);
      setLista((l) => l.map((s2) => (s2.id === actualizado.id ? actualizado : s2)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el parámetro.");
    }
  };

  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <p style={{ ...s.muted, marginBottom: 14 }}>
        Valores en formato JSON (ej: {`{"amount": 15}`}). Cambiar esto afecta a toda la aplicación de inmediato.
      </p>
      <div style={s.tabla}>
        {lista.map((setting) => (
          <div key={setting.id} style={s.fila}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600 }}>{setting.name}</div>
              <div style={s.muted}>{setting.code}</div>
              {setting.description && <div style={s.muted}>{setting.description}</div>}
            </div>
            <input
              style={{ ...s.inputPrecio, width: 160 }}
              value={valores[setting.id] ?? ""}
              onChange={(e) => setValores((v) => ({ ...v, [setting.id]: e.target.value }))}
              onBlur={() => guardar(setting)}
            />
          </div>
        ))}
        {lista.length === 0 && !error && <p style={s.muted}>Todavía no hay parámetros configurados.</p>}
      </div>
    </div>
  );
}

// ── Auditoría (solo superadmin) ───────────────────────────────────────────
function PanelAuditoria({ token }: { token: string | null }) {
  const [lista, setLista] = useState<AdminAuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    adminApi.getAudit(token).then(setLista).catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [token]);

  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <p style={{ ...s.muted, marginBottom: 14 }}>
        Quién hizo qué, cuándo. Registro de solo lectura — no se puede editar ni borrar desde aquí.
      </p>
      <div style={s.tabla}>
        {lista.map((l) => (
          <div key={l.id} style={s.fila}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>
                {l.admin_username || l.admin_id} — {l.accion}
              </div>
              <div style={s.muted}>
                {l.objetivo_tipo ? `${l.objetivo_tipo}${l.objetivo_id ? ` (${l.objetivo_id})` : ""}` : ""}
                {l.detalle ? ` — ${l.detalle}` : ""}
              </div>
              <div style={s.muted}>{new Date(l.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {lista.length === 0 && !error && <p style={s.muted}>Todavía no hay acciones registradas.</p>}
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
  page:   { minHeight: "100vh", background: pageBackground, color: color.text, padding: 24, display: "flex", justifyContent: "center" },
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
  tipoBadge: {
    fontSize: 10, padding: "2px 8px", borderRadius: radius.pill,
    background: color.surface, border: `1px solid ${color.border}`, color: color.textMuted,
    marginRight: 6, display: "inline-block",
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
