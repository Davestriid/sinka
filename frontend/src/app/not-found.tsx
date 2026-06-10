import Link from "next/link";

export default function NotFound() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.code}>404</div>
        <h1 style={styles.title}>Página no encontrada</h1>
        <p style={styles.msg}>
          Esta página no existe o fue movida. Vuelve al inicio para continuar.
        </p>
        <Link href="/dashboard" style={styles.btn}>
          ← Volver al Dashboard
        </Link>
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
    background:    "#1c1816",
    border:        "1px solid #2a2520",
    borderRadius:  16,
    padding:       "48px 32px",
    maxWidth:      400,
    width:         "100%",
    textAlign:     "center" as const,
    display:       "flex",
    flexDirection: "column",
    alignItems:    "center",
    gap:           16,
  },
  code: {
    fontSize:   72,
    fontWeight: 900,
    color:      "#2a2520",
    lineHeight: 1,
  },
  title:  { margin: 0, fontSize: 22, fontWeight: 700 },
  msg:    { margin: 0, fontSize: 14, color: "#a0998b", lineHeight: 1.6 },
  btn: {
    marginTop:    8,
    background:   "#1c1816",
    border:       "1px solid #2a2520",
    borderRadius: 8,
    color:        "#a0998b",
    fontSize:     14,
    padding:      "10px 24px",
    textDecoration:"none",
    display:      "inline-block",
  },
};
