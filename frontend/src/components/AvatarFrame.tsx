"use client";

/**
 * Decoraciones de avatar al estilo Discord: no son un halo de luz sobre el
 * avatar (como el boxShadow que usábamos antes), sino una ilustración SVG
 * propia que se dibuja ENCIMA y un poco más grande que el círculo del
 * avatar, de forma que hojas/llamas/cristales sobresalen hacia afuera.
 *
 * Técnica: el avatar (img o iniciales) va en un contenedor `position:
 * relative` del tamaño exacto del avatar; este componente se renderiza
 * como hermano, con `position: absolute`, centrado, más grande que el
 * avatar, y `pointer-events: none` para no robarle los clics al botón.
 *
 * Cada diseño es vectorial (no depende de imágenes externas) y se anima
 * con las clases `sinka-frame-ov-*` definidas en globals.css.
 */
import type { CSSProperties } from "react";

export type FrameId =
  | "item-frame-gold"
  | "item-frame-fire"
  | "item-frame-sakura"
  | "item-frame-vine"
  | "item-frame-crystal"
  | "item-frame-storm";

interface Props {
  frameId: FrameId;
  /** Diámetro del avatar que decora, en px (el overlay se dibuja ~45% más grande). */
  size: number;
}

const overlayStyle = (size: number): CSSProperties => ({
  position:      "absolute",
  top:           "50%",
  left:          "50%",
  width:         size * 1.45,
  height:        size * 1.45,
  transform:     "translate(-50%, -50%)",
  pointerEvents: "none",
  overflow:      "visible",
});

// Posiciones radiales reutilizables (grados -> punto sobre un círculo de radio r,
// centrado en 50,50 del viewBox 0..100). Evita repetir trigonometría a mano
// en cada diseño.
function puntoRadial(gradoDeg: number, r: number, cx = 50, cy = 50) {
  const rad = (gradoDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function AvatarFrame({ frameId, size }: Props) {
  switch (frameId) {
    case "item-frame-gold":    return <MarcoLaurel size={size} />;
    case "item-frame-fire":    return <MarcoLlamas size={size} />;
    case "item-frame-sakura":  return <MarcoSakura size={size} />;
    case "item-frame-vine":    return <MarcoEnredadera size={size} />;
    case "item-frame-crystal": return <MarcoCristal size={size} />;
    case "item-frame-storm":   return <MarcoTormenta size={size} />;
    default: return null;
  }
}

// ── Dorado: laureles + destellos ────────────────────────────────────────────
function MarcoLaurel({ size }: { size: number }) {
  const hojaIzq = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4; // 0..1 de abajo hacia arriba
    const ang = 200 - t * 80; // 200deg -> 120deg, bordeando el lado izquierdo
    const { x, y } = puntoRadial(ang, 42);
    return { x, y, rot: ang + 90, s: 1 - t * 0.35 };
  });
  const hojaDer = hojaIzq.map(h => ({ ...h, x: 100 - h.x }));
  const destellos = [{ x: 50, y: 4 }, { x: 20, y: 18 }, { x: 80, y: 18 }];

  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <g className="sinka-frame-ov-sparkle" style={{ transformOrigin: "50% 50%" }}>
        {[...hojaIzq, ...hojaDer].map((h, i) => (
          <ellipse
            key={i}
            cx={h.x} cy={h.y} rx={5 * h.s} ry={2.4 * h.s}
            transform={`rotate(${h.rot} ${h.x} ${h.y})`}
            fill="url(#oroGrad)"
          />
        ))}
      </g>
      {destellos.map((d, i) => (
        <path
          key={i}
          className="sinka-frame-ov-twinkle"
          style={{ animationDelay: `${i * 0.35}s`, transformOrigin: `${d.x}px ${d.y}px` }}
          d={`M ${d.x} ${d.y - 3} L ${d.x + 1} ${d.y} L ${d.x + 3} ${d.y + 0.3} L ${d.x + 1} ${d.y + 0.6} L ${d.x} ${d.y + 3.2} L ${d.x - 1} ${d.y + 0.6} L ${d.x - 3} ${d.y + 0.3} L ${d.x - 1} ${d.y} Z`}
          fill="#fff2b8"
        />
      ))}
      <defs>
        <linearGradient id="oroGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4d976" />
          <stop offset="100%" stopColor="#b8882c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Fuego: llamas que tiemblan ──────────────────────────────────────────────
function MarcoLlamas({ size }: { size: number }) {
  const llamas = [-34, -17, 0, 17, 34].map((offset, i) => ({
    x: 50 + offset,
    delay: (i % 3) * 0.18,
    s: i === 2 ? 1.15 : 1 - Math.abs(offset) / 60,
  }));
  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <defs>
        <linearGradient id="fuegoGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"  stopColor="#ff3d14" />
          <stop offset="55%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#ffb347" />
        </linearGradient>
      </defs>
      {llamas.map((f, i) => (
        <path
          key={i}
          className="sinka-frame-ov-flicker"
          style={{ animationDelay: `${f.delay}s`, transformOrigin: `${f.x}px 92px` }}
          d={`M ${f.x} 96
              C ${f.x - 6 * f.s} 88, ${f.x - 4 * f.s} 80, ${f.x} 72
              C ${f.x + 4 * f.s} 80, ${f.x + 6 * f.s} 88, ${f.x} 96 Z`}
          fill="url(#fuegoGrad)"
          opacity={0.92}
        />
      ))}
    </svg>
  );
}

// ── Sakura: pétalos alrededor + un par cayendo ──────────────────────────────
function MarcoSakura({ size }: { size: number }) {
  const racimos = [15, 70, 140, 220, 290, 340].map((ang, i) => ({
    ...puntoRadial(ang, 41),
    delay: i * 0.3,
  }));
  const petaloPath = (cx: number, cy: number, rot: number, scale: number) =>
    `M ${cx} ${cy} c -2.4 -3.2 -2.4 -7.4 0 -9.6 c 2.4 2.2 2.4 6.4 0 9.6 Z`
      .replace(/-?\d+(\.\d+)?/g, m => (parseFloat(m) * scale).toString());

  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <defs>
        <radialGradient id="sakuraGrad">
          <stop offset="0%"  stopColor="#ffe3ec" />
          <stop offset="100%" stopColor="#ff8fab" />
        </radialGradient>
      </defs>
      {racimos.map((r, i) => (
        <g key={i} className="sinka-frame-ov-sway" style={{ animationDelay: `${r.delay}s`, transformOrigin: `${r.x}px ${r.y}px` }}>
          {[0, 72, 144, 216, 288].map(rot => (
            <path key={rot} d={petaloPath(r.x, r.y, rot, 1)} transform={`rotate(${rot} ${r.x} ${r.y})`} fill="url(#sakuraGrad)" />
          ))}
          <circle cx={r.x} cy={r.y} r={1.3} fill="#ffb7c5" />
        </g>
      ))}
      {/* un par de pétalos sueltos cayendo */}
      {[{ x: 30, delay: 0 }, { x: 68, delay: 1.1 }].map((p, i) => (
        <ellipse
          key={i}
          className="sinka-frame-ov-drift"
          style={{ animationDelay: `${p.delay}s` }}
          cx={p.x} cy={6} rx={2.6} ry={1.6}
          fill="#ff8fab"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

// ── Enredadera: vid con hojas, balanceo suave ───────────────────────────────
function MarcoEnredadera({ size }: { size: number }) {
  const hojas = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 10) * 360;
    const r = 40 + (i % 2) * 2;
    const { x, y } = puntoRadial(ang, r);
    return { x, y, rot: ang };
  });
  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <defs>
        <linearGradient id="hojaGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#8fc98a" />
          <stop offset="100%" stopColor="#2c5f2d" />
        </linearGradient>
      </defs>
      <g className="sinka-frame-ov-sway" style={{ transformOrigin: "50% 50%" }}>
        <circle cx={50} cy={50} r={41} fill="none" stroke="#5c8f6b" strokeWidth={1.1} strokeDasharray="2 3" opacity={0.8} />
        {hojas.map((h, i) => (
          <ellipse
            key={i}
            cx={h.x} cy={h.y} rx={4.2} ry={2.1}
            transform={`rotate(${h.rot} ${h.x} ${h.y})`}
            fill="url(#hojaGrad)"
          />
        ))}
      </g>
    </svg>
  );
}

// ── Cristal: esquirlas que laten ────────────────────────────────────────────
function MarcoCristal({ size }: { size: number }) {
  const esquirlas = [0, 60, 120, 180, 240, 300].map((ang, i) => {
    const base = puntoRadial(ang, 38);
    const punta = puntoRadial(ang, 48);
    const ladoA = puntoRadial(ang - 14, 33);
    const ladoB = puntoRadial(ang + 14, 33);
    return { base, punta, ladoA, ladoB, delay: i * 0.22 };
  });
  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <defs>
        <linearGradient id="cristalGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor="#bdf0ff" />
          <stop offset="100%" stopColor="#1c7293" />
        </linearGradient>
      </defs>
      {esquirlas.map((e, i) => (
        <polygon
          key={i}
          className="sinka-frame-ov-pulse"
          style={{ animationDelay: `${e.delay}s`, transformOrigin: `${e.base.x}px ${e.base.y}px` }}
          points={`${e.ladoA.x},${e.ladoA.y} ${e.punta.x},${e.punta.y} ${e.ladoB.x},${e.ladoB.y}`}
          fill="url(#cristalGrad)"
          stroke="#eafcff"
          strokeWidth={0.4}
        />
      ))}
    </svg>
  );
}

// ── Tormenta: rayos + nubes ──────────────────────────────────────────────────
function MarcoTormenta({ size }: { size: number }) {
  const rayos = [
    { x1: 28, y1: 10, pts: "28,10 24,22 30,22 22,38" },
    { x1: 72, y1: 14, pts: "72,14 67,26 73,26 65,42" },
  ];
  return (
    <svg viewBox="0 0 100 100" style={overlayStyle(size)}>
      <defs>
        <linearGradient id="rayoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="100%" stopColor="#8a6dff" />
        </linearGradient>
      </defs>
      {/* nubes bajas, arco sutil a cada lado */}
      <path d="M 6 58 Q 2 50 12 48 Q 14 40 24 42 Q 30 36 38 42 Q 46 40 46 50 Q 50 58 40 60 Z"
            fill="#4a3f6b" opacity={0.75} className="sinka-frame-ov-sway" style={{ transformOrigin: "20px 50px" }} />
      <path d="M 94 58 Q 98 50 88 48 Q 86 40 76 42 Q 70 36 62 42 Q 54 40 54 50 Q 50 58 60 60 Z"
            fill="#4a3f6b" opacity={0.75} className="sinka-frame-ov-sway" style={{ transformOrigin: "80px 50px", animationDelay: "0.6s" }} />
      {rayos.map((r, i) => (
        <polyline
          key={i}
          className="sinka-frame-ov-flash"
          style={{ animationDelay: `${i * 0.5}s` }}
          points={r.pts}
          fill="none"
          stroke="url(#rayoGrad)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
