"use client";

/**
 * Fondos de la tienda (categoría "background"), ahora como escena
 * ilustrada en SVG en vez de un simple degradado CSS plano. Mismo criterio
 * que AvatarFrame.tsx: vectorial, sin depender de imágenes externas, y
 * animado con clases de globals.css para que se sienta vivo.
 *
 * Se renderiza como una capa absoluta detrás del contenido de la pantalla
 * — el contenedor que lo use necesita `position: relative; overflow: hidden`
 * y su contenido real un z-index por encima (ver uso en dashboard/page.tsx
 * y session/solo/page.tsx).
 */
import type { CSSProperties } from "react";

export type BgId = "item-bg-lofi-01" | "item-bg-forest-01" | "item-bg-space-01";

const capaStyle: CSSProperties = {
  position:      "absolute",
  inset:         0,
  zIndex:        0,
  overflow:      "hidden",
  pointerEvents: "none",
};

const svgStyle: CSSProperties = { width: "100%", height: "100%", display: "block" };

interface Props {
  bgId: BgId;
}

export function PageBackground({ bgId }: Props) {
  switch (bgId) {
    case "item-bg-lofi-01":   return <EscenaCafe />;
    case "item-bg-forest-01": return <EscenaBosque />;
    case "item-bg-space-01":  return <EscenaCosmos />;
    default: return null;
  }
}

// ── Lofi Café ────────────────────────────────────────────────────────────────
function EscenaCafe() {
  const particulas = [
    { x: 60, y: 30, delay: 0 }, { x: 150, y: 60, delay: 0.8 },
    { x: 260, y: 20, delay: 1.5 }, { x: 330, y: 70, delay: 2.2 },
    { x: 100, y: 110, delay: 0.4 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="cafeCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#3a2416" />
            <stop offset="100%" stopColor="#6b4524" />
          </linearGradient>
          <radialGradient id="cafeVentana" cx="50%" cy="40%" r="60%">
            <stop offset="0%"  stopColor="#ffcf8a" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffcf8a" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="url(#cafeCielo)" />
        {/* ventana con luz cálida */}
        <ellipse cx="300" cy="60" rx="130" ry="100" fill="url(#cafeVentana)" />
        <rect x="250" y="0" width="4" height="140" fill="#2a1a10" opacity={0.5} />
        <rect x="250" y="55" width="150" height="4" fill="#2a1a10" opacity={0.5} />
        {/* planta en la esquina */}
        <path d="M 20 250 L 30 190 Q 10 170 24 150 Q 36 168 34 185 Q 44 165 60 172 Q 52 192 36 196 L 46 250 Z"
              fill="#3f5a3a" opacity={0.85} />
        {/* taza con vapor */}
        <rect x="170" y="210" width="36" height="22" rx="4" fill="#2a1a10" opacity={0.8} />
        <path d="M 206 215 q 10 2 10 10 q 0 8 -10 9" fill="none" stroke="#2a1a10" strokeWidth={3} opacity={0.8} />
        {[0, 1, 2].map(i => (
          <path
            key={i}
            className="sinka-bg-steam"
            style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${182 + i * 10}px 205px` }}
            d={`M ${182 + i * 10} 205 q -4 -10 0 -18 q 4 -8 0 -16`}
            fill="none" stroke="#ffe8c2" strokeWidth={2} strokeLinecap="round" opacity={0.6}
          />
        ))}
        {particulas.map((p, i) => (
          <circle key={i} className="sinka-bg-dust" style={{ animationDelay: `${p.delay}s` }} cx={p.x} cy={p.y} r={1.6} fill="#ffe8c2" />
        ))}
      </svg>
    </div>
  );
}

// ── Bosque Digital ───────────────────────────────────────────────────────────
function EscenaBosque() {
  const abeto = (cx: number, h: number, w: number) =>
    `M ${cx} ${250 - h} L ${cx - w} 250 L ${cx + w} 250 Z`;
  const luciernagas = [
    { x: 70, y: 150 }, { x: 160, y: 190 }, { x: 250, y: 140 },
    { x: 320, y: 200 }, { x: 110, y: 210 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="bosqueCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0d1f14" />
            <stop offset="100%" stopColor="#1e3a26" />
          </linearGradient>
        </defs>
        <rect width="400" height="250" fill="url(#bosqueCielo)" />
        {/* capas de abetos, de atrás (más chico/claro) a adelante */}
        <g opacity={0.35}>
          {[40, 110, 180, 250, 320, 380].map((cx, i) => (
            <path key={i} d={abeto(cx, 90 + (i % 3) * 10, 34)} fill="#2f5d3f" />
          ))}
        </g>
        <g opacity={0.6}>
          {[10, 90, 170, 260, 340].map((cx, i) => (
            <path key={i} d={abeto(cx, 130 + (i % 2) * 14, 44)} fill="#234631" />
          ))}
        </g>
        <g opacity={0.9}>
          {[-10, 70, 200, 300, 400].map((cx, i) => (
            <path key={i} d={abeto(cx, 170 + (i % 3) * 12, 56)} fill="#162c1e" />
          ))}
        </g>
        {/* neblina */}
        <rect x="0" y="185" width="400" height="40" fill="#cfe8d8" opacity={0.08} className="sinka-bg-niebla" />
        {luciernagas.map((l, i) => (
          <circle key={i} className="sinka-frame-ov-twinkle" style={{ animationDelay: `${i * 0.4}s` }} cx={l.x} cy={l.y} r={2.2} fill="#d9f26a" />
        ))}
      </svg>
    </div>
  );
}

// ── Cosmos ───────────────────────────────────────────────────────────────────
function EscenaCosmos() {
  const estrellas = Array.from({ length: 28 }, (_, i) => ({
    x: (i * 53) % 400,
    y: (i * 97) % 250,
    r: 0.6 + ((i * 7) % 5) * 0.25,
    delay: (i % 6) * 0.35,
  }));
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="cosmosCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0b0e2e" />
            <stop offset="100%" stopColor="#1c1038" />
          </linearGradient>
          <radialGradient id="nebulosaA" cx="30%" cy="30%" r="50%">
            <stop offset="0%"  stopColor="#8a5ad1" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#8a5ad1" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="nebulosaB" cx="75%" cy="65%" r="45%">
            <stop offset="0%"  stopColor="#4fa8d8" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4fa8d8" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="url(#cosmosCielo)" />
        <rect width="400" height="250" fill="url(#nebulosaA)" />
        <rect width="400" height="250" fill="url(#nebulosaB)" />
        {/* planeta con anillo */}
        <circle cx="335" cy="55" r="26" fill="#d8a6e0" opacity={0.85} />
        <ellipse cx="335" cy="55" rx="44" ry="9" fill="none" stroke="#f4d9ff" strokeWidth={2.4} opacity={0.6}
                 transform="rotate(-18 335 55)" />
        {estrellas.map((e, i) => (
          <circle key={i} className="sinka-frame-ov-twinkle" style={{ animationDelay: `${e.delay}s` }} cx={e.x} cy={e.y} r={e.r} fill="#ffffff" />
        ))}
        <path className="sinka-bg-estrella-fugaz" d="M 40 40 L 95 70" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" opacity={0} />
      </svg>
    </div>
  );
}
