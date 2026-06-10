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

const WS_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, "ws")
  : "ws://localhost:8000/api";

export const wsUrl = {
  matchmakingQueue: (token: string) =>
    `${WS_BASE}/matchmaking/queue?token=${encodeURIComponent(token)}`,
  session: (sessionId: string, token: string) =>
    `${WS_BASE}/sessions/${sessionId}?token=${encodeURIComponent(token)}`,
};
