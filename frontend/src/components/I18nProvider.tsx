"use client";

/**
 * Idioma real de la interfaz.
 *
 * Mismo patrón que ThemeProvider.tsx: el perfil ya guardaba una preferencia
 * de idioma en el backend, pero nada la aplicaba al texto en pantalla. Este
 * componente guarda el idioma activo y expone `t(clave)` para traducir.
 *
 * Prioridad al elegir el idioma inicial: preferencia guardada en este
 * navegador (localStorage) > preferencia guardada en la cuenta (backend,
 * una vez que el perfil carga) > español por defecto.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/store/auth.store";
import { dict, traducir, type ClaveTraduccion, type Idioma } from "@/lib/i18n";

const CLAVE_LOCAL = "sinka-language";

interface I18nContextValue {
  idioma: Idioma;
  /** Cambia el idioma ya mismo (estado + localStorage). No toca el backend:
   *  la pantalla de perfil sigue siendo quien decide cuándo guardar la cuenta. */
  setIdioma: (i: Idioma) => void;
  /** Traduce una clave del diccionario al idioma activo. */
  t: (clave: ClaveTraduccion) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [idioma, setIdiomaState] = useState<Idioma>("es");

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_LOCAL) as Idioma | null;
    if (guardado === "es" || guardado === "en") {
      setIdiomaState(guardado);
      return;
    }
    if (user?.language) {
      setIdiomaState(user.language);
      window.localStorage.setItem(CLAVE_LOCAL, user.language);
    }
    // Solo al montar — igual que ThemeProvider, para no pisar un cambio
    // manual que la persona acaba de hacer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setIdioma = useCallback((i: Idioma) => {
    setIdiomaState(i);
    window.localStorage.setItem(CLAVE_LOCAL, i);
  }, []);

  const t = useCallback(
    (clave: ClaveTraduccion) => traducir(clave, idioma),
    [idioma],
  );

  return (
    <I18nContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation debe usarse dentro de <I18nProvider>.");
  }
  return ctx;
}

// Reexportado por conveniencia para quien solo necesita el tipo de clave.
export type { ClaveTraduccion };
export { dict };
