"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authApi, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Ingresa un correo válido."),
  password: z.string().min(1, "La contraseña es requerida."),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    setAccountNotFound(false);
    try {
      const tokens = await authApi.login(data.email, data.password);
      setTokens(tokens.access_token, tokens.refresh_token);

      // Traer el perfil ahora mismo. Sin esto la aplicacion no sabia quien
      // eras: la barra mostraba "Perfil" en vez de tu nombre, y dentro de la
      // sesion ningun lado se reconocia como el que abre la videollamada,
      // asi que el video nunca arrancaba.
      const perfil = await authApi.me(tokens.access_token);
      setUser(perfil);

      router.push(perfil.onboarding_completed ? "/dashboard" : "/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setAccountNotFound(true);
        setServerError(err.message);
      } else {
        setServerError(
          err instanceof ApiError ? err.message : "Error al iniciar sesión. Inténtalo de nuevo.",
        );
      }
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Iniciar sesión</CardTitle>
          <CardDescription>Entra a SINKA y comienza a concentrarte.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md space-y-1">
                <p>{serverError}</p>
                {accountNotFound && (
                  <p>
                    ¿Quieres crear una?{" "}
                    <Link href="/register" className="underline underline-offset-4 font-medium">
                      Regístrate gratis
                    </Link>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              ¿No tienes cuenta?{" "}
              <Link href="/register" className="underline underline-offset-4 hover:text-primary">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
