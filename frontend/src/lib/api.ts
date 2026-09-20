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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Error desconocido" }));
    throw new ApiError(body.detail ?? "Error del servidor", res.status);
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

  alias:      string | null;
  avatar_url: string | null;
  bio:        string | null;

  language: "es" | "en";
  theme:    "light" | "dark";

  interests:            string[] | null;
  onboarding_completed: boolean;
}

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

export const gamificationApi = {
  getStats: (accessToken: string) =>
    request<UserStats>("/gamification/stats", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  getLeaderboard: (accessToken: string) =>
    request<LeaderboardEntry[]>("/gamification/leaderboard", {
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
