"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { gamificationApi, type LeaderboardEntry, type UserStats } from "@/lib/api";
import { SkeletonLeaderboardRow } from "@/components/Skeleton";

const REFRESH_INTERVAL_MS = 30_000; // actualizar cada 30 s

export default function LeaderboardPage() {
  const router                = useRouter();
  const { accessToken: token, user } = useAuthStore();

  const [entries,   setEntries]   = useState<LeaderboardEntry[]>([]);
  const [myStats,   setMyStats]   = useState<UserStats | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [lb, stats] = await Promise.all([
        gamificationApi.getLeaderboard(token),
        gamificationApi.getStats(token),
      ]);
      setEntries(lb);
      setMyStats(stats);
      setLastUpdate(new Date());
    } catch {
      // sin red: mantener datos anteriores
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, router, fetchData]);

  // ¿el usuario autenticado aparece en el top-10?
  const myRank = entries.find(e => e.user_id === user?.id)?.rank ?? null;

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => router.push("/dashboard")} style={styles.back}>← Dashboard</button>
        <h1 style={styles.title}>🏆 Leaderboard</h1>
      </div>
      <div style={{ ...styles.table, gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLeaderboardRow key={i} />
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => router.push("/dashboard")} style={styles.back}>← Dashboard</button>
        <h1 style={styles.title}>🏆 Leaderboard</h1>
        {lastUpdate && (
          <span style={styles.updated}>
            actualizado {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Mi posición (si no estoy en top-10) */}
      {myStats && myRank === null && (
        <div style={styles.myCard}>
          <span style={styles.myLabel}>Tu posición</span>
          <span style={styles.myRank}>#{(entries.length + 1).toString()}</span>
          <span style={styles.myName}>{myStats.username}</span>
          <span style={styles.myXp}>{myStats.xp_total.toLocaleString()} XP</span>
          <span style={styles.myLevel}>Nv. {myStats.level}</span>
        </div>
      )}

      {/* Tabla top-10 */}
      <div style={styles.table}>
        {entries.length === 0 ? (
          <div style={styles.empty}>Aún no hay datos. ¡Completa tu primera sesión!</div>
        ) : (
          entries.map(entry => {
            const isMe = entry.user_id === user?.id;
            return (
              <div key={entry.user_id} style={{ ...styles.row, ...(isMe ? styles.rowMe : {}) }}>
                {/* Rank badge */}
                <div style={rankBadgeStyle(entry.rank)}>{entry.rank}</div>

                {/* Avatar */}
                <div style={styles.avatar}>
                  {entry.username.slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div style={styles.info}>
                  <span style={styles.name}>
                    {entry.username}{isMe && " (tú)"}
                  </span>
                  <span style={styles.sub}>
                    Nv. {entry.level}
                    {entry.streak_current > 0 && ` · 🔥 ${entry.streak_current}d`}
                  </span>
                </div>

                {/* XP */}
                <div style={styles.xpCol}>
                  <span style={styles.xpNum}>{entry.xp_total.toLocaleString()}</span>
                  <span style={styles.xpLabel}>XP</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Refresh manual */}
      <button onClick={fetchData} style={styles.refreshBtn}>
        ↻ Actualizar ahora
      </button>
    </div>
  );
}

// ── Helpers de estilo ─────────────────────────────────────────────────────────

function rankBadgeStyle(rank: number): React.CSSProperties {
  const colors: Record<number, { bg: string; color: string }> = {
    1: { bg: "#854d0e", color: "#fef08a" },
    2: { bg: "#374151", color: "#d1d5db" },
    3: { bg: "#78350f", color: "#fed7aa" },
  };
  const c = colors[rank] ?? { bg: "#1c1816", color: "#a0998b" };
  return {
    ...styles.rankBadge,
    background: c.bg,
    color:      c.color,
  };
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:       "100vh",
    background:      "#0f0e0d",
    color:           "#e8e0d5",
    fontFamily:      "system-ui, sans-serif",
    padding:         "24px 16px",
    display:         "flex",
    flexDirection:   "column",
    alignItems:      "center",
    gap:             16,
  },
  center: {
    minHeight: "100vh",
    display:   "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#a0998b",
    background: "#0f0e0d",
  },
  header: {
    width:          "100%",
    maxWidth:       540,
    display:        "flex",
    alignItems:     "center",
    gap:            12,
    marginBottom:   8,
  },
  back: {
    background:   "none",
    border:       "none",
    color:        "#a0998b",
    cursor:       "pointer",
    fontSize:     14,
    padding:      "4px 8px",
    borderRadius: 6,
  },
  title: {
    flex:     1,
    margin:   0,
    fontSize: 22,
    fontWeight: 700,
  },
  updated: {
    fontSize: 11,
    color:    "#6b6358",
  },
  myCard: {
    width:          "100%",
    maxWidth:       540,
    background:     "#1e3a2f",
    border:         "1px solid #2d5a44",
    borderRadius:   10,
    padding:        "12px 16px",
    display:        "flex",
    alignItems:     "center",
    gap:            12,
    fontSize:       14,
  },
  myLabel: { color: "#6ee7b7", fontSize: 11 },
  myRank:  { fontWeight: 700, fontSize: 18, minWidth: 36, textAlign: "center" as const },
  myName:  { flex: 1, fontWeight: 600 },
  myXp:   { color: "#fbbf24", fontWeight: 700 },
  myLevel: { color: "#a0998b" },
  table: {
    width:     "100%",
    maxWidth:  540,
    display:   "flex",
    flexDirection: "column",
    gap:       8,
  },
  empty: {
    textAlign: "center" as const,
    color:     "#6b6358",
    padding:   32,
    fontSize:  14,
  },
  row: {
    background:   "#1c1816",
    border:       "1px solid #2a2520",
    borderRadius: 10,
    padding:      "12px 14px",
    display:      "flex",
    alignItems:   "center",
    gap:          12,
    transition:   "border-color 0.2s",
  },
  rowMe: {
    border:     "1px solid #4ade80",
    background: "#0f2318",
  },
  rankBadge: {
    width:        32,
    height:       32,
    borderRadius: "50%",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    fontWeight:   700,
    fontSize:     14,
    flexShrink:   0,
  },
  avatar: {
    width:          36,
    height:         36,
    borderRadius:   "50%",
    background:     "#2d2520",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       13,
    fontWeight:     700,
    color:          "#a0998b",
    flexShrink:     0,
  },
  info: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    gap:           2,
  },
  name: { fontWeight: 600, fontSize: 15 },
  sub:  { fontSize: 12, color: "#a0998b" },
  xpCol: {
    display:       "flex",
    flexDirection: "column",
    alignItems:    "flex-end",
    gap:           2,
  },
  xpNum:   { fontWeight: 700, fontSize: 16, color: "#fbbf24" },
  xpLabel: { fontSize: 11, color: "#6b6358" },
  refreshBtn: {
    marginTop:    8,
    background:   "none",
    border:       "1px solid #2a2520",
    borderRadius: 8,
    color:        "#a0998b",
    cursor:       "pointer",
    padding:      "8px 20px",
    fontSize:     13,
  },
};
