"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { shopApi, gamificationApi, type ShopItem, type UserStats, ApiError } from "@/lib/api";
import { SkeletonShopCard } from "@/components/Skeleton";

const CATEGORY_LABELS: Record<string, string> = {
  background:   "🖼️ Fondos",
  plant_skin:   "🌿 Skins de Planta",
  avatar_frame: "🪄 Marcos de Avatar",
  music:        "🎵 Música",
};

export default function ShopPage() {
  const router                       = useRouter();
  const { accessToken: token, user, hidratado } = useAuthStore();

  const [items,   setItems]   = useState<ShopItem[]>([]);
  const [stats,   setStats]   = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [shopItems, userStats] = await Promise.all([
        shopApi.getItems(token),
        gamificationApi.getStats(token),
      ]);
      setItems(shopItems);
      setStats(userStats);
    } catch {
      // mantener estado anterior
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    fetchData();
  }, [token, router, fetchData, hidratado]);

  const handleBuy = async (item: ShopItem) => {
    if (!token || buying) return;
    setBuying(item.id);
    try {
      const res = await shopApi.buyItem(token, item.id);
      showToast(res.message, true);
      // Actualizar estado local: marcar como owned, restar FC
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, owned: true } : i));
      setStats(prev => prev ? { ...prev, focus_coins: res.focus_coins_remaining } : prev);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al comprar";
      showToast(msg, false);
    } finally {
      setBuying(null);
    }
  };

  // Agrupar por categoría
  const byCategory = items.reduce<Record<string, ShopItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={() => router.push("/dashboard")} style={styles.back}>← Dashboard</button>
        <h1 style={styles.title}>🛍️ Tienda</h1>
      </div>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <div style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonShopCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.ok ? "#14532d" : "#7f1d1d", borderColor: toast.ok ? "#4ade80" : "#f87171" }}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => router.push("/dashboard")} style={styles.back}>← Dashboard</button>
        <h1 style={styles.title}>🛍️ Tienda</h1>
        <div style={styles.fcBadge}>
          🪙 <strong>{stats?.focus_coins ?? 0}</strong> FC
        </div>
      </div>

      <p style={styles.hint}>
        Gana FocusCoins completando sesiones de enfoque. ¡Compra cosméticos para personalizar tu espacio!
      </p>

      {/* Secciones por categoría */}
      {Object.entries(byCategory).map(([cat, catItems]) => (
        <div key={cat} style={styles.section}>
          <h2 style={styles.catTitle}>{CATEGORY_LABELS[cat] ?? cat}</h2>
          <div style={styles.grid}>
            {catItems.map(item => (
              <div key={item.id} style={{ ...styles.card, ...(item.owned ? styles.cardOwned : {}) }}>
                <div style={styles.preview}>{item.preview}</div>
                <div style={styles.cardName}>{item.name}</div>
                <div style={styles.cardDesc}>{item.description}</div>

                {item.owned ? (
                  <div style={styles.ownedBadge}>✓ En tu inventario</div>
                ) : (
                  <button
                    style={{
                      ...styles.buyBtn,
                      opacity: (stats?.focus_coins ?? 0) < item.price_fc ? 0.45 : 1,
                      cursor:  buying === item.id ? "wait" : "pointer",
                    }}
                    onClick={() => handleBuy(item)}
                    disabled={!!buying || (stats?.focus_coins ?? 0) < item.price_fc}
                  >
                    {buying === item.id ? "…" : `🪙 ${item.price_fc} FC`}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div style={styles.empty}>La tienda está vacía. Vuelve pronto 🌱</div>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     "100vh",
    background:    "#0f0e0d",
    color:         "#e8e0d5",
    fontFamily:    "system-ui, sans-serif",
    padding:       "24px 16px",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           20,
  },
  center: {
    minHeight:      "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    color:          "#a0998b",
    background:     "#0f0e0d",
  },
  toast: {
    position:     "fixed" as const,
    top:          20,
    left:         "50%",
    transform:    "translateX(-50%)",
    padding:      "10px 20px",
    borderRadius: 8,
    border:       "1px solid",
    fontSize:     14,
    zIndex:       100,
    color:        "#e8e0d5",
    boxShadow:    "0 4px 12px rgba(0,0,0,0.4)",
  },
  header: {
    width:       "100%",
    maxWidth:    600,
    display:     "flex",
    alignItems:  "center",
    gap:         12,
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
  fcBadge: {
    background:   "#1c1816",
    border:       "1px solid #2a2520",
    borderRadius: 8,
    padding:      "6px 14px",
    fontSize:     15,
    color:        "#fbbf24",
  },
  hint: {
    width:     "100%",
    maxWidth:  600,
    fontSize:  13,
    color:     "#6b6358",
    margin:    0,
    textAlign: "center" as const,
  },
  section: {
    width:   "100%",
    maxWidth: 600,
  },
  catTitle: {
    margin:       "0 0 12px 0",
    fontSize:     16,
    fontWeight:   700,
    color:        "#a0998b",
    borderBottom: "1px solid #2a2520",
    paddingBottom: 6,
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap:                 12,
  },
  card: {
    background:    "#1c1816",
    border:        "1px solid #2a2520",
    borderRadius:  12,
    padding:       "16px 12px",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           8,
    textAlign:     "center" as const,
    transition:    "border-color 0.2s",
  },
  cardOwned: {
    border:     "1px solid #2d5a44",
    background: "#0f1f17",
  },
  preview: {
    fontSize:   36,
    lineHeight: 1,
  },
  cardName: {
    fontWeight: 600,
    fontSize:   14,
  },
  cardDesc: {
    fontSize:  11,
    color:     "#6b6358",
    flexGrow:  1,
  },
  buyBtn: {
    background:   "#854d0e",
    border:       "none",
    borderRadius: 8,
    color:        "#fef08a",
    fontWeight:   700,
    fontSize:     13,
    padding:      "6px 14px",
    width:        "100%",
    transition:   "opacity 0.2s",
  },
  ownedBadge: {
    fontSize:   12,
    color:      "#4ade80",
    fontWeight: 600,
  },
  empty: {
    textAlign: "center" as const,
    color:     "#6b6358",
    padding:   40,
    fontSize:  14,
  },
};
