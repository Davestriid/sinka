/**
 * Ítems de categoría "music" de la tienda -> archivo de audio real.
 *
 * Solo estos dos existen hoy en el catálogo; si no hay mapeo para un
 * item_id comprado, simplemente no aparece como pista reproducible (no
 * rompe nada). Compartido entre el Pomodoro en solitario (donde suena de
 * verdad durante la sesión) y la vista previa de la tienda (donde se puede
 * escuchar un adelanto antes de comprar).
 */
export const MUSICA_TIENDA_SRC: Record<string, string> = {
  "item-music-rain": "/sounds/fondo-lluvia.mp3",
  "item-music-lofi": "/sounds/fondo-musica.mp3",
};
