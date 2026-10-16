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

export type BgId =
  | "item-bg-lofi-01"
  | "item-bg-forest-01"
  | "item-bg-space-01"
  | "item-bg-sakura"
  | "item-bg-ocean"
  | "item-bg-rain"
  | "item-bg-mountain"
  | "item-bg-library";

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
    case "item-bg-sakura":    return <EscenaSakura />;
    case "item-bg-ocean":     return <EscenaOcean />;
    case "item-bg-rain":      return <EscenaLluvia />;
    case "item-bg-mountain":  return <EscenaMontana />;
    case "item-bg-library":   return <EscenaBiblioteca />;
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

// ── Jardín de Cerezos ───────────────────────────────────────────────────────
function EscenaSakura() {
  const petalos = [
    { x: 40, delay: 0 }, { x: 110, delay: 1.1 }, { x: 180, delay: 2.3 },
    { x: 250, delay: 0.6 }, { x: 320, delay: 1.8 }, { x: 370, delay: 3 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="sakuraCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#fbe4ec" />
            <stop offset="100%" stopColor="#d99bb5" />
          </linearGradient>
          <radialGradient id="sakuraSol" cx="75%" cy="20%" r="40%">
            <stop offset="0%"  stopColor="#fff3dd" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#fff3dd" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="url(#sakuraCielo)" />
        <ellipse cx="300" cy="50" rx="120" ry="90" fill="url(#sakuraSol)" />
        {/* rama de cerezo desde la esquina superior izquierda */}
        <path d="M -10 0 Q 60 30 90 70 Q 110 95 140 100" fill="none" stroke="#5a3a3a" strokeWidth={5} opacity={0.75} />
        <path d="M 40 20 Q 60 40 55 65" fill="none" stroke="#5a3a3a" strokeWidth={3} opacity={0.7} />
        {[[55, 25], [75, 45], [95, 68], [50, 50], [120, 92]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={9} fill="#f6b8cf" opacity={0.85} />
        ))}
        {/* silueta de arbol al fondo */}
        <path d="M 0 250 Q 40 170 90 185 Q 130 195 160 250 Z" fill="#c97ba0" opacity={0.3} />
        {petalos.map((p, i) => (
          <path
            key={i}
            className="sinka-bg-petalo"
            style={{ animationDelay: `${p.delay}s`, transformOrigin: `${p.x}px 0px` }}
            d={`M ${p.x} 0 q 4 -3 7 0 q -1 4 -7 4 q -6 0 -7 -4 q 3 -3 7 0 Z`}
            fill="#fbd3e2"
          />
        ))}
      </svg>
    </div>
  );
}

// ── Atardecer en Playa ───────────────────────────────────────────────────────
function EscenaOcean() {
  const brillos = [
    { x: 60, y: 165, delay: 0 }, { x: 140, y: 180, delay: 0.7 },
    { x: 230, y: 170, delay: 1.3 }, { x: 310, y: 190, delay: 0.4 },
    { x: 370, y: 160, delay: 1.8 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="oceanCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#3d4b7a" />
            <stop offset="55%" stopColor="#ff9a6c" />
            <stop offset="100%" stopColor="#ffd59a" />
          </linearGradient>
          <linearGradient id="oceanAgua" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#2a6f8a" />
            <stop offset="100%" stopColor="#174458" />
          </linearGradient>
          <radialGradient id="oceanSol" cx="50%" cy="100%" r="60%">
            <stop offset="0%"  stopColor="#fff3cf" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#fff3cf" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="150" fill="url(#oceanCielo)" />
        <circle cx="200" cy="150" r="34" fill="url(#oceanSol)" className="sinka-frame-ov-pulse" />
        <circle cx="200" cy="150" r="22" fill="#ffe3a8" opacity={0.9} />
        <rect y="150" width="400" height="100" fill="url(#oceanAgua)" />
        {/* siluetas de gaviotas */}
        <path d="M 60 50 q 8 -8 16 0 q 8 -8 16 0" fill="none" stroke="#2a2440" strokeWidth={1.6} opacity={0.5} />
        <path d="M 260 70 q 6 -6 12 0 q 6 -6 12 0" fill="none" stroke="#2a2440" strokeWidth={1.4} opacity={0.4} />
        {brillos.map((b, i) => (
          <ellipse key={i} className="sinka-bg-ola" style={{ animationDelay: `${b.delay}s` }} cx={b.x} cy={b.y} rx={22} ry={3} fill="#ffe3a8" />
        ))}
      </svg>
    </div>
  );
}

// ── Lluvia en Ventana ────────────────────────────────────────────────────────
function EscenaLluvia() {
  const gotas = [
    { x: 30, delay: 0 }, { x: 70, delay: 0.3 }, { x: 110, delay: 0.1 },
    { x: 160, delay: 0.5 }, { x: 210, delay: 0.2 }, { x: 250, delay: 0.6 },
    { x: 300, delay: 0.15 }, { x: 340, delay: 0.45 }, { x: 375, delay: 0.3 },
  ];
  const luces = [
    { x: 50, y: 150, r: 10 }, { x: 140, y: 170, r: 14 },
    { x: 260, y: 155, r: 9 }, { x: 330, y: 175, r: 12 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="lluviaCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#141c30" />
            <stop offset="100%" stopColor="#3a4a68" />
          </linearGradient>
        </defs>
        <rect width="400" height="250" fill="url(#lluviaCielo)" />
        {/* ciudad borrosa */}
        {[30, 90, 150, 210, 270, 330].map((x, i) => (
          <rect key={i} x={x} y={250 - (60 + (i % 3) * 25)} width={34} height={60 + (i % 3) * 25} fill="#0f1526" opacity={0.6} />
        ))}
        {luces.map((l, i) => (
          <circle key={i} className="sinka-frame-ov-flicker" cx={l.x} cy={l.y} r={l.r} fill="#ffd79a" opacity={0.5} />
        ))}
        <rect width="400" height="250" fill="#eaf2ff" opacity={0} className="sinka-bg-rayo" />
        {/* gotas en el cristal */}
        {gotas.map((g, i) => (
          <line
            key={i}
            className="sinka-bg-lluvia"
            style={{ animationDelay: `${g.delay}s` }}
            x1={g.x} y1="0" x2={g.x - 4} y2="22"
            stroke="#cfe0ff" strokeWidth={1.6} strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}

// ── Montaña al Amanecer ──────────────────────────────────────────────────────
function EscenaMontana() {
  const pico = (cx: number, h: number, w: number) =>
    `M ${cx} ${250 - h} L ${cx - w} 250 L ${cx + w} 250 Z`;
  const nieve = Array.from({ length: 6 }, (_, i) => ({
    x: (i * 61) % 400, delay: (i % 4) * 1.4,
  }));
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="montanaCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#e8d6e0" />
            <stop offset="60%" stopColor="#d7c3dc" />
            <stop offset="100%" stopColor="#7d93b5" />
          </linearGradient>
          <radialGradient id="montanaSol" cx="50%" cy="35%" r="35%">
            <stop offset="0%"  stopColor="#fff0cf" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#fff0cf" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="url(#montanaCielo)" />
        <circle cx="200" cy="90" r="28" fill="url(#montanaSol)" className="sinka-frame-ov-pulse" />
        <g opacity={0.45}>
          {[20, 120, 220, 320].map((cx, i) => (
            <path key={i} d={pico(cx, 110 + (i % 2) * 14, 70)} fill="#8f9fc2" />
          ))}
        </g>
        <g opacity={0.75}>
          {[-20, 90, 210, 330, 420].map((cx, i) => (
            <path key={i} d={pico(cx, 150 + (i % 3) * 16, 90)} fill="#5f6f93" />
          ))}
        </g>
        {/* nieve en las cumbres */}
        <path d="M -20 100 L 50 150 L -20 150 Z" fill="#f4eef7" opacity={0.6} />
        <path d="M 90 136 L 150 180 L 90 180 L 60 150 Z" fill="#f4eef7" opacity={0.6} />
        <path d="M 330 150 L 390 190 L 330 190 L 300 170 Z" fill="#f4eef7" opacity={0.6} />
        {nieve.map((n, i) => (
          <circle key={i} className="sinka-bg-nieve" style={{ animationDelay: `${n.delay}s` }} cx={n.x} cy="0" r={1.8} fill="#ffffff" />
        ))}
      </svg>
    </div>
  );
}

// ── Biblioteca Cálida ────────────────────────────────────────────────────────
function EscenaBiblioteca() {
  const coloresLibros = ["#8a6238", "#a9733c", "#6b4a26", "#b8854a", "#5a3d20"];
  const polvo = [
    { x: 190, y: 90, delay: 0 }, { x: 210, y: 130, delay: 0.9 },
    { x: 175, y: 160, delay: 1.6 }, { x: 225, y: 70, delay: 0.5 },
  ];
  return (
    <div style={capaStyle}>
      <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
        <defs>
          <linearGradient id="bibliotecaCielo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#241608" />
            <stop offset="100%" stopColor="#4a2f17" />
          </linearGradient>
          <radialGradient id="bibliotecaLuz" cx="50%" cy="30%" r="45%">
            <stop offset="0%"  stopColor="#ffdca0" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffdca0" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect width="400" height="250" fill="url(#bibliotecaCielo)" />
        {/* estanterias con libros a ambos lados */}
        {[0, 1, 2].map((fila) => (
          <g key={fila}>
            {Array.from({ length: 10 }, (_, i) => (
              <rect
                key={i}
                x={10 + i * 15}
                y={30 + fila * 55}
                width={11}
                height={42}
                fill={coloresLibros[(i + fila) % coloresLibros.length]}
                opacity={0.8}
              />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <rect
                key={`r${i}`}
                x={260 + i * 15}
                y={30 + fila * 55}
                width={11}
                height={42}
                fill={coloresLibros[(i + fila + 2) % coloresLibros.length]}
                opacity={0.8}
              />
            ))}
          </g>
        ))}
        {/* haz de luz de la lampara */}
        <ellipse cx="200" cy="90" rx="110" ry="130" fill="url(#bibliotecaLuz)" />
        {/* pantalla de lampara */}
        <path d="M 185 40 L 215 40 L 225 65 L 175 65 Z" fill="#2a1a0d" opacity={0.85} />
        <rect x="198" y="65" width="4" height="30" fill="#2a1a0d" opacity={0.85} />
        {polvo.map((p, i) => (
          <circle key={i} className="sinka-bg-dust" style={{ animationDelay: `${p.delay}s` }} cx={p.x} cy={p.y} r={1.4} fill="#ffe8c2" />
        ))}
      </svg>
    </div>
  );
}
