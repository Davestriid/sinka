"use client";

/**
 * Barra de navegacion comun a todas las pantallas.
 *
 * Antes solo se llegaba a la tabla y a la tienda. El jardin, los vinculos, los
 * grupos, las citas y el perfil existian pero no habia como abrirlos sin
 * escribir la direccion a mano.
 *
 * En pantallas angostas los enlaces se envuelven en vez de desbordarse.
 */
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";

import { gamificationApi, type UserStats } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

interface Destino {
  href:   string;
  icono:  string;
  texto:  string;
}

const DESTINOS: Destino[] = [
  { href: "/dashboard",   icono: "🎯", texto: "Enfocarme" },
  { href: "/vinculos",    icono: "🤝", texto: "Vínculos"  },
  { href: "/jardin",      icono: "🌿", texto: "Jardín"    },
  { href: "/grupos",      icono: "👥", texto: "Grupos"    },
  { href: "/citas",       icono: "📅", texto: "Citas"     },
  { href: "/leaderboard", icono: "🏆", texto: "Tabla"     },
];

/**
 * Pantallas donde la barra estorba: las de entrada, porque todavia no hay
 * usuario, y la de sesion, que debe quedar libre de distracciones.
 */
const SIN_BARRA = ["/", "/login", "/register", "/onboarding", "/session"];

interface NavBarProps {
  /** Monedas a mostrar, si la pantalla ya las tiene cargadas. */
  monedas?: number | null;
}

export function NavBar({ monedas }: NavBarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { accessToken: token, user, logout } = useAuthStore();

  const [stats, setStats] = useState<UserStats | null>(null);

  // El token vive en almacenamiento del navegador, asi que en el primer
  // render del servidor no existe. Esperar a estar montado evita que el
  // contenido difiera entre servidor y navegador.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const oculta =
    !montado ||
    !token ||
    SIN_BARRA.some(r => pathname === r || pathname.startsWith(r + "/"));

  // Solo se piden si la pantalla no las paso ya, para no repetir la llamada
  useEffect(() => {
    if (oculta || !token || monedas != null) return;
    gamificationApi.getStats(token).then(setStats).catch(() => {});
  }, [oculta, token, monedas]);

  if (oculta) return null;

  const fc = monedas ?? stats?.focus_coins ?? null;

  const activo = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header style={s.header}>
      <button
        style={s.logo}
        onClick={() => router.push("/dashboard")}
        title="Ir al inicio"
      >
        SINKA
      </button>

      <nav style={s.nav}>
        {DESTINOS.map(d => (
          <button
            key={d.href}
            onClick={() => router.push(d.href)}
            style={{ ...s.enlace, ...(activo(d.href) ? s.enlaceActivo : {}) }}
            title={d.texto}
          >
            <span aria-hidden>{d.icono}</span>
            <span style={s.etiqueta}>{d.texto}</span>
          </button>
        ))}
      </nav>

      <div style={s.derecha}>
        <button
          style={{ ...s.enlace, ...(activo("/shop") ? s.enlaceActivo : {}) }}
          onClick={() => router.push("/shop")}
          title="Tienda"
        >
          🛍️{fc != null ? ` ${fc}` : ""}
        </button>

        <button
          style={{ ...s.enlace, ...(activo("/perfil") ? s.enlaceActivo : {}) }}
          onClick={() => router.push("/perfil")}
          title="Tu perfil"
        >
          <span aria-hidden>👤</span>
          <span style={s.etiqueta}>{user?.username ?? "Perfil"}</span>
        </button>

        <button
          style={s.salir}
          onClick={() => { logout(); router.push("/login"); }}
        >
          Salir
        </button>
      </div>
    </header>
  );
}

const s: Record<string, CSSProperties> = {
  header: {
    display:      "flex",
    alignItems:   "center",
    justifyContent: "space-between",
    flexWrap:     "wrap",
    gap:          8,
    padding:      "10px 20px",
    background:   "#211d19",
    borderBottom: "1px solid #3a3028",
    position:     "sticky",
    top:          0,
    zIndex:       50,
  },
  logo: {
    background:    "transparent",
    border:        "none",
    cursor:        "pointer",
    fontWeight:    800,
    fontSize:      20,
    color:         "#f5f0e8",
    letterSpacing: "0.05em",
    padding:       0,
  },
  nav: {
    display:   "flex",
    flexWrap:  "wrap",
    gap:       4,
    flex:      1,
    justifyContent: "center",
    minWidth:  0,
  },
  derecha: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  enlace: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid transparent",
    borderRadius: 8,
    padding:      "7px 12px",
    cursor:       "pointer",
    fontSize:     13,
    whiteSpace:   "nowrap",
  },
  enlaceActivo: {
    background:  "#2a2420",
    color:       "#f5f0e8",
    borderColor: "#4a3f35",
  },
  etiqueta: { fontSize: 13 },
  salir: {
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "7px 14px",
    cursor:       "pointer",
    fontSize:     13,
  },
};

export default NavBar;
