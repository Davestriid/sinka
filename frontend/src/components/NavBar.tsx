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
import { motion, AnimatePresence } from "framer-motion";

import { authApi, gamificationApi, type UserStats } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { color, radius, fontSerif } from "@/lib/theme";
import { Notificaciones } from "./Notificaciones";

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
  // La tabla de lideres queda fuera de la barra por ahora. La pagina sigue
  // existiendo en /leaderboard por si se quiere volver a mostrar.
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
  const { accessToken: token, user, logout, setUser } = useAuthStore();

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

  // Si hay sesion pero no sabemos quien es, se pregunta.
  //
  // Esto repara solo las sesiones abiertas antes de que el login empezara a
  // traer el perfil: sin esto la barra mostraba "Perfil" en vez del nombre y
  // el boton de guardar del perfil quedaba desactivado para siempre, porque
  // no habia con que comparar los cambios.
  useEffect(() => {
    if (!montado || !token || user) return;
    authApi.me(token).then(setUser).catch(() => {});
  }, [montado, token, user, setUser]);

  if (oculta) return null;

  const fc = monedas ?? stats?.focus_coins ?? null;

  // El alias es el nombre que la persona eligio mostrar. Si no puso ninguno,
  // vale el nombre de usuario del registro.
  const nombre = user?.alias || user?.username || "Perfil";

  const activo = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header style={s.header}>
      <button
        style={s.logo}
        onClick={() => router.push("/dashboard")}
        title="Ir al inicio"
      >
        <span style={s.logoMark} aria-hidden>🌱</span>
        SINKA
      </button>

      <nav style={s.nav}>
        {DESTINOS.map(d => {
          const on = activo(d.href);
          return (
            <button
              key={d.href}
              onClick={() => router.push(d.href)}
              style={{ ...s.enlace, ...(on ? s.enlaceActivo : {}) }}
              title={d.texto}
            >
              <span aria-hidden>{d.icono}</span>
              <span style={s.etiqueta}>{d.texto}</span>
              {on && (
                <motion.span
                  layoutId="nav-activo"
                  style={s.navIndicador}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div style={s.derecha}>
        <Notificaciones />

        <button
          style={{ ...s.enlace, ...(activo("/shop") ? s.enlaceActivo : {}) }}
          onClick={() => router.push("/shop")}
          title="Tienda"
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={fc ?? "sin-fc"}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              🛍️{fc != null ? ` ${fc}` : ""}
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          style={{ ...s.enlace, ...(activo("/perfil") ? s.enlaceActivo : {}) }}
          onClick={() => router.push("/perfil")}
          title="Tu perfil"
        >
          {user?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" style={s.foto} />
          ) : (
            <span style={s.inicial}>{nombre.slice(0, 2).toUpperCase()}</span>
          )}
          <span style={s.etiqueta}>{nombre}</span>
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
    background:   "rgba(33, 29, 25, 0.92)",
    backdropFilter: "blur(10px)",
    borderBottom: `1px solid ${color.border}`,
    position:     "sticky",
    top:          0,
    zIndex:       50,
  },
  logo: {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           6,
    background:    "transparent",
    border:        "none",
    cursor:        "pointer",
    fontFamily:    fontSerif,
    fontWeight:    600,
    fontSize:      19,
    color:         color.text,
    letterSpacing: "0.02em",
    padding:       0,
  },
  logoMark: { fontSize: 16 },
  nav: {
    display:   "flex",
    flexWrap:  "wrap",
    gap:       2,
    flex:      1,
    justifyContent: "center",
    minWidth:  0,
  },
  derecha: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  enlace: {
    position:     "relative",
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    background:   "transparent",
    color:        color.textMuted,
    border:       "1px solid transparent",
    borderRadius: radius.pill,
    padding:      "7px 14px",
    cursor:       "pointer",
    fontSize:     13,
    whiteSpace:   "nowrap",
    transition:   "color 0.15s ease, background 0.15s ease",
  },
  enlaceActivo: {
    background:  color.surfaceRaised,
    color:       color.text,
    borderColor: color.border,
  },
  navIndicador: {
    position:     "absolute",
    left:         10,
    right:        10,
    bottom:       2,
    height:       2,
    borderRadius: radius.pill,
    background:   color.accent,
  },
  etiqueta: { fontSize: 13, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  foto: {
    width:        24,
    height:       24,
    borderRadius: "50%",
    objectFit:    "cover",
    display:      "block",
    boxShadow:    `0 0 0 2px ${color.borderSoft}`,
  },
  inicial: {
    width:        24,
    height:       24,
    borderRadius: "50%",
    background:   color.accentSoft,
    color:        color.text,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:     10,
    fontWeight:   700,
  },
  salir: {
    background:   "transparent",
    color:        color.textMuted,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "7px 16px",
    cursor:       "pointer",
    fontSize:     13,
    transition:   "border-color 0.15s ease, color 0.15s ease",
  },
};

export default NavBar;
