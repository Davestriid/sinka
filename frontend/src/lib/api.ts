const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Convierte la respuesta de error del servidor en una frase legible.
 *
 * Cuando falla la validacion, FastAPI no devuelve un texto sino una lista de
 * objetos, uno por campo invalido. Al mostrarla tal cual salia el famoso
 * "[object Object]", que no le dice nada a nadie. Aqui se arma una frase con
 * el nombre del campo y el motivo.
 */
function mensajeDeError(body: unknown, status: number): string {
  const detalle = (body as { detail?: unknown } | null)?.detail;

  if (typeof detalle === "string" && detalle.trim()) return detalle;

  if (Array.isArray(detalle)) {
    const NOMBRES: Record<string, string> = {
      alias:            "el nombre visible",
      bio:              "la descripción",
      avatar_url:       "la foto",
      email:            "el correo",
      username:         "el nombre de usuario",
      password:         "la contraseña",
      language:         "el idioma",
      theme:            "el tema",
      topic:            "la categoría",
      task_title:       "el título de la tarea",
      scheduled_for:    "la fecha",
      duration_minutes: "la duración",
      invitee_id:       "la persona invitada",
      name:             "el nombre",
      interests:        "los intereses",
    };

    const frases = detalle
      .map((e) => {
        const item  = e as { msg?: string; loc?: unknown[] };
        // "Value error, X" -> "X"
        const motivo = (item.msg ?? "").replace(/^\w+ error,\s*/i, "").trim();
        const campo  = Array.isArray(item.loc)
          ? String(item.loc[item.loc.length - 1])
          : "";
        const legible = NOMBRES[campo];
        if (!motivo) return legible ? `Revisa ${legible}.` : "";
        return legible ? `${motivo} (${legible})` : motivo;
      })
      .filter(Boolean);

    if (frases.length) return frases.join(" ");
  }

  if (status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (status === 403) return "No tienes permiso para hacer eso.";
  if (status === 404) return "No encontramos lo que buscabas.";
  if (status === 429) return "Demasiados intentos. Espera un momento.";
  if (status >= 500)  return "El servidor tuvo un problema. Intenta de nuevo.";
  return "Algo salió mal.";
}

/**
 * Renovacion del token de acceso.
 *
 * El token de acceso dura treinta minutos. Cuando caduca, en vez de mandar a
 * la persona de vuelta al login se canjea el token de refresco, que dura una
 * semana, y se repite la peticion. La sesion solo termina cuando la persona
 * cierra sesion a proposito o cuando el refresco tambien caduca.
 *
 * Las renovaciones simultaneas comparten la misma promesa, asi varias
 * peticiones que fallan a la vez no disparan varios canjes.
 */
let renovacionEnCurso: Promise<string | null> | null = null;

async function renovarAcceso(): Promise<string | null> {
  if (renovacionEnCurso) return renovacionEnCurso;

  renovacionEnCurso = (async () => {
    try {
      const { useAuthStore } = await import("@/store/auth.store");
      const estado = useAuthStore.getState();
      if (!estado.refreshToken) return null;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ refresh_token: estado.refreshToken }),
      });
      if (!res.ok) { estado.logout(); return null; }

      const datos = (await res.json()) as TokenResponse;
      estado.setTokens(datos.access_token, datos.refresh_token);
      return datos.access_token;
    } catch {
      return null;
    } finally {
      // Se libera en el siguiente ciclo para que quienes esperaban lean el valor
      setTimeout(() => { renovacionEnCurso = null; }, 0);
    }
  })();

  return renovacionEnCurso;
}

/** Cambia el token que viaja en la cabecera Authorization. */
function conNuevoToken(headers: HeadersInit | undefined, token: string): HeadersInit {
  return { ...(headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` };
}

async function request<T>(
  path: string,
  options?: RequestInit,
  reintentado = false,
): Promise<T> {
  // El orden importa. Antes las opciones se esparcian DESPUES de las
  // cabeceras, asi que su propia clave "headers" pisaba la mezcla y se perdia
  // el Content-Type. Cualquier peticion autenticada que llevara cuerpo salia
  // como texto plano y el servidor la rechazaba diciendo que no era un objeto.
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!res.ok) {
    // Token caducado: se renueva una vez y se repite la peticion original
    const llevaToken = Boolean(
      (options?.headers as Record<string, string> | undefined)?.Authorization
    );
    if (res.status === 401 && llevaToken && !reintentado && path !== "/auth/refresh") {
      const nuevo = await renovarAcceso();
      if (nuevo) {
        return request<T>(
          path,
          { ...options, headers: conNuevoToken(options?.headers, nuevo) },
          true,
        );
      }
    }

    const body = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new ApiError(mensajeDeError(body, res.status), res.status);
  }

  return res.json() as Promise<T>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  role:      "usuario" | "admin" | "superadmin";
  is_banned: boolean;

  alias:      string | null;
  avatar_url: string | null;
  bio:        string | null;

  language: "es" | "en";
  theme:    "light" | "dark";

  interests:            string[] | null;
  onboarding_completed: boolean;
}

export const sesionApi = {
  refresh: (refreshToken: string) =>
    request<TokenResponse>("/auth/refresh", {
      method: "POST",
      body:   JSON.stringify({ refresh_token: refreshToken }),
    }),
};

export const authApi = {
  register: (email: string, username: string, password: string) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, username, password }),
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (accessToken: string) =>
    request<UserResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Gamification ─────────────────────────────────────────────────────────────

export interface UserStats {
  user_id:             string;
  username:            string;
  xp_total:            number;
  level:               number;
  xp_current_level:    number;
  xp_next_level:       number;
  xp_progress_pct:     number;
  streak_current:      number;
  streak_max:          number;
  sessions_completed:  number;
  pomodoros_completed: number;
  focus_coins:         number;
  last_session_date:   string | null;
}

export interface LeaderboardEntry {
  rank:           number;
  user_id:        string;
  username:       string;
  xp_total:       number;
  level:          number;
  streak_current: number;
}

export interface SoloSessionCompleteResult {
  xp_earned:              number;
  xp_total:               number;
  level_before:           number;
  level_after:            number;
  leveled_up:             boolean;
  streak_before:          number;
  streak_after:           number;
  streak_increased:       boolean;
  streak_broken:          boolean;
  fc_earned:              number;
  focus_coins:            number;
  unlocked_achievements:  string[];
}

export const gamificationApi = {
  getStats: (accessToken: string) =>
    request<UserStats>("/gamification/stats", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getLeaderboard: (accessToken: string) =>
    request<LeaderboardEntry[]>("/gamification/leaderboard", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  completeSoloSession: (accessToken: string, roundsCompleted: number = 1) =>
    request<SoloSessionCompleteResult>("/gamification/solo/complete", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ rounds_completed: roundsCompleted }),
    }),
};

// ── Logros ────────────────────────────────────────────────────────────────────

export interface Achievement {
  id:              string;
  category:        string;
  name_es:         string;
  name_en:         string;
  description_es:  string;
  description_en:  string;
  icon:            string;
  reward_fc:       number;
  target:          number;
  progress:        number;
  unlocked:        boolean;
  unlocked_at:     string | null;
}

export interface AchievementsSummary {
  total:        number;
  unlocked:     number;
  achievements: Achievement[];
}

export const achievementsApi = {
  getMine: (accessToken: string) =>
    request<AchievementsSummary>("/achievements", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Tienda ────────────────────────────────────────────────────────────────────

export interface ShopItem {
  id:          string;
  name:        string;
  description: string;
  category:    string;
  price_fc:    number;
  preview:     string;
  owned:       boolean;
}

export interface BuyItemResponse {
  success:               boolean;
  message:               string;
  focus_coins_remaining: number;
  item_id:               string;
}

export const shopApi = {
  getItems: (accessToken: string) =>
    request<ShopItem[]>("/shop/items", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  buyItem: (accessToken: string, itemId: string) =>
    request<BuyItemResponse>(`/shop/buy/${itemId}`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getInventory: (accessToken: string) =>
    request<ShopItem[]>("/shop/inventory", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Panel de administración ────────────────────────────────────────────────
export interface AdminUserRow {
  id: string;
  email: string;
  username: string;
  alias: string | null;
  role: "usuario" | "admin" | "superadmin";
  is_active: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface AdminUserList {
  items: AdminUserRow[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface AdminStats {
  total_usuarios: number;
  usuarios_banneados: number;
  total_sesiones: number;
  total_pomodoros: number;
  focuscoins_en_circulacion: number;
  items_en_tienda: number;
}

export interface AdminShopItemRow {
  id: string;
  name: string;
  description: string;
  category: string;
  price_fc: number;
  preview: string;
  is_active: boolean;
}

export interface AdminPurchaseRow {
  id: string;
  user_id: string;
  pack_id: string;
  coins: number;
  precio_centavos: number;
  estado: string;
  created_at: string;
  paid_at: string | null;
}

export interface AdminRevenue {
  ingresos_centavos: number;
  compras_pagadas: number;
  compras: AdminPurchaseRow[];
}

export interface AdminReportRow {
  id: string;
  reporter_id: string;
  reporter_username: string | null;
  reported_user_id: string | null;
  reported_username: string | null;
  tipo: "reporte_usuario" | "queja" | "sugerencia" | "otro";
  reason: string;
  details: string | null;
  status: "pendiente" | "revisado" | "descartado";
  created_at: string;
  resolved_at: string | null;
}

export interface AdminAnnouncementRow {
  id: string;
  titulo: string;
  mensaje: string;
  activo: boolean;
  created_at: string;
  starts_at: string | null;
  expires_at: string | null;
}

export interface AdminSettingRow {
  id: string;
  code: string;
  name: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}

export interface AdminAuditRow {
  id: string;
  admin_id: string;
  admin_username: string | null;
  accion: string;
  objetivo_tipo: string | null;
  objetivo_id: string | null;
  detalle: string | null;
  created_at: string;
}

export const adminApi = {
  getStats: (accessToken: string) =>
    request<AdminStats>("/admin/stats", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getUsers: (
    accessToken: string,
    q: string,
    pagina: number,
    filtros?: { role?: string; banned?: boolean },
  ) => {
    const params = new URLSearchParams({ pagina: String(pagina) });
    if (q) params.set("q", q);
    if (filtros?.role) params.set("role", filtros.role);
    if (filtros?.banned !== undefined) params.set("banned", String(filtros.banned));
    return request<AdminUserList>(`/admin/users?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  banUser: (accessToken: string, userId: string) =>
    request<AdminUserRow>(`/admin/users/${userId}/ban`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  unbanUser: (accessToken: string, userId: string) =>
    request<AdminUserRow>(`/admin/users/${userId}/unban`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  banUsersLote: (accessToken: string, userIds: string[], banear: boolean) =>
    request<AdminUserRow[]>("/admin/users/ban-lote", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ user_ids: userIds, banear }),
    }),
  changeRole: (accessToken: string, userId: string, role: string) =>
    request<AdminUserRow>(`/admin/users/${userId}/role`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ role }),
    }),
  getShopItems: (accessToken: string) =>
    request<AdminShopItemRow[]>("/admin/shop", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  editShopItem: (accessToken: string, itemId: string, cambios: Partial<AdminShopItemRow>) =>
    request<AdminShopItemRow>(`/admin/shop/${itemId}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify(cambios),
    }),
  sendAnnouncement: (
    accessToken: string,
    titulo: string,
    mensaje: string,
    startsAt?: string | null,
    expiresAt?: string | null,
  ) =>
    request<AdminAnnouncementRow>("/admin/announcements", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({
        titulo, mensaje,
        starts_at:  startsAt || null,
        expires_at: expiresAt || null,
      }),
    }),
  getAnnouncements: (accessToken: string) =>
    request<AdminAnnouncementRow[]>("/admin/announcements", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  deactivateAnnouncement: (accessToken: string, id: string) =>
    request<AdminAnnouncementRow>(`/admin/announcements/${id}/desactivar`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getRevenue: (accessToken: string) =>
    request<AdminRevenue>("/admin/revenue", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getReports: (accessToken: string, estado?: string, tipo?: string) => {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (tipo) params.set("tipo", tipo);
    const qs = params.toString();
    return request<AdminReportRow[]>(`/admin/reports${qs ? `?${qs}` : ""}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  resolveReport: (accessToken: string, id: string, status: "revisado" | "descartado") =>
    request<AdminReportRow>(`/admin/reports/${id}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ status }),
    }),
  getSettings: (accessToken: string) =>
    request<AdminSettingRow[]>("/admin/settings", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  createSetting: (
    accessToken: string,
    datos: { code: string; name: string; value: Record<string, unknown>; description?: string },
  ) =>
    request<AdminSettingRow>("/admin/settings", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify(datos),
    }),
  updateSetting: (accessToken: string, id: string, value: Record<string, unknown>) =>
    request<AdminSettingRow>(`/admin/settings/${id}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ value }),
    }),
  getAudit: (accessToken: string, limite = 100) =>
    request<AdminAuditRow[]>(`/admin/audit?limite=${limite}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Reportes (usuario reporta a otro usuario) ──────────────────────────────
export const RAZONES_REPORTE = [
  { value: "comportamiento_inapropiado", label: "Comportamiento inapropiado" },
  { value: "acoso",                      label: "Acoso" },
  { value: "abandono_reiterado",         label: "Abandona sesiones seguido" },
  { value: "spam",                       label: "Spam" },
  { value: "otro",                       label: "Otro" },
] as const;

export const reportsApi = {
  crear: (accessToken: string, reportedUserId: string, reason: string, details?: string) =>
    request<{ id: string }>("/reports", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ reported_user_id: reportedUserId, reason, details: details || null }),
    }),
};

// ── Buzon general (queja, sugerencia, comentario — sin usuario reportado) ──
export const TIPOS_FEEDBACK = [
  { value: "queja",      label: "Queja" },
  { value: "sugerencia", label: "Sugerencia" },
  { value: "otro",       label: "Otro comentario" },
] as const;

export const feedbackApi = {
  enviar: (accessToken: string, tipo: string, mensaje: string) =>
    request<{ id: string }>("/feedback", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ tipo, mensaje }),
    }),
};

// ── Anuncios (banner del admin, visible para todos) ────────────────────────
export interface ActiveAnnouncement {
  id: string;
  titulo: string;
  mensaje: string;
  created_at: string;
}

export const announcementsApi = {
  getActive: (accessToken: string) =>
    request<ActiveAnnouncement | null>("/announcements/active", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Pagos (compra de FocusCoins con dinero real) ───────────────────────────
export interface CoinPack {
  id: string;
  nombre: string;
  coins: number;
  precio_centavos: number;
}

export const paymentsApi = {
  getPacks: () => request<CoinPack[]>("/payments/packs"),
  createCheckout: (accessToken: string, packId: string) =>
    request<{ checkout_url: string }>("/payments/checkout", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify({ pack_id: packId }),
    }),
};

// ── WebSocket URLs ────────────────────────────────────────────────────────────

export type Topic = {
  slug: string;
  label_es: string;
  label_en: string;
  icon: string;
};

export const catalogApi = {
  /** Las 13 categorias de actividad. No requiere token. */
  topics: () => request<{ topics: Topic[] }>("/catalog/topics"),
};

export interface ProfileUpdate {
  alias?:      string;
  avatar_url?: string;
  bio?:        string;
  language?:   "es" | "en";
  theme?:      "light" | "dark";
}

export const profileApi = {
  update: (accessToken: string, cambios: ProfileUpdate) =>
    request<UserResponse>("/auth/me", {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify(cambios),
    }),

  completeOnboarding: (
    accessToken: string,
    datos: { alias: string; avatar_url?: string | null; interests?: string[]; language?: string },
  ) =>
    request<UserResponse>("/auth/me/onboarding", {
      method:  "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body:    JSON.stringify(datos),
    }),

  search: (accessToken: string, q: string) =>
    request<UserResponse[]>(`/auth/users/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  // Perfil publico minimo de otra persona (nombre y foto), sin su correo.
  // Se usa para mostrar quien es la pareja dentro de una sesion.
  getPublic: (accessToken: string, userId: string) =>
    request<UserBrief>(`/auth/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// ── Social: amigos y jardin ──────────────────────────────────────────────────

export interface UserBrief {
  id:         string;
  username:   string;
  alias:      string | null;
  avatar_url: string | null;
}

export interface PlantBrief {
  phase:             number;
  phase_name:        string;
  emoji:             string;
  sessions_together: number;
}

export interface Friend {
  friendship_id: string;
  user:          UserBrief;
  since:         string | null;
  plant:         PlantBrief | null;
}

export interface FriendRequest {
  friendship_id: string;
  user:          UserBrief;
  direction:     "incoming" | "outgoing";
  created_at:    string | null;
}

export interface RequestsPayload {
  incoming:    FriendRequest[];
  outgoing:    FriendRequest[];
  remaining:   number;   // solicitudes que quedan hoy
  daily_limit: number;
}

export interface Plant {
  friendship_id:     string;
  friend:            UserBrief;
  name:              string | null;
  phase:             number;
  phase_name:        string;
  phase_label:       string;
  emoji:             string;
  nourishment:       number;
  next_phase_cost:   number;
  progress_pct:      number;
  is_max_phase:      boolean;
  sessions_together: number;
  minutes_together:  number;
  hours_together:    number;
  last_watered_on:   string | null;
  since:             string | null;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const friendsApi = {
  list: (token: string) =>
    request<Friend[]>("/friends", { headers: auth(token) }),

  requests: (token: string) =>
    request<RequestsPayload>("/friends/requests", { headers: auth(token) }),

  send: (token: string, userId: string) =>
    request<FriendRequest>(`/friends/request/${userId}`, {
      method: "POST", headers: auth(token),
    }),

  accept: (token: string, friendshipId: string) =>
    request<Friend>(`/friends/accept/${friendshipId}`, {
      method: "POST", headers: auth(token),
    }),

  reject: (token: string, friendshipId: string) =>
    request<void>(`/friends/reject/${friendshipId}`, {
      method: "POST", headers: auth(token),
    }),

  cancel: (token: string, friendshipId: string) =>
    request<void>(`/friends/request/${friendshipId}`, {
      method: "DELETE", headers: auth(token),
    }),

  remove: (token: string, friendshipId: string) =>
    request<void>(`/friends/${friendshipId}`, {
      method: "DELETE", headers: auth(token),
    }),

  block: (token: string, userId: string) =>
    request<void>(`/friends/block/${userId}`, {
      method: "POST", headers: auth(token),
    }),

  unblock: (token: string, userId: string) =>
    request<void>(`/friends/block/${userId}`, {
      method: "DELETE", headers: auth(token),
    }),
};

export const gardenApi = {
  list: (token: string) =>
    request<{ plants: Plant[]; total: number }>("/garden", { headers: auth(token) }),

  detail: (token: string, friendshipId: string) =>
    request<Plant>(`/garden/${friendshipId}`, { headers: auth(token) }),

  rename: (token: string, friendshipId: string, name: string) =>
    request<Plant>(`/garden/${friendshipId}`, {
      method: "PATCH", headers: auth(token), body: JSON.stringify({ name }),
    }),
};

// ── Grupos ───────────────────────────────────────────────────────────────────

export interface GroupMember extends UserBrief {
  role:      string;
  joined_at: string | null;
}

export interface Group {
  id:                    string;
  name:                  string;
  description:           string | null;
  topic:                 string;
  visibility:            "public" | "private";
  default_task:          string | null;
  member_count:          number;
  max_members:           number;
  is_full:               boolean;
  open_to_strangers:     boolean;
  requires_screen_share: boolean;
  is_member:             boolean;
  is_owner:              boolean;
  my_role:               string | null;
  created_at:            string | null;
  invite_code:           string | null;
  members?:              GroupMember[];
}

export interface LobbyPresence {
  user_id:        string;
  username:       string;
  avatar_url:     string | null;
  ready:          boolean;
  sharing_screen: boolean;
  is_owner:       boolean;
}

export interface LobbyState {
  present:               LobbyPresence[];
  ready_count:           number;
  can_start:             boolean;
  reason:                string;
  requires_screen_share: boolean;
}

export const groupsApi = {
  explore: (token: string, topic?: string) =>
    request<Group[]>(`/groups/explore${topic ? `?topic=${topic}` : ""}`, {
      headers: auth(token),
    }),

  mine: (token: string) =>
    request<Group[]>("/groups/mine", { headers: auth(token) }),

  detail: (token: string, groupId: string) =>
    request<Group>(`/groups/${groupId}`, { headers: auth(token) }),

  create: (
    token: string,
    datos: {
      name: string;
      topic: string;
      visibility?: "public" | "private";
      description?: string;
      default_task?: string;
      open_to_strangers?: boolean;
    },
  ) =>
    request<Group>("/groups", {
      method: "POST", headers: auth(token), body: JSON.stringify(datos),
    }),

  joinPublic: (token: string, groupId: string) =>
    request<Group>(`/groups/${groupId}/join`, {
      method: "POST", headers: auth(token),
    }),

  joinByCode: (token: string, code: string) =>
    request<Group>("/groups/join", {
      method: "POST", headers: auth(token), body: JSON.stringify({ code }),
    }),

  leave: (token: string, groupId: string) =>
    request<void>(`/groups/${groupId}/leave`, {
      method: "DELETE", headers: auth(token),
    }),

  kick: (token: string, groupId: string, userId: string) =>
    request<void>(`/groups/${groupId}/members/${userId}`, {
      method: "DELETE", headers: auth(token),
    }),

  disband: (token: string, groupId: string) =>
    request<void>(`/groups/${groupId}`, {
      method: "DELETE", headers: auth(token),
    }),

  regenerateCode: (token: string, groupId: string) =>
    request<{ invite_code: string }>(`/groups/${groupId}/code`, {
      method: "POST", headers: auth(token),
    }),

  lobbyState: (token: string, groupId: string) =>
    request<LobbyState>(`/groups/${groupId}/lobby/state`, { headers: auth(token) }),
};

// ── Citas programadas ────────────────────────────────────────────────────────

export interface Appointment {
  id:               string;
  title:            string | null;
  topic:            string;
  scheduled_for:    string;
  duration_minutes: number;
  status:           string;
  is_group:         boolean;
  is_creator:       boolean;
  creator:          UserBrief | null;
  invitee:          UserBrief | null;
  other_party:      UserBrief | null;
  group:            { id: string; name: string; topic: string } | null;
  session_id:       string | null;
  created_at:       string | null;
}

export interface Agenda {
  appointments: Appointment[];
  today:        Appointment[];
  remaining:    number;
  daily_limit:  number;
}

export const appointmentsApi = {
  agenda: (token: string) =>
    request<Agenda>("/appointments", { headers: auth(token) }),

  invitations: (token: string) =>
    request<Appointment[]>("/appointments/invitations", { headers: auth(token) }),

  create: (
    token: string,
    datos: {
      scheduled_for: string;
      topic: string;
      duration_minutes?: number;
      invitee_id?: string;
      group_id?: string;
      title?: string;
    },
  ) =>
    request<Appointment>("/appointments", {
      method: "POST", headers: auth(token), body: JSON.stringify(datos),
    }),

  accept: (token: string, id: string) =>
    request<Appointment>(`/appointments/${id}/accept`, {
      method: "POST", headers: auth(token),
    }),

  decline: (token: string, id: string) =>
    request<void>(`/appointments/${id}/decline`, {
      method: "POST", headers: auth(token),
    }),

  cancel: (token: string, id: string) =>
    request<void>(`/appointments/${id}`, {
      method: "DELETE", headers: auth(token),
    }),

  join: (token: string, id: string) =>
    request<{ session_id: string }>(`/appointments/${id}/join`, {
      method: "POST", headers: auth(token),
    }),
};

// ── Confianza y presencia ────────────────────────────────────────────────────

export interface TrustState {
  score:              number;
  level:              string;
  low_priority:       boolean;
  should_warn:        boolean;
  max_score:          number;
  sessions_abandoned: number;
  recent_penalties:   {
    reason: string; points: number; severity: string; created_at: string;
  }[];
}

export const trustApi = {
  me: (token: string) =>
    request<TrustState>("/gamification/trust", { headers: auth(token) }),
};

export const presenceApi = {
  /** Cuanta gente esta concentrada ahora. No requiere token. */
  now: () =>
    request<{ focusing_now: number; by_topic: Record<string, number> }>(
      "/gamification/presence",
    ),
};

const WS_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
  : "ws://localhost:8000/api";

export const wsUrl = {
  matchmakingQueue: (token: string) =>
    `${WS_BASE}/matchmaking/queue?token=${encodeURIComponent(token)}`,
  session: (sessionId: string, token: string) =>
    `${WS_BASE}/sessions/${sessionId}?token=${encodeURIComponent(token)}`,

  groupLobby: (groupId: string, token: string) =>
    `${WS_BASE}/groups/${groupId}/lobby?token=${encodeURIComponent(token)}`,
};
