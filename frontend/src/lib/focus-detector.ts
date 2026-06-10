/**
 * FocusDetector — detecta si el usuario está activo en la pestaña.
 *
 * Criterios de "activo":
 *   - La pestaña es visible (visibilityState === "visible")
 *   - Hubo interacción (mousemove / keydown / click / scroll) en los
 *     últimos INACTIVITY_THRESHOLD_MS milisegundos
 *
 * Uso:
 *   import { focusDetector } from "@/lib/focus-detector";
 *   const active = focusDetector.isActive();
 *   const score  = focusDetector.getFocusScore(); // 0.0 – 1.0
 */

const INACTIVITY_THRESHOLD_MS = 120_000; // 2 minutos sin interacción → inactivo

class FocusDetector {
  private lastInteraction: number = Date.now();
  private tabVisible: boolean     = true;

  constructor() {
    if (typeof window === "undefined") return; // SSR guard

    const reset = () => {
      this.lastInteraction = Date.now();
    };

    document.addEventListener("mousemove",    reset, { passive: true });
    document.addEventListener("keydown",      reset, { passive: true });
    document.addEventListener("click",        reset, { passive: true });
    document.addEventListener("scroll",       reset, { passive: true });
    document.addEventListener("touchstart",   reset, { passive: true });

    document.addEventListener("visibilitychange", () => {
      this.tabVisible = document.visibilityState === "visible";
      if (this.tabVisible) reset();
    });
  }

  /** true si el usuario lleva menos de 2 min sin interactuar y la pestaña es visible */
  isActive(): boolean {
    if (!this.tabVisible) return false;
    return Date.now() - this.lastInteraction < INACTIVITY_THRESHOLD_MS;
  }

  /** Puntuación de 0.0 (inactivo) a 1.0 (activo ahora mismo) */
  getFocusScore(): number {
    if (!this.tabVisible) return 0;
    const elapsed = Date.now() - this.lastInteraction;
    if (elapsed >= INACTIVITY_THRESHOLD_MS) return 0;
    return Math.max(0, 1 - elapsed / INACTIVITY_THRESHOLD_MS);
  }
}

export const focusDetector = new FocusDetector();
