"use client";

/**
 * Textura sutil para banners de perfil — sin esto, un banner es literalmente
 * un rectángulo de un solo color o degradado plano, que se siente genérico
 * sin importar qué tan lindo sea el color en sí. Esto le suma una pincelada
 * tipo tinta (wabi-sabi, igual que el resto de la identidad visual) encima,
 * en opacidad muy baja — funciona sobre cualquier color o degradado porque
 * no depende de qué hay debajo.
 *
 * Uso: colocar como hermano del div que pinta el `background`, con el
 * contenedor en `position: relative; overflow: hidden`.
 */
import type { CSSProperties } from "react";

const capaStyle: CSSProperties = {
  position:      "absolute",
  inset:         0,
  pointerEvents: "none",
};

export function BannerTexture() {
  return (
    <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ ...capaStyle, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="bannerSombra" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.22} />
        </linearGradient>
      </defs>
      {/* pinceladas diagonales, como tinta corrida */}
      <g opacity={0.14} stroke="#ffffff" strokeLinecap="round" fill="none">
        <path d="M -20 70 C 60 40, 140 95, 220 55" strokeWidth={14} />
        <path d="M 120 10 C 200 35, 280 -10, 360 25" strokeWidth={10} />
        <path d="M 250 90 C 320 60, 380 100, 440 70" strokeWidth={18} />
      </g>
      <g opacity={0.08} stroke="#000000" strokeLinecap="round" fill="none">
        <path d="M -10 20 C 80 50, 160 5, 260 35" strokeWidth={8} />
      </g>
      {/* sombra al pie para que se funda con el contenido de abajo */}
      <rect x="0" y="0" width="400" height="100" fill="url(#bannerSombra)" />
    </svg>
  );
}
