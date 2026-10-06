"use client";

/**
 * Pomodoro en solitario.
 *
 * A diferencia de /session/[sessionId], esta pantalla no espera pareja, no
 * abre WebSocket ni WebRTC: el temporizador corre enteramente en el cliente
 * con setInterval. Al completar cada ronda de trabajo se llama al backend
 * (POST /gamification/solo/complete) para que la racha, el XP, los
 * FocusCoins y los logros avancen exactamente igual que en una sesión
 * emparejada — la única diferencia es que aquí no hay jardín ni video.
 *
 * Segunda pasada (oct. 2026): duración configurable, descanso largo cada 4
 * rondas (Pomodoro clásico), lista de tareas en vez de un solo campo,
 * contador de pomodoros del día (local, por fecha), notificaciones del
 * navegador para cuando la pestaña no está al frente, título de la pestaña
 * con el tiempo restante, control de volumen real (no solo silenciar) para
 * música y efectos, opción de no cortar la música en el descanso, y un
 * panel de ajustes para no amontonar todo eso en la barra superior.
 */
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, Check, Sparkles, Flame, Volume2, VolumeX,
  X, Settings2, Plus, Trash2, ListTodo, CalendarCheck2, BellRing,
} from "lucide-react";

import { useAuthStore } from "@/store/auth.store";
import { gamificationApi, type SoloSessionCompleteResult } from "@/lib/api";
import { useTranslation } from "@/components/I18nProvider";
import { color, radius, shadow, fontSerif, pageBackground } from "@/lib/theme";

type Fase = "config" | "trabajo" | "descanso";

interface TareaItem {
  id:     string;
  texto:  string;
  hecha:  boolean;
}

/** Descanso largo fijo cada 4 rondas, como el Pomodoro clásico. El corto sí
 *  es elegible por la persona (ver BREAK_PRESETS). */
const LONG_BREAK_MINUTES = 15;
const RONDAS_POR_DESCANSO_LARGO = 4;

const WORK_PRESETS  = [25, 50] as const;
const BREAK_PRESETS = [5, 10, 15] as const;

const SONIDOS = {
  inicio:       "/sounds/inicio.mp3",
  terminado:    "/sounds/terminado.mp3",
  reanudado:    "/sounds/reanudado.mp3",
  notificacion: "/sounds/notificacion.mp3",
} as const;

const PISTAS = [
  { id: "sakura", nombre: "Sakura",           src: "/sounds/fondo-sakura.mp3" },
  { id: "bosque", nombre: "Bosque tranquilo", src: "/sounds/fondo-bosque.mp3" },
  { id: "lluvia", nombre: "Lluvia",           src: "/sounds/fondo-lluvia.mp3" },
  { id: "musica", nombre: "Música",           src: "/sounds/fondo-musica.mp3" },
  { id: "pop",    nombre: "Música pop",       src: "/sounds/fondo-pop.mp3" },
] as const;

// ── Persistencia local (por navegador, no por cuenta) ───────────────────────
const K_VOL_MUSICA   = "sinka-volumen-musica";
const K_VOL_EFECTOS  = "sinka-volumen-efectos";
const K_PISTA        = "sinka-musica-pista";
const K_SEGUIR_DESC  = "sinka-seguir-musica-descanso";
const K_NOTIF        = "sinka-notificaciones-activas";
const K_TAREAS       = "sinka-tareas-pomodoro";
const K_RECIENTES    = "sinka-tareas-recientes";
const K_POMODOROS_HOY = "sinka-pomodoros-hoy";
const K_DUR_TRABAJO  = "sinka-duracion-trabajo";
const K_DUR_DESCANSO = "sinka-duracion-descanso";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function leerNumero(key: string, porDefecto: number): number {
  if (typeof window === "undefined") return porDefecto;
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? raw : porDefecto;
}

function leerBool(key: string, porDefecto: boolean): boolean {
  if (typeof window === "undefined") return porDefecto;
  const raw = localStorage.getItem(key);
  return raw === null ? porDefecto : raw === "1";
}

function leerPomodorosHoy(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(K_POMODOROS_HOY);
    if (!raw) return 0;
    const { fecha, n } = JSON.parse(raw) as { fecha: string; n: number };
    return fecha === hoyISO() ? n : 0;
  } catch {
    return 0;
  }
}

function sumarPomodoroHoy(): number {
  const siguiente = leerPomodorosHoy() + 1;
  localStorage.setItem(K_POMODOROS_HOY, JSON.stringify({ fecha: hoyISO(), n: siguiente }));
  return siguiente;
}

function crearId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function SoloSessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { accessToken: token, hidratado } = useAuthStore();
  const { t } = useTranslation();

  const [fase, setFase]       = useState<Fase>("config");
  const [restante, setRestante] = useState(WORK_PRESETS[0] * 60);
  const [pausado, setPausado]   = useState(false);
  const [ronda, setRonda]       = useState(1);
  const [esDescansoLargo, setEsDescansoLargo] = useState(false);
  const [resultado, setResultado] = useState<SoloSessionCompleteResult | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pomodorosHoy, setPomodorosHoy] = useState(0);

  // Duración elegible
  const [minTrabajo, setMinTrabajo]   = useState<number>(WORK_PRESETS[0]);
  const [minDescanso, setMinDescanso] = useState<number>(BREAK_PRESETS[0]);

  // Tareas
  const [tareas, setTareas] = useState<TareaItem[]>([]);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [tareaActualId, setTareaActualId] = useState<string | null>(null);
  const [recientes, setRecientes] = useState<string[]>([]);

  // Audio
  const [volumenMusica, setVolumenMusica]   = useState(0.5);
  const [volumenEfectos, setVolumenEfectos] = useState(0.55);
  const [pistaId, setPistaId] = useState<string>(PISTAS[0].id);
  const [seguirMusicaDescanso, setSeguirMusicaDescanso] = useState(false);
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

  // Notificaciones
  const [notifActivas, setNotifActivas] = useState(false);

  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fondoRef        = useRef<HTMLAudioElement | null>(null);
  const volMusicaRef    = useRef(volumenMusica);
  const volEfectosRef   = useRef(volumenEfectos);
  const notifActivasRef = useRef(notifActivas);

  const pista = PISTAS.find(p => p.id === pistaId) ?? PISTAS[0];

  // ── Cargar preferencias guardadas (todo por navegador, no por cuenta) ──────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const vm = leerNumero(K_VOL_MUSICA, 0.5);
    const ve = leerNumero(K_VOL_EFECTOS, 0.55);
    setVolumenMusica(vm);
    setVolumenEfectos(ve);
    volMusicaRef.current = vm;
    volEfectosRef.current = ve;

    const pistaGuardada = localStorage.getItem(K_PISTA);
    if (pistaGuardada && PISTAS.some(p => p.id === pistaGuardada)) setPistaId(pistaGuardada);

    setSeguirMusicaDescanso(leerBool(K_SEGUIR_DESC, false));
    const notif = leerBool(K_NOTIF, false) && "Notification" in window && Notification.permission === "granted";
    setNotifActivas(notif);
    notifActivasRef.current = notif;

    setMinTrabajo(leerNumero(K_DUR_TRABAJO, WORK_PRESETS[0]));
    const md = leerNumero(K_DUR_DESCANSO, BREAK_PRESETS[0]);
    setMinDescanso(md);
    setRestante(leerNumero(K_DUR_TRABAJO, WORK_PRESETS[0]) * 60);

    setPomodorosHoy(leerPomodorosHoy());

    let tareasGuardadas: TareaItem[] = [];
    try {
      const raw = localStorage.getItem(K_TAREAS);
      if (raw) tareasGuardadas = JSON.parse(raw);
    } catch { /* ignorar guardado corrupto */ }

    const tareaDeLink = params.get("tarea")?.trim();
    if (tareasGuardadas.length === 0 && tareaDeLink) {
      tareasGuardadas = [{ id: crearId(), texto: tareaDeLink, hecha: false }];
    }
    setTareas(tareasGuardadas);
    const primeraPendiente = tareasGuardadas.find(ta => !ta.hecha);
    if (primeraPendiente) setTareaActualId(primeraPendiente.id);

    try {
      const raw = localStorage.getItem(K_RECIENTES);
      if (raw) setRecientes(JSON.parse(raw));
    } catch { /* ignorar */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (hidratado && !token) router.push("/login"); }, [hidratado, token, router]);

  // ── Tareas ──────────────────────────────────────────────────────────────
  const persistirTareas = (lista: TareaItem[]) => {
    setTareas(lista);
    localStorage.setItem(K_TAREAS, JSON.stringify(lista));
  };

  const guardarReciente = (texto: string) => {
    setRecientes(prev => {
      const next = [texto, ...prev.filter(x => x !== texto)].slice(0, 6);
      localStorage.setItem(K_RECIENTES, JSON.stringify(next));
      return next;
    });
  };

  const agregarTarea = (textoCrudo: string) => {
    const texto = textoCrudo.trim();
    if (!texto) return;
    const item: TareaItem = { id: crearId(), texto, hecha: false };
    const siguiente = [...tareas, item];
    persistirTareas(siguiente);
    setTareaActualId(prev => prev ?? item.id);
    setNuevaTarea("");
    guardarReciente(texto);
  };

  const alternarTarea = (id: string) => {
    const siguiente = tareas.map(ta => ta.id === id ? { ...ta, hecha: !ta.hecha } : ta);
    persistirTareas(siguiente);
    if (siguiente.find(ta => ta.id === id)?.hecha && tareaActualId === id) {
      setTareaActualId(siguiente.find(ta => !ta.hecha)?.id ?? null);
    }
  };

  const eliminarTarea = (id: string) => {
    const siguiente = tareas.filter(ta => ta.id !== id);
    persistirTareas(siguiente);
    if (tareaActualId === id) setTareaActualId(siguiente.find(ta => !ta.hecha)?.id ?? null);
  };

  const tareaActual = tareas.find(ta => ta.id === tareaActualId) ?? null;

  // ── Audio ───────────────────────────────────────────────────────────────
  const cambiarVolumenMusica = (v: number) => {
    setVolumenMusica(v);
    volMusicaRef.current = v;
    localStorage.setItem(K_VOL_MUSICA, String(v));
    if (fondoRef.current) fondoRef.current.volume = v;
  };

  const cambiarVolumenEfectos = (v: number) => {
    setVolumenEfectos(v);
    volEfectosRef.current = v;
    localStorage.setItem(K_VOL_EFECTOS, String(v));
  };

  const silenciarMusica = () => cambiarVolumenMusica(volumenMusica > 0 ? 0 : 0.5);

  const cambiarPista = (id: string) => {
    setPistaId(id);
    localStorage.setItem(K_PISTA, id);
  };

  const alternarSeguirMusicaDescanso = () => {
    setSeguirMusicaDescanso(prev => {
      const next = !prev;
      localStorage.setItem(K_SEGUIR_DESC, next ? "1" : "0");
      return next;
    });
  };

  const sonar = (src: string) => {
    if (volEfectosRef.current <= 0) return;
    const a = new Audio(src);
    a.volume = volEfectosRef.current;
    a.play().catch(() => {}); // el navegador puede bloquear sin gesto previo; no es critico
  };

  // ── Notificaciones del navegador ────────────────────────────────────────
  const pedirNotificaciones = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (notifActivas) {
      setNotifActivas(false);
      notifActivasRef.current = false;
      localStorage.setItem(K_NOTIF, "0");
      return;
    }
    const permiso = await Notification.requestPermission();
    const activas = permiso === "granted";
    setNotifActivas(activas);
    notifActivasRef.current = activas;
    localStorage.setItem(K_NOTIF, activas ? "1" : "0");
  };

  const notificar = (tipo: "trabajo" | "descanso") => {
    if (!notifActivasRef.current) return;
    if (typeof document !== "undefined" && !document.hidden) return; // visible: el sonido alcanza
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
    const titulo = tipo === "trabajo" ? t("solo.notif_titulo_trabajo") : t("solo.notif_titulo_descanso");
    const cuerpo  = tipo === "trabajo" ? t("solo.notif_cuerpo_trabajo")  : t("solo.notif_cuerpo_descanso");
    try {
      new Notification(titulo, { body: cuerpo, icon: "/img/sinka-logo-negro.png" });
    } catch { /* algunos navegadores bloquean sin service worker; no es critico */ }
  };

  // ── Temporizador ────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase === "config" || pausado) return;
    intervalRef.current = setInterval(() => {
      setRestante(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fase, pausado]);

  const completarRonda = useCallback(async () => {
    if (!token) return;
    setGuardando(true);
    sonar(SONIDOS.terminado);
    notificar("trabajo");
    const nuevoTotal = sumarPomodoroHoy();
    setPomodorosHoy(nuevoTotal);
    try {
      const r = await gamificationApi.completeSoloSession(token, 1);
      setResultado(r);
      if (r.unlocked_achievements.length > 0) sonar(SONIDOS.notificacion);
    } catch {
      // Si falla el guardado no se bloquea el descanso: la persona igual
      // merece su pausa, aunque el XP no se haya podido registrar esta vez.
    } finally {
      const largo = ronda % RONDAS_POR_DESCANSO_LARGO === 0;
      setEsDescansoLargo(largo);
      setGuardando(false);
      setFase("descanso");
      setRestante((largo ? LONG_BREAK_MINUTES : minDescanso) * 60);
      setPausado(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ronda, minDescanso]);

  // Cuando el tiempo llega a 0, reaccionar segun la fase
  useEffect(() => {
    if (restante !== 0 || fase === "config") return;
    if (fase === "trabajo") {
      completarRonda();
    } else if (fase === "descanso") {
      notificar("descanso");
      // El descanso terminado no hace nada solo: se espera a que la persona
      // elija "Otro Pomodoro" o "Terminar" desde la pantalla de descanso.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, fase]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // Musica de fondo: suena en trabajo siempre, y en descanso solo si la
  // persona activo "seguir musica en el descanso". El volumen real se maneja
  // con audio.volume, no con play/pause, para que el slider sirva en vivo.
  useEffect(() => {
    const audio = fondoRef.current;
    if (!audio) return;
    audio.volume = volumenMusica;
    const debeSonar = volumenMusica > 0 && !pausado &&
      (fase === "trabajo" || (fase === "descanso" && seguirMusicaDescanso));
    if (debeSonar) audio.play().catch(() => {});
    else audio.pause();
  }, [fase, pausado, volumenMusica, seguirMusicaDescanso]);

  // Cambio de pista: el <audio> no vuelve a cargar solo con que cambie el
  // atributo src (el navegador no lo garantiza), asi que se fuerza con
  // load() y, si correspondia estar sonando, se retoma desde el principio.
  useEffect(() => {
    const audio = fondoRef.current;
    if (!audio) return;
    audio.load();
    audio.volume = volumenMusica;
    const debeSonar = volumenMusica > 0 && !pausado &&
      (fase === "trabajo" || (fase === "descanso" && seguirMusicaDescanso));
    if (debeSonar) audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pistaId]);

  // Titulo de la pestaña: muestra el tiempo restante para quien minimiza o
  // cambia de pestaña, sin tener que volver a esta para ver cuanto falta.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fase === "config") { document.title = "SINKA"; return; }
    const etiqueta = fase === "trabajo"
      ? t("solo.fase_trabajo")
      : (esDescansoLargo ? t("solo.descanso_largo_label") : t("solo.fase_descanso"));
    document.title = `${fmt(restante)} · ${etiqueta} — SINKA`;
  }, [restante, fase, esDescansoLargo, t]);

  useEffect(() => () => { if (typeof document !== "undefined") document.title = "SINKA"; }, []);

  const elegirDuracionTrabajo = (min: number) => {
    setMinTrabajo(min);
    localStorage.setItem(K_DUR_TRABAJO, String(min));
    setRestante(min * 60);
  };

  const elegirDuracionDescanso = (min: number) => {
    setMinDescanso(min);
    localStorage.setItem(K_DUR_DESCANSO, String(min));
  };

  const iniciar = () => {
    setFase("trabajo");
    setRestante(minTrabajo * 60);
    setPausado(false);
    setResultado(null);
    sonar(SONIDOS.inicio);
  };

  const otroPomodoro = () => {
    setRonda(r => r + 1);
    setFase("trabajo");
    setRestante(minTrabajo * 60);
    setEsDescansoLargo(false);
    setPausado(false);
    setResultado(null);
    sonar(SONIDOS.reanudado);
  };

  const terminar = () => router.push("/dashboard");

  // Antes no habia forma de salir durante la fase de trabajo (solo existia
  // "Terminar" en el descanso) — confirma si hay una ronda en curso para no
  // perderla sin querer con un click accidental.
  const salir = () => {
    if (fase === "trabajo" && !window.confirm(t("solo.confirmar_salir"))) return;
    router.push("/dashboard");
  };

  const total = fase === "trabajo" ? minTrabajo * 60 : (esDescansoLargo ? LONG_BREAK_MINUTES * 60 : minDescanso * 60);
  const pct   = fase === "config" ? 0 : 1 - restante / total;

  return (
    <main style={s.main}>
      {/* Musica de fondo (loop, oculta) — se controla solo via fondoRef */}
      <audio ref={fondoRef} src={pista.src} loop preload="none" />

      <div style={s.decoGlowA} />
      <div style={s.decoGlowB} />

      <div style={s.card}>
        {fase !== "config" && (
          <div style={s.barraSuperior}>
            <button style={s.btnSalir} onClick={salir} title={t("solo.salir")}>
              <X size={15} strokeWidth={2} />
              <span>{t("solo.salir")}</span>
            </button>

            <div style={s.badgeHoy} title={t("solo.pomodoros_hoy")}>
              <CalendarCheck2 size={13} strokeWidth={2} />
              <span>{pomodorosHoy} {t("solo.pomodoros_hoy")}</span>
            </div>

            <div style={{ position: "relative" }}>
              <button
                style={s.btnSilencio}
                onClick={() => setAjustesAbiertos(a => !a)}
                title={t("solo.musica_fondo")}
              >
                <Settings2 size={16} />
              </button>

              <AnimatePresence>
                {ajustesAbiertos && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    style={s.panelAjustes}
                  >
                    <label style={s.labelAjuste}>{t("solo.musica_fondo")}</label>
                    <select
                      style={s.selectPista}
                      value={pistaId}
                      onChange={e => cambiarPista(e.target.value)}
                    >
                      {PISTAS.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>

                    <div style={s.filaVolumen}>
                      <button style={s.btnVolMini} onClick={silenciarMusica}>
                        {volumenMusica > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      </button>
                      <input
                        style={s.rango}
                        type="range" min={0} max={1} step={0.05}
                        value={volumenMusica}
                        onChange={e => cambiarVolumenMusica(Number(e.target.value))}
                      />
                    </div>

                    <label style={s.labelAjuste}>{t("solo.volumen_efectos")}</label>
                    <div style={s.filaVolumen}>
                      <button
                        style={s.btnVolMini}
                        onClick={() => cambiarVolumenEfectos(volumenEfectos > 0 ? 0 : 0.55)}
                      >
                        {volumenEfectos > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
                      </button>
                      <input
                        style={s.rango}
                        type="range" min={0} max={1} step={0.05}
                        value={volumenEfectos}
                        onChange={e => cambiarVolumenEfectos(Number(e.target.value))}
                      />
                    </div>

                    <label style={s.checkAjuste}>
                      <input
                        type="checkbox"
                        checked={seguirMusicaDescanso}
                        onChange={alternarSeguirMusicaDescanso}
                      />
                      {t("solo.seguir_musica_descanso")}
                    </label>

                    <label style={s.checkAjuste}>
                      <input type="checkbox" checked={notifActivas} onChange={pedirNotificaciones} />
                      <BellRing size={13} style={{ marginRight: 2 }} />
                      {t("solo.notificaciones")}
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── Configuración ── */}
          {fase === "config" && (
            <motion.div key="config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 style={s.titulo}>{t("solo.titulo")}</h1>

              {/* Lista de tareas */}
              <label style={s.label}><ListTodo size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{t("solo.label_tarea")}</label>
              <div style={s.filaAgregarTarea}>
                <input
                  style={s.input}
                  placeholder={t("solo.placeholder_nueva_tarea")}
                  maxLength={80}
                  value={nuevaTarea}
                  onChange={e => setNuevaTarea(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") agregarTarea(nuevaTarea); }}
                />
                <button style={s.btnAgregar} onClick={() => agregarTarea(nuevaTarea)} title={t("solo.agregar_tarea")}>
                  <Plus size={16} />
                </button>
              </div>

              {recientes.length > 0 && tareas.length === 0 && (
                <div style={s.chipsRecientes}>
                  {recientes.map(texto => (
                    <button key={texto} style={s.chipReciente} onClick={() => agregarTarea(texto)}>
                      {texto}
                    </button>
                  ))}
                </div>
              )}

              {tareas.length === 0 ? (
                <p style={s.hintTareas}>{t("solo.sin_tareas")}</p>
              ) : (
                <div style={s.listaTareas}>
                  <AnimatePresence initial={false}>
                    {tareas.map(ta => (
                      <motion.div
                        key={ta.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={s.filaTarea}
                        onClick={() => setTareaActualId(ta.id)}
                      >
                        <button
                          style={{ ...s.checkTarea, ...(ta.hecha ? s.checkTareaHecha : {}) }}
                          onClick={e => { e.stopPropagation(); alternarTarea(ta.id); }}
                        >
                          {ta.hecha && <Check size={11} strokeWidth={3} />}
                        </button>
                        <span style={{
                          ...s.textoTarea,
                          ...(ta.hecha ? s.textoTareaHecha : {}),
                          ...(ta.id === tareaActualId && !ta.hecha ? s.textoTareaActual : {}),
                        }}>
                          {ta.texto}
                        </span>
                        <button
                          style={s.btnEliminarTarea}
                          onClick={e => { e.stopPropagation(); eliminarTarea(ta.id); }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Duraciones */}
              <label style={{ ...s.label, marginTop: 18 }}>{t("solo.duracion_trabajo")}</label>
              <div style={s.chipsGrupo}>
                {WORK_PRESETS.map(min => (
                  <button
                    key={min}
                    style={{ ...s.chipPreset, ...(min === minTrabajo ? s.chipPresetActivo : {}) }}
                    onClick={() => elegirDuracionTrabajo(min)}
                  >
                    {min} {t("solo.min")}
                  </button>
                ))}
              </div>

              <label style={{ ...s.label, marginTop: 14 }}>{t("solo.duracion_descanso")}</label>
              <div style={s.chipsGrupo}>
                {BREAK_PRESETS.map(min => (
                  <button
                    key={min}
                    style={{ ...s.chipPreset, ...(min === minDescanso ? s.chipPresetActivo : {}) }}
                    onClick={() => elegirDuracionDescanso(min)}
                  >
                    {min} {t("solo.min")}
                  </button>
                ))}
              </div>
              <p style={s.hintDescansoLargo}>
                <Sparkles size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
                {t("solo.descanso_largo")}
              </p>

              <motion.button
                style={{ ...s.btnPrimary, marginTop: 22 }}
                whileHover={{ y: -1, boxShadow: shadow.glowSoft }}
                whileTap={{ scale: 0.98 }}
                onClick={iniciar}
              >
                <Play size={16} strokeWidth={2} />
                {t("solo.iniciar")}
              </motion.button>
              <button style={s.btnGhost} onClick={() => router.push("/dashboard")}>
                {t("solo.volver")}
              </button>
            </motion.div>
          )}

          {/* ── Trabajo / Descanso ── */}
          {(fase === "trabajo" || fase === "descanso") && (
            <motion.div key="timer" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={s.timerWrap}>
              <span style={s.faseLabel}>
                {fase === "trabajo"
                  ? t("solo.fase_trabajo")
                  : (esDescansoLargo ? t("solo.descanso_largo_label") : t("solo.fase_descanso"))}
                {" — "}{t("solo.ronda")} {ronda}
              </span>

              {fase === "trabajo" && tareaActual && (
                <p style={s.tareaTexto}>{tareaActual.texto}</p>
              )}

              <div style={s.circuloWrap}>
                <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="130" cy="130" r="116" fill="none" stroke={color.border} strokeWidth="11" />
                  <motion.circle
                    cx="130" cy="130" r="116" fill="none"
                    stroke={fase === "trabajo" ? color.accent : color.moss}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 116}
                    animate={{ strokeDashoffset: 2 * Math.PI * 116 * (1 - pct) }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    style={{ filter: `drop-shadow(0 0 8px rgba(var(--c-shadow-glow), ${pausado ? 0 : 0.35}))` }}
                  />
                </svg>
                <span style={s.tiempo}>{fmt(restante)}</span>
              </div>

              {fase === "trabajo" && (
                <div style={s.controles}>
                  <button style={s.btnIcono} onClick={() => setPausado(p => !p)}>
                    {pausado ? <Play size={18} /> : <Pause size={18} />}
                    <span>{pausado ? t("solo.reanudar") : t("solo.pausar")}</span>
                  </button>
                </div>
              )}

              {fase === "trabajo" && tareas.length > 1 && (
                <div style={s.miniListaTareas}>
                  {tareas.filter(ta => !ta.hecha).slice(0, 4).map(ta => (
                    <button
                      key={ta.id}
                      style={{ ...s.miniTareaChip, ...(ta.id === tareaActualId ? s.miniTareaChipActiva : {}) }}
                      onClick={() => setTareaActualId(ta.id)}
                    >
                      {ta.texto}
                    </button>
                  ))}
                </div>
              )}

              {fase === "descanso" && (
                <div style={s.postRonda}>
                  {guardando && <p style={s.hint}>...</p>}
                  {resultado && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={s.resultadoBox}
                    >
                      <div style={s.resultadoTitulo}>
                        <Check size={16} color={color.success} />
                        {t("solo.pomodoro_listo")}
                      </div>
                      <p style={s.resultadoLinea}>
                        +{resultado.xp_earned} XP &nbsp;·&nbsp; +{resultado.fc_earned} FC
                        {resultado.streak_increased && (
                          <> &nbsp;·&nbsp; <Flame size={13} strokeWidth={2} color={color.accent} style={{ verticalAlign: -2 }} /> {resultado.streak_after}</>
                        )}
                      </p>
                      {resultado.unlocked_achievements.length > 0 && (
                        <p style={s.logroLinea}>
                          <Sparkles size={14} color={color.accent} />
                          {t("solo.logro_nuevo")}
                        </p>
                      )}
                    </motion.div>
                  )}

                  <div style={s.controles}>
                    <button style={s.btnGhost} onClick={() => { setRestante(0); }}>
                      <SkipForward size={16} />
                      {t("solo.saltar_descanso")}
                    </button>
                  </div>
                  <div style={{ ...s.controles, marginTop: 10 }}>
                    <motion.button
                      style={s.btnPrimary}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={otroPomodoro}
                    >
                      {t("solo.otro_pomodoro")}
                    </motion.button>
                    <button style={s.btnGhost} onClick={terminar}>
                      {t("solo.terminar")}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function SoloSessionPage() {
  return (
    <Suspense fallback={null}>
      <SoloSessionInner />
    </Suspense>
  );
}

const s: Record<string, React.CSSProperties> = {
  main: {
    position: "relative",
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    overflow: "hidden",
    background: pageBackground,
  },
  // Dos manchas de luz decorativas, igual que el resto de la app, para que
  // esta pantalla no se sienta como la única plana sobre fondo liso.
  decoGlowA: {
    position: "absolute", top: "-10%", left: "-8%", width: 360, height: 360,
    borderRadius: "50%", background: "var(--c-bg-glow-2)", filter: "blur(60px)", pointerEvents: "none",
  },
  decoGlowB: {
    position: "absolute", bottom: "-14%", right: "-10%", width: 420, height: 420,
    borderRadius: "50%", background: "var(--c-bg-glow-1)", filter: "blur(70px)", pointerEvents: "none",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 540,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.xl,
    boxShadow: shadow.card,
    padding: "28px 40px 44px",
    textAlign: "center",
  },
  barraSuperior: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            8,
    marginBottom:   18,
  },
  btnSalir: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          5,
    background:   "transparent",
    border:       `1px solid ${color.border}`,
    borderRadius: radius.pill,
    color:        color.textMuted,
    fontSize:     12,
    padding:      "6px 12px 6px 10px",
    cursor:       "pointer",
  },
  badgeHoy: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          5,
    background:   color.accentSoft,
    color:        color.accent,
    borderRadius: radius.pill,
    fontSize:     11,
    fontWeight:   600,
    padding:      "5px 10px",
    whiteSpace:   "nowrap",
  },
  btnSilencio: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    flexShrink: 0,
    background: "transparent",
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    color: color.textMuted,
    cursor: "pointer",
  },
  panelAjustes: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 20,
    width: 220,
    background: color.surfaceRaised,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    boxShadow: shadow.raised,
    padding: "14px 14px 12px",
    textAlign: "left",
  },
  labelAjuste: {
    display: "block", fontSize: 11, color: color.textMuted, marginBottom: 5, marginTop: 10,
  },
  selectPista: {
    width: "100%",
    background: color.surfaceSunken,
    border: `1px solid ${color.border}`,
    borderRadius: radius.sm,
    color: color.text,
    fontSize: 12,
    padding: "6px 8px",
    cursor: "pointer",
  },
  filaVolumen: { display: "flex", alignItems: "center", gap: 8 },
  btnVolMini: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 24, height: 24, flexShrink: 0, background: "transparent",
    border: "none", color: color.textMuted, cursor: "pointer", padding: 0,
  },
  rango: { flex: 1, accentColor: color.accent, cursor: "pointer" },
  checkAjuste: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 11.5,
    color: color.textMuted, marginTop: 12, cursor: "pointer", lineHeight: 1.4,
  },
  titulo: {
    fontFamily: fontSerif,
    fontSize: 24,
    color: color.text,
    marginBottom: 18,
  },
  label: {
    display: "block",
    textAlign: "left",
    fontSize: 13,
    color: color.textMuted,
    marginBottom: 6,
  },
  filaAgregarTarea: { display: "flex", gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    background: color.surfaceSunken,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: "11px 14px",
    color: color.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  btnAgregar: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 42, flexShrink: 0,
    background: color.accentSoft, color: color.accent,
    border: "none", borderRadius: radius.md, cursor: "pointer",
  },
  chipsRecientes: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  chipReciente: {
    background: color.surfaceSunken, border: `1px solid ${color.border}`,
    borderRadius: radius.pill, color: color.textMuted, fontSize: 11.5,
    padding: "5px 11px", cursor: "pointer",
  },
  hintTareas: { fontSize: 12.5, color: color.textFaint, marginBottom: 14, textAlign: "left" },
  listaTareas: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  filaTarea: {
    display: "flex", alignItems: "center", gap: 10,
    background: color.surfaceSunken, border: `1px solid ${color.border}`,
    borderRadius: radius.sm, padding: "8px 10px", cursor: "pointer", overflow: "hidden",
  },
  checkTarea: {
    width: 18, height: 18, flexShrink: 0, borderRadius: "50%",
    border: `1.5px solid ${color.border}`, background: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: color.bg, cursor: "pointer", padding: 0,
  },
  checkTareaHecha: { background: color.moss, borderColor: color.moss, color: color.bg },
  textoTarea: { flex: 1, fontSize: 13.5, color: color.text, textAlign: "left" },
  textoTareaHecha: { color: color.textFaint, textDecoration: "line-through" },
  textoTareaActual: { color: color.accent, fontWeight: 600 },
  btnEliminarTarea: {
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "transparent", border: "none", color: color.textFaint, cursor: "pointer", padding: 2,
  },
  chipsGrupo: { display: "flex", gap: 8, marginBottom: 4 },
  chipPreset: {
    flex: 1, background: color.surfaceSunken, border: `1px solid ${color.border}`,
    borderRadius: radius.sm, color: color.textMuted, fontSize: 13, fontWeight: 600,
    padding: "9px 0", cursor: "pointer",
  },
  chipPresetActivo: {
    background: color.accentSoft, borderColor: color.accent, color: color.accent,
  },
  hintDescansoLargo: { fontSize: 11.5, color: color.textFaint, marginTop: 8, textAlign: "left" },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    background: `linear-gradient(180deg, ${color.accent}, ${color.accentDeep})`,
    color: "#fff",
    border: "none",
    borderRadius: radius.pill,
    padding: "13px 28px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15,
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "transparent",
    color: color.textMuted,
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding: "9px 18px",
    cursor: "pointer",
    fontSize: 13,
    marginTop: 12,
  },
  btnIcono: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "transparent",
    color: color.textMuted,
    border: `1px solid ${color.border}`,
    borderRadius: radius.pill,
    padding: "10px 20px",
    cursor: "pointer",
    fontSize: 13,
  },
  timerWrap: { display: "flex", flexDirection: "column", alignItems: "center" },
  faseLabel: {
    fontSize: 13,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: color.textMuted,
  },
  tareaTexto: {
    fontFamily: fontSerif,
    fontSize: 16,
    color: color.text,
    marginTop: 8,
    marginBottom: 0,
  },
  circuloWrap: {
    position: "relative",
    width: 260,
    height: 260,
    margin: "24px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tiempo: {
    position: "absolute",
    fontFamily: fontSerif,
    fontSize: 48,
    color: color.text,
  },
  controles: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  miniListaTareas: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 16 },
  miniTareaChip: {
    background: color.surfaceSunken, border: `1px solid ${color.border}`,
    borderRadius: radius.pill, color: color.textMuted, fontSize: 11.5,
    padding: "5px 11px", cursor: "pointer", maxWidth: 160, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  miniTareaChipActiva: { background: color.accentSoft, borderColor: color.accent, color: color.accent },
  postRonda: { width: "100%" },
  hint: { color: color.textFaint, fontSize: 13 },
  resultadoBox: {
    background: color.surfaceSunken,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: "14px 16px",
    marginBottom: 16,
  },
  resultadoTitulo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 14,
    color: color.text,
    fontWeight: 600,
  },
  resultadoLinea: {
    fontSize: 13,
    color: color.textMuted,
    marginTop: 6,
  },
  logroLinea: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontSize: 12,
    color: color.accent,
    marginTop: 8,
  },
};
