import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserResponse } from "@/lib/api";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserResponse | null;
  /**
   * Falso hasta que se termino de leer la sesion guardada en el navegador.
   *
   * Sin esta bandera las pantallas miraban el token antes de que se cargara,
   * lo veian vacio y mandaban al login. En el escritorio la lectura es tan
   * rapida que casi no se notaba, pero en el celular pasaba siempre: recargar
   * la pagina te devolvia al login aunque la sesion estuviera intacta.
   */
  hidratado: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserResponse) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hidratado: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: "sinka-auth",
      // Solo se guarda la sesion. La bandera se recalcula en cada carga.
      partialize: (estado) => ({
        accessToken:  estado.accessToken,
        refreshToken: estado.refreshToken,
        user:         estado.user,
      }),
      onRehydrateStorage: () => () => {
        // Se llama al terminar de leer, haya datos guardados o no.
        //
        // Aqui zustand ya dejo la sesion puesta, asi que solo falta levantar
        // la bandera. Antes tambien se volcaba el estado recibido encima, y
        // como ese estado traia la bandera en falso se pisaba a si misma: no
        // se levantaba nunca y las pantallas se quedaban esperando.
        useAuthStore.setState({ hidratado: true });
      },
    }
  )
);
