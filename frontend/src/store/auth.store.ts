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
    }
  )
);

/**
 * Levanta la bandera cuando la sesion guardada ya esta cargada.
 *
 * Se consulta de dos maneras a proposito. La lectura del almacenamiento del
 * navegador suele terminar antes de que corra esta linea, y en ese caso el
 * aviso de finalizado ya paso y no volveria a llegar nunca; por eso primero
 * se pregunta si ya termino. Si todavia no, se queda escuchando.
 *
 * Sin esto las pantallas miraban un token que aun no estaba cargado, lo veian
 * vacio y se quedaban esperando o mandaban al login.
 */
if (typeof window !== "undefined") {
  const marcar = () => useAuthStore.setState({ hidratado: true });
  if (useAuthStore.persist.hasHydrated()) marcar();
  else useAuthStore.persist.onFinishHydration(marcar);
}
