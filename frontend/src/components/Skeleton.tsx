/**
 * Componente de loading skeleton reutilizable.
 *
 * Uso:
 *   <Skeleton width="100%" height={20} />
 *   <Skeleton width={120} height={16} borderRadius={8} />
 *   <SkeletonCard />  — tarjeta predefinida para stats / leaderboard
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 6,
  style,
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background:   "linear-gradient(90deg, #1c1816 25%, #2a2520 50%, #1c1816 75%)",
        backgroundSize: "200% 100%",
        animation:    "skeleton-shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

/** Skeleton para una fila del leaderboard */
export function SkeletonLeaderboardRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#1c1816", border: "1px solid #2a2520" }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <Skeleton width={36} height={36} borderRadius="50%" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <Skeleton width={60} height={16} />
        <Skeleton width={30} height={11} />
      </div>
    </div>
  );
}

/** Skeleton para una tarjeta de la tienda */
export function SkeletonShopCard() {
  return (
    <div style={{ background: "#1c1816", border: "1px solid #2a2520", borderRadius: 12, padding: "16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <Skeleton width={48} height={48} borderRadius={8} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="90%" height={11} />
      <Skeleton width="60%" height={30} borderRadius={8} />
    </div>
  );
}

/** Skeleton para el panel de stats del dashboard */
export function SkeletonStatCard() {
  return (
    <div style={{ background: "#1c1816", border: "1px solid #2a2520", borderRadius: 12, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton width="50%" height={14} />
      <Skeleton width="70%" height={28} />
      <Skeleton width="100%" height={8} borderRadius={4} />
      <Skeleton width="40%" height={11} />
    </div>
  );
}

// Inyectar animación globalmente (solo una vez)
if (typeof document !== "undefined") {
  const STYLE_ID = "__sinka_skeleton_style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes skeleton-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
