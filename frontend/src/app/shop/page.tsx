"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag, Coins, Image as ImageIcon, Sprout, Wand2, Music,
  CheckCircle2, XCircle, Check, CreditCard, type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
  shopApi, gamificationApi, paymentsApi,
  type ShopItem, type UserStats, type CoinPack, ApiError,
} from "@/lib/api";
import { SkeletonShopCard } from "@/components/Skeleton";
import { color, radius, pageBackground } from "@/lib/theme";

const CATEGORY_LABELS: Record<string, { texto: string; Icono: ComponentType<LucideProps> }> = {
  background:   { texto: "Fondos",          Icono: ImageIcon },
  plant_skin:   { texto: "Skins de Planta", Icono: Sprout },
  avatar_frame: { texto: "Marcos de Avatar", Icono: Wand2 },
  music:        { texto: "Música",          Icono: Music },
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopPageInner />
    </Suspense>
  );
}

function ShopPageInner() {
  const router                       = useRouter();
  const searchParams                 = useSearchParams();
  const { accessToken: token, user, hidratado } = useAuthStore();

  const [items,   setItems]   = useState<ShopItem[]>([]);
  const [stats,   setStats]   = useState<UserStats | null>(null);
  const [packs,   setPacks]   = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying,  setBuying]  = useState<string | null>(null);
  const [comprandoPack, setComprandoPack] = useState<string | null>(null);
  const [toast,   setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [shopItems, userStats, coinPacks] = await Promise.all([
        shopApi.getItems(token),
        gamificationApi.getStats(token),
        paymentsApi.getPacks().catch((): CoinPack[] => []),
      ]);
      setItems(shopItems);
      setStats(userStats);
      setPacks(coinPacks);
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

  // Vuelta desde Stripe Checkout (exito o cancelado)
  useEffect(() => {
    const pago = searchParams.get("pago");
    if (pago === "exito") {
      showToast("¡Pago recibido! Tus FocusCoins se acreditan en cuanto Stripe confirme el cobro.", true);
      fetchData();
    } else if (pago === "cancelado") {
      showToast("Compra cancelada. No se realizó ningún cobro.", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleComprarCoins = async (pack: CoinPack) => {
    if (!token || comprandoPack) return;
    setComprandoPack(pack.id);
    try {
      const { checkout_url } = await paymentsApi.createCheckout(token, pack.id);
      window.location.href = checkout_url;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "No se pudo iniciar el pago.";
      showToast(msg, false);
      setComprandoPack(null);
    }
  };

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
        <div style={{ ...styles.toast, background: toast.ok ? color.mossSoft : color.accentSoft, borderColor: toast.ok ? color.moss : color.accent, display: "flex", alignItems: "center", gap: 7 }}>
          {toast.ok ? <CheckCircle2 size={15} strokeWidth={2} /> : <XCircle size={15} strokeWidth={2} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => router.push("/dashboard")} style={styles.back}>← Dashboard</button>
        <h1 style={styles.title}><ShoppingBag size={20} strokeWidth={2} /> Tienda</h1>
        <div style={styles.fcBadge}>
          <Coins size={14} strokeWidth={2} /> <strong>{stats?.focus_coins ?? 0}</strong> FC
        </div>
      </div>

      <p style={styles.hint}>
        Gana FocusCoins completando sesiones de enfoque. ¡Compra cosméticos para personalizar tu espacio!
      </p>

      {/* Comprar FocusCoins con dinero real */}
      {packs.length > 0 && (
        <div style={styles.section}>
          <h2 style={styles.catTitle}>
            <CreditCard size={16} strokeWidth={2} /> Comprar FocusCoins
          </h2>
          <div style={styles.grid}>
            {packs.map((pack) => (
              <div key={pack.id} style={styles.card}>
                <div style={styles.preview}><Coins size={30} strokeWidth={1.5} /></div>
                <div style={styles.cardName}>{pack.nombre}</div>
                <div style={styles.cardDesc}>{pack.coins} FocusCoins</div>
                <button
                  style={{
                    ...styles.buyBtn,
                    cursor: comprandoPack === pack.id ? "wait" : "pointer",
                  }}
                  disabled={!!comprandoPack}
                  onClick={() => handleComprarCoins(pack)}
                >
                  {comprandoPack === pack.id ? "…" : `$${(pack.precio_centavos / 100).toFixed(2)}`}
                </button>
              </div>
            ))}
          </div>
          <p style={{ ...styles.hint, marginTop: 8 }}>
            Pago seguro procesado por Stripe. SINKA nunca ve ni guarda tu tarjeta.
          </p>
        </div>
      )}

      {/* Secciones por categoría */}
      {Object.entries(byCategory).map(([cat, catItems]) => {
        const catInfo = CATEGORY_LABELS[cat];
        const CatIcono = catInfo?.Icono;
        return (
        <div key={cat} style={styles.section}>
          <h2 style={styles.catTitle}>
            {catInfo && CatIcono
              ? <><CatIcono size={16} strokeWidth={2} /> {catInfo.texto}</>
              : cat}
          </h2>
          <div style={styles.grid}>
            {catItems.map(item => (
              <div key={item.id} style={{ ...styles.card, ...(item.owned ? styles.cardOwned : {}) }}>
                <div style={styles.preview}>{item.preview}</div>
                <div style={styles.cardName}>{item.name}</div>
                <div style={styles.cardDesc}>{item.description}</div>

                {item.owned ? (
                  <div style={styles.ownedBadge}><Check size={13} strokeWidth={2} /> En tu inventario</div>
                ) : (
                  <button
                    style={{
                      ...styles.buyBtn,
                      opacity: (stats?.focus_coins ?? 0) < item.price_fc ? 0.45 : 1,
                      cursor:  buying === item.id ? "wait" : "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                    onClick={() => handleBuy(item)}
                    disabled={!!buying || (stats?.focus_coins ?? 0) < item.price_fc}
                  >
                    {buying === item.id ? "…" : <><Coins size={13} strokeWidth={2} /> {item.price_fc} FC</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ ...styles.empty, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          La tienda está vacía. Vuelve pronto <Sprout size={14} strokeWidth={2} />
        </div>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:     "100vh",
    background:    pageBackground,
    color:         color.text,
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
    color:          color.textMuted,
    background:     color.bg,
  },
  toast: {
    position:     "fixed" as const,
    top:          20,
    left:         "50%",
    transform:    "translateX(-50%)",
    padding:      "10px 20px",
    borderRadius: radius.sm,
    border:       "1px solid",
    fontSize:     14,
    zIndex:       100,
    color:        color.text,
    boxShadow:    "0 4px 12px rgba(var(--c-shadow), 0.4)",
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
    color:        color.textMuted,
    cursor:       "pointer",
    fontSize:     14,
    padding:      "4px 8px",
    borderRadius: radius.sm,
  },
  title: {
    flex:       1,
    display:    "inline-flex",
    alignItems: "center",
    gap:        8,
    margin:     0,
    fontSize:   22,
    fontWeight: 700,
  },
  fcBadge: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    background:   color.surface,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.sm,
    padding:      "6px 14px",
    fontSize:     15,
    color:        color.sand,
  },
  hint: {
    width:     "100%",
    maxWidth:  600,
    fontSize:  13,
    color:     color.textFaint,
    margin:    0,
    textAlign: "center" as const,
  },
  section: {
    width:   "100%",
    maxWidth: 600,
  },
  catTitle: {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           7,
    margin:        "0 0 12px 0",
    fontSize:      16,
    fontWeight:    700,
    color:         color.textMuted,
    borderBottom:  `1px solid ${color.border}`,
    paddingBottom: 6,
    width:         "100%",
  },
  grid: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap:                 12,
  },
  card: {
    background:    color.surface,
    border:        `1px solid ${color.border}`,
    borderRadius:  radius.md,
    padding:       "16px 12px",
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           8,
    textAlign:     "center" as const,
    transition:    "border-color 0.2s",
  },
  cardOwned: {
    border:     `1px solid ${color.moss}`,
    background: color.mossSoft,
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
    color:     color.textFaint,
    flexGrow:  1,
  },
  buyBtn: {
    background:   color.accentDeep,
    border:       "none",
    borderRadius: radius.sm,
    color:        color.text,
    fontWeight:   700,
    fontSize:     13,
    padding:      "6px 14px",
    width:        "100%",
    transition:   "opacity 0.2s",
  },
  ownedBadge: {
    display:    "inline-flex",
    alignItems: "center",
    gap:        5,
    fontSize:   12,
    color:      color.success,
    fontWeight: 600,
  },
  empty: {
    textAlign: "center" as const,
    color:     color.textFaint,
    padding:   40,
    fontSize:  14,
  },
};
