"use client";

/**
 * Onboarding de cuatro pasos.
 *
 * Solo se muestra al registrarse. Quien ya lo completó entra directo al
 * dashboard: repetirlo en cada ingreso sería una molestia.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { catalogApi, profileApi, type Topic } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const AVATARES = ["🌱", "🌿", "🍃", "🌸", "🌻", "🌙", "⭐", "🔥", "💧", "🗻"];
const MAX_INTERESES = 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { accessToken: token, user, setUser, hidratado } = useAuthStore();

  const [paso,      setPaso]      = useState(1);
  const [alias,     setAlias]     = useState("");
  const [avatar,    setAvatar]    = useState(AVATARES[0]);
  const [intereses, setIntereses] = useState<string[]>([]);
  const [topics,    setTopics]    = useState<Topic[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    if (user?.onboarding_completed) { router.push("/dashboard"); return; }
    // Solo se propone el nombre si el campo sigue vacio. Este efecto vuelve a
    // correr cuando cambia el usuario, y rellenarlo siempre borraba lo que la
    // persona estaba escribiendo.
    setAlias((actual) => actual || user?.username || "");
    catalogApi.topics().then((r) => setTopics(r.topics)).catch(() => setTopics([]));
  }, [token, user, router, hidratado]);

  const alternarInteres = (slug: string) => {
    setIntereses((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length < MAX_INTERESES ? [...prev, slug] : prev,
    );
  };

  const terminar = async () => {
    if (!token) return;
    setGuardando(true);
    setError("");
    try {
      const perfil = await profileApi.completeOnboarding(token, {
        alias: alias.trim(),
        avatar_url: avatar,
        interests: intereses,
      });
      setUser(perfil);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar tu perfil.");
      setGuardando(false);
    }
  };

  const aliasValido = alias.trim().length >= 2;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.dots}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} style={{ ...s.dot, ...(n <= paso ? s.dotOn : {}) }} />
          ))}
        </div>

        {error && <div style={s.error}>{error}</div>}

        {/* ── Paso 1: quién eres ── */}
        {paso === 1 && (
          <>
            <h1 style={s.title}>¿Cómo quieres que te llamen?</h1>
            <p style={s.sub}>Este es el nombre que verá tu compañero de sesión.</p>

            <input
              style={s.input}
              value={alias}
              maxLength={50}
              placeholder="Tu nombre o apodo"
              onChange={(e) => setAlias(e.target.value)}
            />

            <p style={s.label}>Elige tu símbolo</p>
            <div style={s.avatarGrid}>
              {AVATARES.map((a) => (
                <button
                  key={a}
                  style={{ ...s.avatarBtn, ...(avatar === a ? s.avatarOn : {}) }}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>

            <button
              style={{ ...s.btn, opacity: aliasValido ? 1 : 0.45 }}
              disabled={!aliasValido}
              onClick={() => setPaso(2)}
            >
              Continuar →
            </button>
          </>
        )}

        {/* ── Paso 2: en qué trabajas ── */}
        {paso === 2 && (
          <>
            <h1 style={s.title}>¿En qué sueles trabajar?</h1>
            <p style={s.sub}>
              Elige hasta {MAX_INTERESES} áreas. Nos sirven para emparejarte con
              gente que hace algo parecido a lo tuyo.
            </p>

            <div style={s.topicGrid}>
              {topics.map((t) => (
                <button
                  key={t.slug}
                  style={{
                    ...s.topicBtn,
                    ...(intereses.includes(t.slug) ? s.topicOn : {}),
                  }}
                  onClick={() => alternarInteres(t.slug)}
                >
                  {t.label_es}
                </button>
              ))}
            </div>

            <p style={s.counter}>{intereses.length}/{MAX_INTERESES} elegidas</p>

            <div style={s.row}>
              <button style={s.btnGhost} onClick={() => setPaso(1)}>← Atrás</button>
              <button style={s.btn} onClick={() => setPaso(3)}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── Paso 3: cómo funciona ── */}
        {paso === 3 && (
          <>
            <h1 style={s.title}>Así funciona SINKA</h1>

            <ol style={s.lista}>
              <li>Escribes en qué vas a trabajar y eliges tu área.</li>
              <li>Te conectamos con alguien que quiere concentrarse al mismo tiempo.</li>
              <li>Trabajan 25 minutos en silencio, viéndose por cámara si quieren.</li>
              <li>En el descanso pueden conversar unos minutos.</li>
              <li>Al terminar ganas experiencia y monedas, y tu racha crece.</li>
            </ol>

            <p style={s.nota}>
              La cámara siempre es opcional. Si prefieres no mostrarte, el chat
              cumple la misma función de acompañamiento.
            </p>

            <div style={s.row}>
              <button style={s.btnGhost} onClick={() => setPaso(2)}>← Atrás</button>
              <button style={s.btn} onClick={() => setPaso(4)}>Continuar →</button>
            </div>
          </>
        )}

        {/* ── Paso 4: listo ── */}
        {paso === 4 && (
          <>
            <div style={s.bigAvatar}>{avatar}</div>
            <h1 style={s.title}>Todo listo, {alias.trim()}</h1>
            <p style={s.sub}>
              Tu jardín empieza vacío. Cada amistad que cultives hará crecer una
              planta.
            </p>

            <div style={s.row}>
              <button style={s.btnGhost} onClick={() => setPaso(3)}>← Atrás</button>
              <button
                style={{ ...s.btn, opacity: guardando ? 0.6 : 1 }}
                disabled={guardando}
                onClick={terminar}
              >
                {guardando ? "Guardando…" : "Empezar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh", background: "#1a1714", color: "#f5f0e8",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    background: "#221e1a", borderRadius: 16, padding: 36,
    width: "100%", maxWidth: 480,
  },
  dots: { display: "flex", gap: 6, justifyContent: "center", marginBottom: 28 },
  dot:  { width: 28, height: 4, borderRadius: 2, background: "#3a332b" },
  dotOn: { background: "#7fa05a" },
  title: { fontSize: 22, margin: "0 0 8px", textAlign: "center" },
  sub:   { color: "#8b8378", fontSize: 14, lineHeight: 1.6, textAlign: "center", margin: "0 0 20px" },
  label: { color: "#c4b99a", fontSize: 13, margin: "20px 0 10px" },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#f5f0e8", fontSize: 15,
  },
  avatarGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  avatarBtn: {
    width: 46, height: 46, fontSize: 22, borderRadius: 10,
    border: "1px solid #3a332b", background: "#1a1714", cursor: "pointer",
  },
  avatarOn: { borderColor: "#7fa05a", background: "#2a3524" },
  bigAvatar: { fontSize: 64, textAlign: "center", marginBottom: 8 },
  topicGrid: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  topicBtn: {
    padding: "8px 14px", borderRadius: 20, fontSize: 13,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#c4b99a", cursor: "pointer",
  },
  topicOn: { borderColor: "#7fa05a", background: "#2a3524", color: "#f5f0e8" },
  counter: { color: "#8b8378", fontSize: 12, textAlign: "center", margin: "0 0 20px" },
  lista: { color: "#c4b99a", fontSize: 14, lineHeight: 2, paddingLeft: 20, margin: "0 0 16px" },
  nota:  { color: "#8b8378", fontSize: 12, lineHeight: 1.6, margin: "0 0 20px" },
  row:   { display: "flex", gap: 10, marginTop: 8 },
  btn: {
    flex: 1, padding: "12px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer",
    fontSize: 15, fontWeight: 600,
  },
  btnGhost: {
    flex: "0 0 auto", padding: "12px 18px", borderRadius: 8,
    border: "1px solid #3a332b", background: "none",
    color: "#8b8378", cursor: "pointer", fontSize: 14,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13,
  },
};
