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
 */
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipForward, Check, Sparkles } from "lucide-react";

import { useAuthStore } from "@/store/auth.store";
import { gamificationApi, type SoloSessionCompleteResult } from "@/lib/api";
import { useTranslation } from "@/components/I18nProvider";
import { color, radius, shadow, fontSerif } from "@/lib/theme";

const WORK_SECONDS  = 25 * 60;
const BREAK_SECONDS = 5 * 60;

type Fase = "config" | "trabajo" | "descanso";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function SoloSessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { accessToken: token, hidratado } = useAuthStore();
  const { t } = useTranslation();

  const [tarea, setTarea]   = useState(params.get("tarea") ?? "");
  const [fase, setFase]     = useState<Fase>("config");
  const [restante, setRestante] = useState(WORK_SECONDS);
  const [pausado, setPausado]   = useState(false);
  const [ronda, setRonda]       = useState(1);
  const [resultado, setResultado] = useState<SoloSessionCompleteResult | null>(null);
  const [guardando, setGuardando] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hidratado && !token) router.push("/login");
  }, [hidratado, token, router]);

  // ── Temporizador ────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase === "config" || pausado) return;

    intervalRef.current = setInterval(() => {
      setRestante(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fase, pausado]);

  // Cuando el tiempo llega a 0, reaccionar segun la fase
  useEffect(() => {
    if (restante !== 0 || fase === "config") return;

    if (fase === "trabajo") {
      completarRonda();
    } else if (fase === "descanso") {
      // El descanso terminado no hace nada solo: se espera a que la persona
      // elija "Otro Pomodoro" o "Terminar" desde la pantalla de descanso.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, fase]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const iniciar = () => {
    setFase("trabajo");
    setRestante(WORK_SECONDS);
    setPausado(false);
    setResultado(null);
  };

  const completarRonda = async () => {
    if (!token) return;
    setGuardando(true);
    try {
      const r = await gamificationApi.completeSoloSession(token, 1);
      setResultado(r);
    } catch {
      // Si falla el guardado no se bloquea el descanso: la persona igual
      // merece su pausa, aunque el XP no se haya podido registrar esta vez.
    } finally {
      setGuardando(false);
      setFase("descanso");
      setRestante(BREAK_SECONDS);
      setPausado(false);
    }
  };

  const otroPomodoro = () => {
    setRonda(r => r + 1);
    setFase("trabajo");
    setRestante(WORK_SECONDS);
    setPausado(false);
    setResultado(null);
  };

  const terminar = () => router.push("/dashboard");

  const total = fase === "trabajo" ? WORK_SECONDS : BREAK_SECONDS;
  const pct   = fase === "config" ? 0 : 1 - restante / total;

  return (
    <main style={s.main}>
      <div style={s.card}>
        <AnimatePresence mode="wait">
          {/* ── Configuración ── */}
          {fase === "config" && (
            <motion.div key="config" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 style={s.titulo}>{t("solo.titulo")}</h1>
              <label style={s.label}>{t("solo.label_tarea")}</label>
              <input
                style={s.input}
                placeholder={t("solo.placeholder_tarea")}
                maxLength={80}
                value={tarea}
                onChange={e => setTarea(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") iniciar(); }}
              />
              <motion.button
                style={s.btnPrimary}
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
                {fase === "trabajo" ? t("solo.fase_trabajo") : t("solo.fase_descanso")}
                {" — "}{t("solo.ronda")} {ronda}
              </span>

              {tarea.trim() && fase === "trabajo" && (
                <p style={s.tareaTexto}>{tarea}</p>
              )}

              <div style={s.circuloWrap}>
                <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="110" cy="110" r="98" fill="none" stroke={color.border} strokeWidth="10" />
                  <motion.circle
                    cx="110" cy="110" r="98" fill="none"
                    stroke={fase === "trabajo" ? color.accent : color.moss}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 98}
                    animate={{ strokeDashoffset: 2 * Math.PI * 98 * (1 - pct) }}
                    transition={{ duration: 0.5, ease: "linear" }}
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
                        {resultado.streak_increased && <> &nbsp;·&nbsp; 🔥 {resultado.streak_after}</>}
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
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.xl,
    boxShadow: shadow.card,
    padding: "36px 32px",
    textAlign: "center",
  },
  titulo: {
    fontFamily: fontSerif,
    fontSize: 24,
    color: color.text,
    marginBottom: 20,
  },
  label: {
    display: "block",
    textAlign: "left",
    fontSize: 13,
    color: color.textMuted,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    background: color.surfaceSunken,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    padding: "11px 14px",
    color: color.text,
    fontSize: 14,
    marginBottom: 20,
    outline: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    background: `linear-gradient(180deg, ${color.accentDeep}, ${color.clay})`,
    color: color.text,
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
    width: 220,
    height: 220,
    margin: "24px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tiempo: {
    position: "absolute",
    fontFamily: fontSerif,
    fontSize: 40,
    color: color.text,
  },
  controles: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
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
