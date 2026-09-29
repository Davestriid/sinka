"use client";

/**
 * Tema claro/oscuro real.
 *
 * El perfil ya guardaba una preferencia de tema en el backend, pero nada la
 * leía: `theme.ts` tenía una sola paleta fija, así que elegir "Claro" no
 * cambiaba nada en pantalla. Ahora `theme.ts` expone sus colores como
 * variables CSS (ver globals.css) y este componente es lo único que decide
 * cuál de las dos paletas está activa, cambiando el atributo `data-theme`
 * del <html>. Como cada pantalla ya usa esos tokens, todas repintan solas.
 *
 * Prioridad al elegir el tema inicial: preferencia guardada en este
 * navegador (localStorage) > preferencia guardada en la cuenta (backend,
 * una vez que el perfil carga) > oscuro por defecto.
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

export type Tema = "light" | "dark";

const CLAVE_LOCAL = "sinka-theme";

interface ThemeContextValue {
  tema: Tema;
  /** Cambia el tema ya mismo (DOM + localStorage). No toca el backend: la
   *  pantalla de perfil sigue siendo quien decide cuándo guardar la cuenta. */
  setTema: (t: Tema) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function aplicarAlDom(t: Tema) {
  document.documentElement.setAttribute("data-theme", t);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  // Arranca en "dark" para que el primer render en el navegador coincida
  // con el script inline de layout.tsx (que ya pintó el <html> antes de que
  // React hidrate) y con el valor por defecto del propio CSS.
  const [tema, setTemaState] = useState<Tema>("dark");

  // Al montar: si ya hay preferencia guardada en este navegador, es la que
  // manda. El script inline del layout ya la aplicó al DOM antes de esto;
  // aquí solo sincronizamos el estado de React con lo que quedó pintado.
  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE_LOCAL) as Tema | null;
    if (guardado === "light" || guardado === "dark") {
      setTemaState(guardado);
      return;
    }
    // Sin preferencia local todavía: si el perfil ya cargó con una elegida
    // en la cuenta, se adopta esa (y se guarda localmente para la próxima).
    if (user?.theme) {
      setTemaState(user.theme);
      aplicarAlDom(user.theme);
      window.localStorage.setItem(CLAVE_LOCAL, user.theme);
    }
    // Solo debe correr una vez al montar — no en cada cambio de `user`,
    // porque eso pisaría un cambio manual que la persona acaba de hacer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTema = useCallback((t: Tema) => {
    setTemaState(t);
    aplicarAlDom(t);
    window.localStorage.setItem(CLAVE_LOCAL, t);
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, setTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>.");
  }
  return ctx;
}
