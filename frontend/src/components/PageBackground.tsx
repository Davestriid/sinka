"use client";

/**
 * Fondos de la tienda (categoría "background"), ahora como escena
 * ilustrada en SVG en vez de un simple degradado CSS plano. Mismo criterio
 * que AvatarFrame.tsx: vectorial, sin depender de imágenes externas, y
 * animado con clases de globals.css para que se sienta vivo.
 *
 * Posicionamiento: por defecto la escena se fija a la ventana (`position:
 * fixed`), no al contenedor de la página. Esto importa porque páginas largas
 * (la Tienda con muchos artículos, por ejemplo) pueden medir miles de
 * píxeles de alto — si la escena se estirara para "cubrir" ese alto entero
 * con `preserveAspectRatio="slice"`, terminaría recortada a un zoom
 * absurdo (un planeta gigante ocupando toda la pantalla, por ejemplo). Fija
 * a la ventana, la escena siempre se ve con las proporciones con las que se
 * diseñó, sin importar cuánto mida el contenido debajo — y de paso no hay
 * "corte" visible nunca, porque nunca se desplaza: el contenido se desplaza
 * encima suyo. Para las miniaturas chiquitas de la tienda (catálogo y vista
 * previa), que sí necesitan quedar recortadas dentro de su propia tarjeta en
 * vez de ocupar la ventana entera, se usa `contenido` (ver más abajo).
 */
import type { CSSProperties } from "react";
import { useTheme } from "@/components/ThemeProvider";

export type BgId =
  | "item-bg-lofi-01"
  | "item-bg-forest-01"
  | "item-bg-space-01"
  | "item-bg-sakura"
  | "item-bg-ocean"
  | "item-bg-rain"
  | "item-bg-mountain"
  | "item-bg-library";

function capaStyle(contenido: boolean): CSSProperties {
  return {
    position:      contenido ? "absolute" : "fixed",
    inset:         0,
    zIndex:        0,
    overflow:      "hidden",
    pointerEvents: "none",
  };
}

const svgStyle: CSSProperties = { width: "100%", height: "100%", display: "block" };

// Viñeta sutil (oscurece las esquinas) para dar algo de profundidad a
// cualquier escena sin tener que retocar cada una por separado.
const vineta: CSSProperties = {
  position:      "absolute",
  inset:         0,
  background:    "radial-gradient(ellipse at 50% 45%, transparent 50%, rgba(0,0,0,0.32) 100%)",
  pointerEvents: "none",
};

// Escenas pintadas con una paleta clara/pastel (cielo rosado, nieve, amanecer
// suave): se ven preciosas en modo claro, pero sobre el modo oscuro quedan
// demasiado brillantes y chocan con el resto de la interfaz (texto, bordes y
// tarjetas pensados para fondos oscuros pierden contraste). El resto de
// escenas ya son de paleta oscura y se leen bien en los dos temas sin tocar
// nada. Ver globals.css si se agrega una escena nueva con el mismo problema.
const ESCENAS_CLARAS = new Set<BgId>(["item-bg-sakura", "item-bg-mountain"]);

const scrimOscuro: CSSProperties = {
  position:      "absolute",
  inset:         0,
  background:    "rgba(12, 8, 16, 0.45)",
  pointerEvents: "none",
};

interface Props {
  bgId: BgId;
  /** true cuando la escena se dibuja dentro de un recuadro chico (miniatura
   *  de catálogo, vista previa) en vez de ser el fondo de toda la pantalla.
   *  En ese caso queda recortada a su propio contenedor en vez de fijarse a
   *  la ventana. Ver nota de arriba. */
  contenido?: boolean;
}

export function PageBackground({ bgId, contenido = false }: Props) {
  const { tema } = useTheme();

  const svg = (() => {
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
  })();

  if (!svg) return null;

  return (
    <div style={capaStyle(contenido)}>
      {svg}
      <div style={vineta} />
      {tema === "dark" && ESCENAS_CLARAS.has(bgId) && <div style={scrimOscuro} />}
    </div>
  );
}

// ── Lofi Café ────────────────────────────────────────────────────────────────
function EscenaCafe() {
  const particulas = [
    { x: 60, y: 30, delay: 0 }, { x: 150, y: 60, delay: 0.8 },
    { x: 260, y: 20, delay: 1.5 }, { x: 330, y: 70, delay: 2.2 },
    { x: 100, y: 110, delay: 0.4 }, { x: 220, y: 140, delay: 1.1 },
  ];
  return (
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
      {/* ventana con luz cálida y, afuera, los techos de la ciudad */}
      <ellipse cx="300" cy="60" rx="130" ry="100" fill="url(#cafeVentana)" />
      {[260, 285, 312, 338, 366].map((x, i) => (
        <rect key={i} x={x} y={95 - (i % 3) * 10} width={16} height={45 + (i % 3) * 10} fill="#1d1208" opacity={0.55} />
      ))}
      <rect x="250" y="0" width="4" height="140" fill="#2a1a10" opacity={0.5} />
      <rect x="250" y="55" width="150" height="4" fill="#2a1a10" opacity={0.5} />
      {/* repisa con libros apilados y una planta más grande en la esquina */}
      <rect x="0" y="146" width="250" height="6" fill="#2a1a10" opacity={0.6} />
      {[[8, 20, "#8a4a3c"], [30, 16, "#4a6a5a"], [48, 22, "#b88a4a"]].map(([x, w, c], i) => (
        <rect key={i} x={x as number} y={146 - 24} width={w as number} height={24} fill={c as string} opacity={0.8} />
      ))}
      <path d="M 20 250 L 30 190 Q 10 170 24 150 Q 36 168 34 185 Q 44 165 60 172 Q 52 192 36 196 L 46 250 Z"
            fill="#3f5a3a" opacity={0.85} />
      <path d="M 10 250 L 16 205 Q 2 192 12 176 Q 20 190 18 202 Z" fill="#355046" opacity={0.75} />
      {/* taza con vapor */}
      <rect x="170" y="210" width="36" height="22" rx="4" fill="#2a1a10" opacity={0.8} />
      <path d="M 206 215 q 10 2 10 10 q 0 8 -10 9" fill="none" stroke="#2a1a10" strokeWidth={3} opacity={0.8} />
      {/* granos de café dispersos sobre la repisa inferior */}
      {[[130, 240], [148, 244], [120, 236], [165, 242]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={3} ry={2} fill="#2a1a10" opacity={0.5} transform={`rotate(${i * 35} ${x} ${y})`} />
      ))}
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
  );
}

// ── Bosque Digital ───────────────────────────────────────────────────────────
function EscenaBosque() {
  const abeto = (cx: number, h: number, w: number) =>
    `M ${cx} ${250 - h} L ${cx - w} 250 L ${cx + w} 250 Z`;
  const luciernagas = [
    { x: 70, y: 150 }, { x: 160, y: 190 }, { x: 250, y: 140 },
    { x: 320, y: 200 }, { x: 110, y: 210 }, { x: 200, y: 170 }, { x: 60, y: 230 },
  ];
  const estrellas = [
    { x: 40, y: 20 }, { x: 120, y: 35 }, { x: 300, y: 18 }, { x: 350, y: 45 }, { x: 220, y: 25 },
  ];
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        <linearGradient id="bosqueCielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#0d1f14" />
          <stop offset="100%" stopColor="#1e3a26" />
        </linearGradient>
        <radialGradient id="bosqueLuna" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="#eaf6d8" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#eaf6d8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#bosqueCielo)" />
      {/* luna con halo, y estrellas tenues arriba de la copa de los árboles */}
      <circle cx="330" cy="45" r="40" fill="url(#bosqueLuna)" />
      <circle cx="330" cy="45" r="16" fill="#eef7e0" opacity={0.9} />
      {estrellas.map((e, i) => (
        <circle key={i} className="sinka-frame-ov-twinkle" style={{ animationDelay: `${i * 0.5}s` }} cx={e.x} cy={e.y} r={1.1} fill="#dff0e6" />
      ))}
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
      {/* siluetas de un par de pájaros nocturnos */}
      <path d="M 90 60 q 7 -7 14 0 q 7 -7 14 0" fill="none" stroke="#0a1810" strokeWidth={1.4} opacity={0.6} />
      {/* neblina en dos franjas, para dar sensación de capas */}
      <rect x="0" y="185" width="400" height="40" fill="#cfe8d8" opacity={0.08} className="sinka-bg-niebla" />
      <rect x="0" y="222" width="400" height="20" fill="#cfe8d8" opacity={0.06} className="sinka-bg-niebla" style={{ animationDelay: "1.5s" }} />
      {luciernagas.map((l, i) => (
        <circle key={i} className="sinka-frame-ov-twinkle" style={{ animationDelay: `${i * 0.4}s` }} cx={l.x} cy={l.y} r={2.2} fill="#d9f26a" />
      ))}
    </svg>
  );
}

// ── Cosmos ───────────────────────────────────────────────────────────────────
function EscenaCosmos() {
  const estrellas = Array.from({ length: 40 }, (_, i) => ({
    x: (i * 53) % 400,
    y: (i * 97) % 250,
    r: 0.6 + ((i * 7) % 5) * 0.25,
    delay: (i % 6) * 0.35,
  }));
  return (
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
        <radialGradient id="nebulosaC" cx="15%" cy="80%" r="35%">
          <stop offset="0%"  stopColor="#e879a8" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#e879a8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#cosmosCielo)" />
      <rect width="400" height="250" fill="url(#nebulosaA)" />
      <rect width="400" height="250" fill="url(#nebulosaB)" />
      <rect width="400" height="250" fill="url(#nebulosaC)" />
      {/* galaxia espiral lejana */}
      <g opacity={0.5} transform="translate(70 170) rotate(-20)">
        <ellipse rx="26" ry="9" fill="none" stroke="#c9b8f5" strokeWidth={1.2} opacity={0.6} />
        <ellipse rx="17" ry="5.5" fill="none" stroke="#c9b8f5" strokeWidth={1} opacity={0.5} />
        <circle r="3" fill="#f4ecff" />
      </g>
      {/* planeta grande con anillo */}
      <circle cx="335" cy="55" r="26" fill="#d8a6e0" opacity={0.85} />
      <circle cx="328" cy="48" r="8" fill="#c38fd0" opacity={0.5} />
      <ellipse cx="335" cy="55" rx="44" ry="9" fill="none" stroke="#f4d9ff" strokeWidth={2.4} opacity={0.6}
               transform="rotate(-18 335 55)" />
      {/* luna pequeña cerca del planeta */}
      <circle cx="385" cy="30" r="7" fill="#eee0f8" opacity={0.75} />
      {estrellas.map((e, i) => (
        <circle key={i} className="sinka-frame-ov-twinkle" style={{ animationDelay: `${e.delay}s` }} cx={e.x} cy={e.y} r={e.r} fill="#ffffff" />
      ))}
      <path className="sinka-bg-estrella-fugaz" d="M 40 40 L 95 70" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" opacity={0} />
      <path className="sinka-bg-estrella-fugaz" style={{ animationDelay: "3.2s" }} d="M 200 15 L 250 38" stroke="#ffffff" strokeWidth={1.2} strokeLinecap="round" opacity={0} />
    </svg>
  );
}

// ── Jardín de Cerezos ───────────────────────────────────────────────────────
function EscenaSakura() {
  const petalos = [
    { x: 40, delay: 0 }, { x: 110, delay: 1.1 }, { x: 180, delay: 2.3 },
    { x: 250, delay: 0.6 }, { x: 320, delay: 1.8 }, { x: 370, delay: 3 },
    { x: 20, delay: 2.6 }, { x: 290, delay: 0.9 },
  ];
  return (
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
      {/* nubes lejanas */}
      <g opacity={0.5} className="sinka-bg-niebla">
        <ellipse cx="90" cy="35" rx="34" ry="9" fill="#ffffff" />
        <ellipse cx="115" cy="30" rx="24" ry="7" fill="#ffffff" />
      </g>
      <g opacity={0.4} className="sinka-bg-niebla" style={{ animationDelay: "2s" }}>
        <ellipse cx="230" cy="22" rx="28" ry="7" fill="#ffffff" />
      </g>
      {/* montaña lejana difuminada detrás del jardín */}
      <path d="M -20 180 Q 80 120 180 170 Q 260 140 420 185 L 420 250 L -20 250 Z" fill="#e3b4c8" opacity={0.35} />
      {/* rama de cerezo desde la esquina superior izquierda */}
      <path d="M -10 0 Q 60 30 90 70 Q 110 95 140 100" fill="none" stroke="#5a3a3a" strokeWidth={5} opacity={0.75} />
      <path d="M 40 20 Q 60 40 55 65" fill="none" stroke="#5a3a3a" strokeWidth={3} opacity={0.7} />
      {[[55, 25], [75, 45], [95, 68], [50, 50], [120, 92]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={9} fill="#f6b8cf" opacity={0.85} />
      ))}
      {/* segunda rama, esquina inferior derecha, apuntando hacia adentro */}
      <path d="M 410 250 Q 360 220 340 190 Q 330 170 310 165" fill="none" stroke="#5a3a3a" strokeWidth={4} opacity={0.7} />
      {[[335, 180], [350, 200], [320, 172]].map(([cx, cy], i) => (
        <circle key={`b${i}`} cx={cx} cy={cy} r={7} fill="#f6b8cf" opacity={0.8} />
      ))}
      {/* silueta de arbol al fondo + pasto con florecitas al pie */}
      <path d="M 0 250 Q 40 170 90 185 Q 130 195 160 250 Z" fill="#c97ba0" opacity={0.3} />
      <path d="M 0 250 L 0 236 Q 60 228 130 236 L 400 236 L 400 250 Z" fill="#8a5a78" opacity={0.3} />
      {[30, 70, 110, 250, 300, 350].map((x, i) => (
        <circle key={i} cx={x} cy={240 + (i % 2) * 4} r={2.2} fill="#fbd3e2" opacity={0.7} />
      ))}
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
  );
}

// ── Atardecer en Playa ───────────────────────────────────────────────────────
function EscenaOcean() {
  const brillos = [
    { x: 60, y: 165, delay: 0 }, { x: 140, y: 180, delay: 0.7 },
    { x: 230, y: 170, delay: 1.3 }, { x: 310, y: 190, delay: 0.4 },
    { x: 370, y: 160, delay: 1.8 }, { x: 20, y: 200, delay: 1.0 },
  ];
  return (
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
      {/* nubes finas cruzando el cielo */}
      <g opacity={0.35} className="sinka-bg-niebla">
        <ellipse cx="80" cy="30" rx="40" ry="6" fill="#ffd9b0" />
        <ellipse cx="310" cy="45" rx="30" ry="5" fill="#ffd9b0" />
      </g>
      <circle cx="200" cy="150" r="34" fill="url(#oceanSol)" className="sinka-frame-ov-pulse" />
      <circle cx="200" cy="150" r="22" fill="#ffe3a8" opacity={0.9} />
      <rect y="150" width="400" height="100" fill="url(#oceanAgua)" />
      {/* velero en el horizonte */}
      <g opacity={0.55} transform="translate(90 148)">
        <path d="M 0 0 L 0 -16 L 12 0 Z" fill="#17222c" />
        <rect x="-4" y="0" width="10" height="3" fill="#17222c" />
      </g>
      {/* palmera en primer plano, esquina inferior izquierda */}
      <g transform="translate(14 250)" opacity={0.85}>
        <path d="M 0 0 Q -4 -60 6 -110" fill="none" stroke="#1d2a1f" strokeWidth={6} strokeLinecap="round" />
        <path d="M 6 -110 Q -20 -118 -34 -100" fill="none" stroke="#1d2a1f" strokeWidth={4} strokeLinecap="round" />
        <path d="M 6 -110 Q 24 -120 40 -104" fill="none" stroke="#1d2a1f" strokeWidth={4} strokeLinecap="round" />
        <path d="M 6 -110 Q -6 -134 2 -150" fill="none" stroke="#1d2a1f" strokeWidth={4} strokeLinecap="round" />
      </g>
      {/* siluetas de gaviotas */}
      <path d="M 60 50 q 8 -8 16 0 q 8 -8 16 0" fill="none" stroke="#2a2440" strokeWidth={1.6} opacity={0.5} />
      <path d="M 260 70 q 6 -6 12 0 q 6 -6 12 0" fill="none" stroke="#2a2440" strokeWidth={1.4} opacity={0.4} />
      <path d="M 340 95 q 5 -5 10 0 q 5 -5 10 0" fill="none" stroke="#2a2440" strokeWidth={1.2} opacity={0.4} />
      {brillos.map((b, i) => (
        <ellipse key={i} className="sinka-bg-ola" style={{ animationDelay: `${b.delay}s` }} cx={b.x} cy={b.y} rx={22} ry={3} fill="#ffe3a8" />
      ))}
    </svg>
  );
}

// ── Lluvia en Ventana ────────────────────────────────────────────────────────
function EscenaLluvia() {
  const gotas = [
    { x: 30, delay: 0 }, { x: 70, delay: 0.3 }, { x: 110, delay: 0.1 },
    { x: 160, delay: 0.5 }, { x: 210, delay: 0.2 }, { x: 250, delay: 0.6 },
    { x: 300, delay: 0.15 }, { x: 340, delay: 0.45 }, { x: 375, delay: 0.3 },
    { x: 15, delay: 0.55 }, { x: 190, delay: 0.35 }, { x: 360, delay: 0.1 },
  ];
  const luces = [
    { x: 50, y: 150, r: 10 }, { x: 140, y: 170, r: 14 },
    { x: 260, y: 155, r: 9 }, { x: 330, y: 175, r: 12 },
  ];
  const ventanas = [
    { x: 36, y: 165 }, { x: 54, y: 165 }, { x: 150, y: 190 },
    { x: 266, y: 170 }, { x: 284, y: 170 }, { x: 340, y: 195 },
  ];
  return (
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        <linearGradient id="lluviaCielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#141c30" />
          <stop offset="100%" stopColor="#3a4a68" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#lluviaCielo)" />
      {/* ciudad borrosa, dos profundidades */}
      <g opacity={0.35}>
        {[0, 60, 120, 180, 240, 300, 360].map((x, i) => (
          <rect key={i} x={x} y={250 - (40 + (i % 2) * 18)} width={44} height={40 + (i % 2) * 18} fill="#0a1020" />
        ))}
      </g>
      {[30, 90, 150, 210, 270, 330].map((x, i) => (
        <rect key={i} x={x} y={250 - (60 + (i % 3) * 25)} width={34} height={60 + (i % 3) * 25} fill="#0f1526" opacity={0.6} />
      ))}
      {/* ventanitas encendidas en los edificios cercanos */}
      {ventanas.map((v, i) => (
        <rect key={i} x={v.x} y={v.y} width={6} height={8} fill="#ffdca0" opacity={0.55} />
      ))}
      {luces.map((l, i) => (
        <circle key={i} className="sinka-frame-ov-flicker" cx={l.x} cy={l.y} r={l.r} fill="#ffd79a" opacity={0.5} />
      ))}
      {/* farola con halo en primer plano */}
      <g opacity={0.8}>
        <rect x="372" y="150" width="3" height="100" fill="#0a0f1c" />
        <circle cx="373.5" cy="146" r="10" fill="#ffdca0" opacity={0.5} />
        <circle cx="373.5" cy="146" r="4" fill="#fff3d6" />
      </g>
      <rect width="400" height="250" fill="#eaf2ff" opacity={0} className="sinka-bg-rayo" />
      {/* reflejo tenue del cielo sobre un charco al pie */}
      <rect x="0" y="244" width="400" height="6" fill="#4a6a8f" opacity={0.3} />
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
  );
}

// ── Montaña al Amanecer ──────────────────────────────────────────────────────
function EscenaMontana() {
  const pico = (cx: number, h: number, w: number) =>
    `M ${cx} ${250 - h} L ${cx - w} 250 L ${cx + w} 250 Z`;
  const nieve = Array.from({ length: 8 }, (_, i) => ({
    x: (i * 61) % 400, delay: (i % 4) * 1.4,
  }));
  const pinos = [30, 60, 340, 370];
  return (
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
      {/* pájaros migrando */}
      <path d="M 250 50 q 6 -6 12 0 q 6 -6 12 0" fill="none" stroke="#5f6f93" strokeWidth={1.4} opacity={0.5} />
      <path d="M 275 62 q 5 -5 10 0 q 5 -5 10 0" fill="none" stroke="#5f6f93" strokeWidth={1.2} opacity={0.45} />
      <circle cx="200" cy="90" r="28" fill="url(#montanaSol)" className="sinka-frame-ov-pulse" />
      {/* nubes bajas entre las dos capas de montaña */}
      <g opacity={0.45} className="sinka-bg-niebla">
        <ellipse cx="150" cy="135" rx="36" ry="7" fill="#ffffff" />
        <ellipse cx="270" cy="128" rx="28" ry="6" fill="#ffffff" />
      </g>
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
      {/* pinos en primer plano, a ambos lados */}
      {pinos.map((cx, i) => (
        <g key={i} opacity={0.85}>
          <path d={pico(cx, 44, 13)} fill="#3a4a3e" transform={`translate(0 ${206 - 44})`} />
          <path d={pico(cx, 34, 10)} fill="#324236" transform={`translate(0 ${216 - 34})`} />
          <rect x={cx - 2} y="214" width="4" height="12" fill="#2a2420" />
        </g>
      ))}
      {/* pasto/rocas al pie */}
      <path d="M 0 250 L 0 240 Q 100 230 200 240 Q 300 230 400 240 L 400 250 Z" fill="#4a5a4e" opacity={0.5} />
      {nieve.map((n, i) => (
        <circle key={i} className="sinka-bg-nieve" style={{ animationDelay: `${n.delay}s` }} cx={n.x} cy="0" r={1.8} fill="#ffffff" />
      ))}
    </svg>
  );
}

// ── Biblioteca Cálida ────────────────────────────────────────────────────────
function EscenaBiblioteca() {
  const coloresLibros = ["#8a6238", "#a9733c", "#6b4a26", "#b8854a", "#5a3d20"];
  const polvo = [
    { x: 190, y: 90, delay: 0 }, { x: 210, y: 130, delay: 0.9 },
    { x: 175, y: 160, delay: 1.6 }, { x: 225, y: 70, delay: 0.5 }, { x: 200, y: 50, delay: 1.3 },
  ];
  return (
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
      {/* estanterias con libros a ambos lados, 4 filas con marco de madera */}
      {[0, 1, 2, 3].map((fila) => (
        <g key={fila}>
          <rect x="4" y={26 + fila * 50} width="158" height="46" fill="none" stroke="#1a0f06" strokeWidth={2} opacity={0.5} />
          <rect x="248" y={26 + fila * 50} width="158" height="46" fill="none" stroke="#1a0f06" strokeWidth={2} opacity={0.5} />
          {Array.from({ length: 10 }, (_, i) => (
            <rect
              key={i}
              x={10 + i * 15}
              y={30 + fila * 50}
              width={11}
              height={38}
              fill={coloresLibros[(i + fila) % coloresLibros.length]}
              opacity={0.85}
            />
          ))}
          {Array.from({ length: 10 }, (_, i) => (
            <rect
              key={`r${i}`}
              x={260 + i * 15}
              y={30 + fila * 50}
              width={11}
              height={38}
              fill={coloresLibros[(i + fila + 2) % coloresLibros.length]}
              opacity={0.85}
            />
          ))}
        </g>
      ))}
      {/* haz de luz de la lampara */}
      <ellipse cx="200" cy="90" rx="110" ry="130" fill="url(#bibliotecaLuz)" />
      {/* mesita con libros apilados y una taza, bajo la lampara */}
      <rect x="170" y="206" width="60" height="5" fill="#2a1a0d" opacity={0.85} />
      <rect x="176" y="194" width="26" height="12" fill="#6b4a26" opacity={0.85} />
      <rect x="180" y="184" width="20" height="10" fill="#8a6238" opacity={0.85} />
      <rect x="206" y="196" width="14" height="10" rx="2" fill="#1a0f06" opacity={0.8} />
      {/* sillón de lectura, silueta a la derecha */}
      <path d="M 300 250 L 300 210 Q 300 198 314 198 L 350 198 Q 364 198 364 210 L 364 250 Z" fill="#1a0f06" opacity={0.55} />
      <rect x="296" y="230" width="72" height="10" fill="#140b05" opacity={0.6} />
      {/* pantalla de lampara */}
      <path d="M 185 40 L 215 40 L 225 65 L 175 65 Z" fill="#2a1a0d" opacity={0.85} />
      <rect x="198" y="65" width="4" height="30" fill="#2a1a0d" opacity={0.85} />
      {/* alfombra ovalada en el piso */}
      <ellipse cx="200" cy="244" rx="90" ry="8" fill="#5a3d20" opacity={0.35} />
      {polvo.map((p, i) => (
        <circle key={i} className="sinka-bg-dust" style={{ animationDelay: `${p.delay}s` }} cx={p.x} cy={p.y} r={1.4} fill="#ffe8c2" />
      ))}
    </svg>
  );
}
