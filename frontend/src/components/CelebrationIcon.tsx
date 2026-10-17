"use client";

/**
 * Ícono animado para momentos de "algo bueno pasó" — pareja encontrada,
 * sesión completada. Antes esas pantallas mostraban un emoji suelto (🎉,
 * 🌱); ahora el emoji va sobre un resplandor suave con anillos que se
 * expanden y un par de destellos, reutilizando las animaciones ya
 * definidas para los marcos de avatar (sinka-frame-ov-sparkle/twinkle) y
 * nuevas keyframes propias (ver globals.css, sección "Celebración").
 */
import { color } from "@/lib/theme";

interface Props {
  /** Emoji o carácter central (🎉, el emoji de la planta, etc.) */
  emoji: string;
  tone?: "success" | "accent";
  size?: number;
}

export function CelebrationIcon({ emoji, tone = "success", size = 64 }: Props) {
  const tinte = tone === "success" ? color.success : color.accent;
  const lienzo = size * 1.9;

  return (
    <div style={{ position: "relative", width: lienzo, height: lienzo, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={lienzo} height={lienzo} viewBox="0 0 120 120" style={{ position: "absolute", inset: 0 }}>
        <circle cx="60" cy="60" r="30" fill={tinte} opacity="0.16" className="sinka-celebrate-glow" />
        <circle cx="60" cy="60" r="34" fill="none" stroke={tinte} strokeWidth="2" className="sinka-celebrate-ring" />
        <circle cx="60" cy="60" r="34" fill="none" stroke={tinte} strokeWidth="2" className="sinka-celebrate-ring" style={{ animationDelay: "0.9s" }} />
        <circle cx="26" cy="22" r="2.6" fill={tinte} className="sinka-frame-ov-sparkle" />
        <circle cx="97" cy="28" r="2"   fill={tinte} className="sinka-frame-ov-twinkle" />
        <circle cx="18" cy="88" r="2"   fill={tinte} className="sinka-frame-ov-twinkle" style={{ animationDelay: "0.4s" }} />
        <circle cx="102" cy="92" r="2.4" fill={tinte} className="sinka-frame-ov-sparkle" style={{ animationDelay: "0.3s" }} />
      </svg>
      <span
        style={{
          position:   "relative",
          fontSize:   size,
          lineHeight: 1,
          animation:  "sinka-celebrate-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        {emoji}
      </span>
    </div>
  );
}
