"use client";

import { useEffect, useState } from "react";
import { shopApi } from "@/lib/api";

/**
 * Resuelve el valor CSS (`preview`) del fondo de tienda que el usuario tiene
 * equipado, si tiene alguno. Se usa en cualquier pantalla donde ese fondo
 * deba verse (Dashboard, Pomodoro solo, etc.) — centralizado acá para no
 * repetir el fetch + estado en cada página.
 */
export function useFondoTienda(token: string | null, equippedId: string | null | undefined): string | null {
  const [fondo, setFondo] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !equippedId) { setFondo(null); return; }
    let cancelado = false;
    shopApi.getItems(token)
      .then(items => {
        if (cancelado) return;
        const item = items.find(i => i.id === equippedId);
        setFondo(item?.preview ?? null);
      })
      .catch(() => { if (!cancelado) setFondo(null); });
    return () => { cancelado = true; };
  }, [token, equippedId]);

  return fondo;
}
