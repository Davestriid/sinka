"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  const router = useRouter();

  useEffect(() => {
    // Log al servicio de errores en producción
    console.error("[SINKA] Unhandled error:", error);
  }, [error]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>⚠️</div>
        <h1 style={styles.title}>Algo salió mal</h1>
        <p style={styles.msg}>
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <code style={styles.digest}>Referencia: {error.digest}</code>
        )}
        <div style={styles.actions}>
          <button onClick={reset} style={styles.btnPrimary}>
            Intentar de nuevo
          </button>
          <button onClick={() => router.push("/dashboard")} style={styles.btnSecondary}>
            Ir al Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:      "100vh",
    background:     "#0f0e0d",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    padding:        "24px",
    fontFamily:     "system-ui, sans-serif",
    color:          "#e8e0d5",
  },
  card: {
    background:   "#1c1816",
    border:       "1px solid #3b2f2a",
    borderRadius: 16,
    padding:      "40px 32px",
    maxWidth:     420,
    width:        "100%",
    textAlign:    "center" as const,
    display:      "flex",
    flexDirection:"column",
    alignItems:   "center",
    gap:          16,
  },
  icon:    { fontSize: 48, lineHeight: 1 },
  title:   { margin: 0, fontSize: 22, fontWeight: 700, color: "#e8e0d5" },
  msg:     { margin: 0, fontSize: 14, color: "#a0998b", lineHeight: 1.6 },
  digest:  { fontSize: 11, color: "#6b6358", fontFamily: "monospace" },
  actions: { display: "flex", gap: 12, flexWrap: "wrap" as const, justifyContent: "center" },
  btnPrimary: {
    background:   "#854d0e",
    border:       "none",
    borderRadius: 8,
    color:        "#fef08a",
    fontWeight:   700,
    fontSize:     14,
    padding:      "10px 24px",
    cursor:       "pointer",
  },
  btnSecondary: {
    background:   "none",
    border:       "1px solid #2a2520",
    borderRadius: 8,
    color:        "#a0998b",
    fontSize:     14,
    padding:      "10px 24px",
    cursor:       "pointer",
  },
};
