/**
 * Ítems de categoría "music" de la tienda -> archivo de audio real.
 *
 * Lluvia (fondo-lluvia.mp3) es la única pista gratuita/predeterminada — no
 * está acá porque no se vende, vive directo en PISTAS de session/solo/page.tsx.
 * Todo lo demás se compra en la tienda. Si no hay mapeo para un item_id
 * comprado, simplemente no aparece como pista reproducible (no rompe nada).
 * Compartido entre el Pomodoro en solitario (donde suena de verdad durante
 * la sesión) y la vista previa de la tienda (donde se puede escuchar un
 * adelanto antes de comprar).
 *
 * item-music-rain queda mapeada por compatibilidad — quien ya la había
 * comprado antes de que se desactivara en la tienda (migración 0030) sigue
 * pudiendo reproducirla desde su inventario.
 */
export const MUSICA_TIENDA_SRC: Record<string, string> = {
  "item-music-rain":   "/sounds/fondo-lluvia.mp3",
  "item-music-lofi":   "/sounds/fondo-musica.mp3",
  "item-music-sakura": "/sounds/fondo-sakura.mp3",
  "item-music-bosque": "/sounds/fondo-bosque.mp3",
  "item-music-pop":    "/sounds/fondo-pop.mp3",
};
