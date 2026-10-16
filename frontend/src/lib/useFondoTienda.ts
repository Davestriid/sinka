"use client";

import { useEffect, useState } from "react";
import { shopApi } from "@/lib/api";
import type { BgId } from "@/components/PageBackground";

const ESCENAS_ILUSTRADAS = new Set<BgId>(["item-bg-lofi-01", "item-bg-forest-01", "item-bg-space-01"]);

export interface FondoResuelto {
  /** CSS `background` de respaldo (degradado) — se usa como color base aunque haya escena ilustrada. */
  css: string;
  /** Si el item tiene una escena SVG dedicada (ver PageBackground.tsx), su id; si no, null. */
  escenaId: BgId | null;
}

/**
 * Resuelve el fondo de tienda que el usuario tiene equipado, si tiene
 * alguno. Se usa en cualquier pantalla donde ese fondo deba verse
 * (Dashboard, Pomodoro solo, etc.) — centralizado acá para no repetir el
 * fetch + estado en cada página.
 */
export function useFondoTienda(token: string | null, equippedId: string | null | undefined): FondoResuelto | null {
  const [fondo, setFondo] = useState<FondoResuelto | null>(null);

  useEffect(() => {
    if (!token || !equippedId) { setFondo(null); return; }
    let cancelado = false;
    shopApi.getItems(token)
      .then(items => {
        if (cancelado) return;
        const item = items.find(i => i.id === equippedId);
        if (!item?.preview) { setFondo(null); return; }
        setFondo({
          css: item.preview,
          escenaId: ESCENAS_ILUSTRADAS.has(item.id as BgId) ? (item.id as BgId) : null,
        });
      })
      .catch(() => { if (!cancelado) setFondo(null); });
    return () => { cancelado = true; };
  }, [token, equippedId]);

  return fondo;
}
