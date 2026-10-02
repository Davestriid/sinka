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
import { useEffect, useRef, useState, type CSSProperties, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Handshake, Sprout, Users, CalendarDays, ShoppingBag, Trophy,
  Flame, Sun, Moon, ChevronDown, UserCircle, Settings, LogOut,
  type LucideProps,
} from "lucide-react";

import { authApi, gamificationApi, gardenApi, trustApi, type UserStats } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";
import { type ClaveTraduccion } from "@/lib/i18n";
import { color, radius, shadow, fontSerif } from "@/lib/theme";
import { Notificaciones } from "./Notificaciones";

interface Destino {
  href:   string;
  Icono:  ComponentType<LucideProps>;
  /** Clave del diccionario i18n (ver src/lib/i18n.ts), no el texto final. */
  clave:  ClaveTraduccion;
}

// Iconos propios en vez de emoji: en varios sistemas el emoji se ve distinto
// (o de plano no se ve) y da un aire mas generico. Con trazos de un mismo
// set el conjunto se siente diseñado, no improvisado.
const DESTINOS: Destino[] = [
  { href: "/dashboard",   Icono: Target,        clave: "nav.enfocarme" },
  { href: "/vinculos",    Icono: Handshake,      clave: "nav.vinculos"  },
  { href: "/jardin",      Icono: Sprout,         clave: "nav.jardin"    },
  { href: "/grupos",      Icono: Users,          clave: "nav.grupos"    },
  { href: "/citas",       Icono: CalendarDays,   clave: "nav.citas"     },
  { href: "/logros",      Icono: Trophy,         clave: "nav.logros"    },
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
  const { t } = useTranslation();
  const { tema, setTema } = useTheme();

  const [stats, setStats] = useState<UserStats | null>(null);

  // Menú desplegable del avatar: confianza y total de plantas se piden
  // recien al abrirlo la primera vez, no en cada carga de pantalla — el
  // NavBar vive en casi todas las paginas y no vale la pena ese costo si
  // la persona nunca llega a abrir el menu.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confianzaPct, setConfianzaPct] = useState<number | null>(null);
  const [totalPlantas, setTotalPlantas] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuAbierto || !token || confianzaPct !== null) return;
    trustApi.me(token)
      .then(t => setConfianzaPct(Math.round((t.score / t.max_score) * 100)))
      .catch(() => {});
    gardenApi.list(token)
      .then(g => setTotalPlantas(g.total))
      .catch(() => {});
  }, [menuAbierto, token, confianzaPct]);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [menuAbierto]);

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
  const nombre = user?.alias || user?.username || t("nav.perfil");

  const activo = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header style={s.header}>
      <button
        style={s.logo}
        onClick={() => router.push("/dashboard")}
        title="Ir al inicio"
      >
        <Sprout size={17} strokeWidth={2} color={color.accent} aria-hidden />
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
              title={t(d.clave)}
            >
              <d.Icono size={15} strokeWidth={2} aria-hidden />
              <span style={s.etiqueta}>{t(d.clave)}</span>
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

        {stats && (
          <span style={s.statBadge} title={t("dashboard.racha_max")}>
            <Flame size={14} strokeWidth={2} color={color.accent} aria-hidden />
            {stats.streak_current}
          </span>
        )}

        <button
          style={s.statBadgeBtn}
          onClick={() => router.push("/shop")}
          title={t("nav.tienda")}
        >
          <ShoppingBag size={14} strokeWidth={2} aria-hidden />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={fc ?? "sin-fc"}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {fc != null ? fc : ""}
            </motion.span>
          </AnimatePresence>
        </button>

        <button
          style={s.temaBtn}
          onClick={() => setTema(tema === "dark" ? "light" : "dark")}
          title={t("nav.ajustes")}
        >
          {tema === "dark"
            ? <Moon size={15} strokeWidth={2} aria-hidden />
            : <Sun size={15} strokeWidth={2} aria-hidden />}
        </button>

        <div style={s.menuWrap} ref={menuRef}>
          <button style={s.avatarBtn} onClick={() => setMenuAbierto(o => !o)}>
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" style={s.foto} />
            ) : (
              <span style={s.inicial}>{nombre.slice(0, 2).toUpperCase()}</span>
            )}
            <span style={s.etiqueta}>{nombre}</span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              style={{ transform: menuAbierto ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
            />
          </button>

          <AnimatePresence>
            {menuAbierto && (
              <motion.div
                style={s.menuPanel}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <div style={s.menuCabecera}>
                  {user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar_url} alt="" style={s.fotoGrande} />
                  ) : (
                    <span style={s.inicialGrande}>{nombre.slice(0, 2).toUpperCase()}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.menuNombre}>{nombre}</div>
                    <div style={s.menuSub}>
                      {t("nav.cuenta_verificada")}
                      {totalPlantas != null && ` · ${totalPlantas} ${t("nav.jardin").toLowerCase()}`}
                    </div>
                  </div>
                  {confianzaPct != null && (
                    <span style={s.confianzaBadge}>{confianzaPct}%</span>
                  )}
                </div>

                <div style={s.menuDivider} />

                <button
                  style={s.menuItem}
                  onClick={() => { setMenuAbierto(false); router.push("/perfil"); }}
                >
                  <UserCircle size={16} strokeWidth={2} />
                  {t("nav.perfil")}
                </button>
                <button
                  style={s.menuItem}
                  onClick={() => { setMenuAbierto(false); router.push("/perfil#preferencias"); }}
                >
                  <Settings size={16} strokeWidth={2} />
                  {t("nav.ajustes")}
                </button>

                <div style={s.menuDivider} />

                <button
                  style={{ ...s.menuItem, color: color.danger }}
                  onClick={() => { setMenuAbierto(false); logout(); router.push("/login"); }}
                >
                  <LogOut size={16} strokeWidth={2} />
                  {t("nav.salir")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
    padding:      "12px 22px",
    background:   "rgba(29, 33, 42, 0.72)",
    backdropFilter: "blur(14px)",
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
    background:   color.surface,
    color:        color.textMuted,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "7px 14px",
    cursor:       "pointer",
    fontSize:     13,
    whiteSpace:   "nowrap",
    transition:   "color 0.15s ease, background 0.15s ease, border-color 0.15s ease",
  },
  enlaceActivo: {
    background:  color.surfaceRaised,
    color:       color.text,
    borderColor: color.accent,
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
  statBadge: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          5,
    background:   color.surface,
    color:        color.textMuted,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "7px 12px",
    fontSize:     13,
    whiteSpace:   "nowrap",
  },
  statBadgeBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          5,
    background:   color.surface,
    color:        color.textMuted,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "7px 12px",
    cursor:       "pointer",
    fontSize:     13,
    whiteSpace:   "nowrap",
  },
  temaBtn: {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    width:          30,
    height:         30,
    background:     color.surface,
    color:          color.textMuted,
    border:         `1px solid ${color.border}`,
    borderRadius:   radius.pill,
    cursor:         "pointer",
  },
  menuWrap: { position: "relative" },
  avatarBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          6,
    background:   color.surface,
    color:        color.text,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding:      "6px 10px 6px 6px",
    cursor:       "pointer",
    fontSize:     13,
  },
  menuPanel: {
    position:     "absolute",
    top:          "calc(100% + 8px)",
    right:        0,
    width:        260,
    background:   color.surfaceRaised,
    border:       `1px solid ${color.border}`,
    borderRadius: radius.lg,
    boxShadow:    shadow.raised,
    padding:      12,
    zIndex:       60,
  },
  menuCabecera: {
    display:    "flex",
    alignItems: "center",
    gap:        10,
    padding:    "2px 4px 10px",
  },
  fotoGrande: {
    width:        36,
    height:       36,
    borderRadius: "50%",
    objectFit:    "cover",
    flexShrink:   0,
    boxShadow:    `0 0 0 2px ${color.borderSoft}`,
  },
  inicialGrande: {
    width:          36,
    height:         36,
    borderRadius:   "50%",
    background:     color.accentSoft,
    color:          color.text,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       13,
    fontWeight:     700,
    flexShrink:     0,
  },
  menuNombre: {
    fontSize:     14,
    fontWeight:   600,
    color:        color.text,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  menuSub: {
    fontSize:     11,
    color:        color.textFaint,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  confianzaBadge: {
    fontSize:     11,
    fontWeight:   600,
    color:        color.moss,
    background:   color.mossSoft,
    borderRadius: radius.pill,
    padding:      "3px 8px",
    flexShrink:   0,
  },
  menuDivider: {
    height:     1,
    background: color.border,
    margin:     "4px 0",
  },
  menuItem: {
    display:      "flex",
    alignItems:   "center",
    gap:          9,
    width:        "100%",
    background:   "transparent",
    border:       "none",
    borderRadius: radius.md,
    padding:      "9px 8px",
    cursor:       "pointer",
    fontSize:     13,
    color:        color.text,
    textAlign:    "left",
  },
};

export default NavBar;
