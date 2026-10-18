"use client";

/**
 * Pantalla a la que llega el enlace del correo de verificacion
 * (?token=...). Confirma el token contra el backend y muestra el resultado.
 *
 * Tambien sirve para pedir un reenvio si el token ya vencio (24h) — en ese
 * caso, si la persona tiene sesion iniciada, puede pedir uno nuevo sin
 * volver a loguearse.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { authApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function VerificarEmailContenido() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const { accessToken, user, setUser } = useAuthStore();

  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [mensaje, setMensaje] = useState("");
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  useEffect(() => {
    if (!token) {
      setEstado("error");
      setMensaje("Falta el código de verificación en el enlace.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then((u) => {
        setEstado("ok");
        // Si es la propia cuenta logueada, refleja el cambio de inmediato
        // (barra, perfil) sin esperar a la próxima carga de /auth/me.
        if (user && user.id === u.id) setUser(u);
      })
      .catch((e) => {
        setEstado("error");
        setMensaje(e instanceof ApiError ? e.message : "No se pudo verificar el correo.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const reenviar = async () => {
    if (!accessToken) return;
    setReenviando(true);
    try {
      await authApi.resendVerification(accessToken);
      setReenviado(true);
    } catch (e) {
      setMensaje(e instanceof ApiError ? e.message : "No se pudo reenviar el correo.");
    } finally {
      setReenviando(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verificación de correo</CardTitle>
          <CardDescription>
            {estado === "cargando" && "Confirmando tu correo…"}
            {estado === "ok" && "Tu correo quedó confirmado."}
            {estado === "error" && "No pudimos confirmar tu correo."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estado === "error" && <p className="text-sm text-destructive">{mensaje}</p>}
          {estado === "error" && accessToken && !reenviado && (
            <Button className="mt-3 w-full" variant="secondary" disabled={reenviando} onClick={reenviar}>
              {reenviando ? "Enviando…" : "Enviarme un enlace nuevo"}
            </Button>
          )}
          {reenviado && <p className="text-sm text-muted-foreground mt-3">Te enviamos un correo nuevo.</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push(user ? "/dashboard" : "/login")}>
            {user ? "Ir al panel" : "Ir a iniciar sesión"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerificarEmailContenido />
    </Suspense>
  );
}
