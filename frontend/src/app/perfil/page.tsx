"use client";

/**
 * Perfil y ajustes.
 *
 * Datos personales, idioma, tema y el puntaje de confianza con su explicacion.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { profileApi, trustApi, type TrustState } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

const AVATARES = ["🌱", "🌿", "🍃", "🌸", "🌻", "🌙", "⭐", "🔥", "💧", "🗻"];

const LADO_FOTO   = 256;              // pixeles del lado del cuadrado final
const MAX_ARCHIVO = 5 * 1024 * 1024;  // 5 MB de entrada

/**
 * Recorta la imagen en cuadrado, la reduce y la devuelve lista para guardar.
 *
 * El trabajo se hace en el navegador a proposito. Una foto de celular pesa
 * varios megabytes y aqui queda en unas decenas de kilobytes, asi que no hay
 * que subir el archivo original ni montar un servicio de almacenamiento
 * aparte. La imagen viaja incrustada en el perfil, como el resto de sus datos.
 */
async function prepararFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) {
    throw new Error("Ese archivo no es una imagen.");
  }
  if (archivo.size > MAX_ARCHIVO) {
    throw new Error("La imagen pesa más de 5 MB. Elige una más liviana.");
  }

  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload  = () => ok(i);
      i.onerror = () => mal(new Error("No se pudo leer la imagen."));
      i.src = url;
    });

    // Recorte centrado al cuadrado
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const x = (img.naturalWidth  - lado) / 2;
    const y = (img.naturalHeight - lado) / 2;

    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = LADO_FOTO;
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");

    ctx.drawImage(img, x, y, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
    return lienzo.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PerfilPage() {
  const router = useRouter();
  const { accessToken: token, user, setUser, logout, hidratado } = useAuthStore();

  const [alias,  setAlias]  = useState("");
  const [bio,    setBio]    = useState("");
  const [avatar, setAvatar] = useState("");
  const [idioma, setIdioma] = useState<"es" | "en">("es");
  const [tema,   setTema]   = useState<"light" | "dark">("dark");

  const [trust,   setTrust]   = useState<TrustState | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error,   setError]   = useState("");

  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  /** Una foto se distingue de un símbolo porque es una imagen incrustada. */
  const esImagen = avatar.startsWith("data:image") || avatar.startsWith("http");

  const subirFoto = async (archivo: File) => {
    setProcesandoFoto(true);
    try {
      setAvatar(await prepararFoto(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la imagen.");
    } finally {
      setProcesandoFoto(false);
    }
  };

  useEffect(() => {
    if (!hidratado) return;   // aun no se leyo la sesion guardada
    if (!token) { router.push("/login"); return; }
    if (user) {
      setAlias(user.alias ?? user.username);
      setBio(user.bio ?? "");
      setAvatar(user.avatar_url ?? AVATARES[0]);
      setIdioma(user.language);
      setTema(user.theme);
    }
    trustApi.me(token).then(setTrust).catch(() => setTrust(null));
  }, [token, user, router, hidratado]);

  /**
   * Validacion antes de mandar. El servidor tiene las mismas reglas, pero es
   * mejor avisar aqui que dejar que el guardado falle y mostrar un error.
   */
  const problema = (() => {
    const a = alias.trim();
    if (a.length < 2)  return "El nombre visible necesita al menos 2 caracteres.";
    if (a.length > 50) return "El nombre visible no puede pasar de 50 caracteres.";
    if (bio.length > 280) return "La descripción no puede pasar de 280 caracteres.";
    return "";
  })();

  const hayCambios =
    !!user && (
      alias.trim() !== (user.alias ?? user.username) ||
      bio.trim()   !== (user.bio ?? "") ||
      avatar       !== (user.avatar_url ?? AVATARES[0]) ||
      idioma       !== user.language ||
      tema         !== user.theme
    );

  const guardar = useCallback(async () => {
    if (!token) return;
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const actualizado = await profileApi.update(token, {
        alias: alias.trim(),
        bio: bio.trim(),
        avatar_url: avatar,
        language: idioma,
        theme: tema,
      });
      setUser(actualizado);
      setMensaje("Cambios guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }, [token, alias, bio, avatar, idioma, tema, setUser]);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.back} onClick={() => router.push("/dashboard")}>← Volver</button>
        <h1 style={s.title}>Perfil</h1>
      </header>

      {error   && <div style={s.error}>{error}</div>}
      {mensaje && <div style={s.ok}>{mensaje}</div>}

      <section style={s.card}>
        <h2 style={s.cardTitle}>Cómo te ven los demás</h2>

        <p style={s.label}>Tu foto</p>
        <div style={s.fotoFila}>
          <div style={s.fotoPrevia}>
            {esImagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Tu foto de perfil" style={s.fotoImg} />
            ) : (
              <span style={{ fontSize: 34 }}>{avatar || "🌱"}</span>
            )}
          </div>

          <div style={s.fotoAcciones}>
            <input
              ref={archivoRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirFoto(f);
                e.target.value = "";   // permite volver a elegir el mismo archivo
              }}
            />
            <button
              style={s.btnFoto}
              disabled={procesandoFoto}
              onClick={() => archivoRef.current?.click()}
            >
              {procesandoFoto ? "Procesando…" : esImagen ? "Cambiar foto" : "Subir una foto"}
            </button>

            {esImagen && (
              <button style={s.btnQuitar} onClick={() => setAvatar(AVATARES[0])}>
                Quitar
              </button>
            )}

            <span style={s.fotoNota}>
              JPG o PNG, hasta 5 MB. Se recorta en cuadrado y se reduce antes de guardarla.
            </span>
          </div>
        </div>

        <p style={s.label}>O elige un símbolo</p>
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

        <p style={s.label}>Nombre visible</p>
        <input
          style={s.input}
          value={alias}
          maxLength={50}
          onChange={(e) => setAlias(e.target.value)}
        />

        <p style={s.label}>Sobre ti</p>
        <textarea
          style={{ ...s.input, minHeight: 70, resize: "vertical" }}
          value={bio}
          maxLength={280}
          placeholder="Una línea sobre en qué trabajas"
          onChange={(e) => setBio(e.target.value)}
        />
        <span style={s.muted}>{bio.length}/280</span>
      </section>

      <section style={s.card}>
        <h2 style={s.cardTitle}>Preferencias</h2>

        <p style={s.label}>Idioma</p>
        <div style={s.chips}>
          <button
            style={{ ...s.chip, ...(idioma === "es" ? s.chipOn : {}) }}
            onClick={() => setIdioma("es")}
          >
            Español
          </button>
          <button
            style={{ ...s.chip, ...(idioma === "en" ? s.chipOn : {}) }}
            onClick={() => setIdioma("en")}
          >
            English
          </button>
        </div>

        <p style={s.label}>Tema</p>
        <div style={s.chips}>
          <button
            style={{ ...s.chip, ...(tema === "dark" ? s.chipOn : {}) }}
            onClick={() => setTema("dark")}
          >
            Oscuro
          </button>
          <button
            style={{ ...s.chip, ...(tema === "light" ? s.chipOn : {}) }}
            onClick={() => setTema("light")}
          >
            Claro
          </button>
        </div>
      </section>

      {trust && (
        <section style={s.card}>
          <h2 style={s.cardTitle}>Confianza</h2>

          <div style={s.trustRow}>
            <span style={s.trustScore}>{trust.score}</span>
            <span style={s.muted}>de {trust.max_score} · {trust.level}</span>
          </div>

          <div style={s.barTrack}>
            <div style={{
              ...s.barFill,
              width: `${trust.score}%`,
              background: trust.low_priority ? "#c48a5a" : "#7fa05a",
            }} />
          </div>

          {trust.should_warn ? (
            <p style={s.aviso}>
              Tu puntaje bajó porque saliste de {trust.sessions_abandoned}{" "}
              {trust.sessions_abandoned === 1 ? "sesión" : "sesiones"} antes de
              terminar. Completar sesiones lo recupera poco a poco.
              {trust.low_priority && " Mientras esté bajo, la espera para encontrar compañero será más larga."}
            </p>
          ) : (
            <p style={s.muted}>
              Terminas las sesiones a las que te comprometes. Eso te da
              prioridad al buscar compañero.
            </p>
          )}
        </section>
      )}

      {/* Espacio para que la barra anclada no tape el ultimo contenido */}
      <div style={{ height: 84 }} />

      {/* Barra anclada abajo: el boton se ve siempre, sin bajar hasta el final */}
      <div style={s.barraAnclada}>
        <span style={s.estadoGuardado}>
          {problema
            ? <span style={{ color: "#fca5a5" }}>{problema}</span>
            : hayCambios
              ? "Tienes cambios sin guardar"
              : "Todo guardado"}
        </span>

        <div style={s.botonesAnclados}>
          <button
            style={s.btnGhost}
            onClick={() => { logout(); router.push("/login"); }}
          >
            Cerrar sesión
          </button>
          <button
            style={{
              ...s.btn,
              opacity: guardando || !!problema || !hayCambios ? 0.55 : 1,
              cursor:  guardando || !!problema || !hayCambios ? "not-allowed" : "pointer",
            }}
            disabled={guardando || !!problema || !hayCambios}
            onClick={guardar}
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: "100vh", background: "#1a1714", color: "#f5f0e8", padding: 24 },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 },
  back:   { background: "none", border: "none", color: "#c4b99a", cursor: "pointer", fontSize: 14 },
  title:  { fontSize: 26, margin: 0 },
  card:      { background: "#221e1a", borderRadius: 12, padding: 20, marginBottom: 16, maxWidth: 520 },
  cardTitle: { fontSize: 16, margin: "0 0 14px" },
  label:  { color: "#c4b99a", fontSize: 13, margin: "14px 0 8px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#f5f0e8", fontSize: 14, fontFamily: "inherit",
  },
  barraAnclada: {
    position:       "fixed",
    left:           0,
    right:          0,
    bottom:         0,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            12,
    flexWrap:       "wrap",
    padding:        "12px 24px",
    background:     "rgba(33,29,25,0.96)",
    borderTop:      "1px solid #3a3028",
    backdropFilter: "blur(6px)",
    zIndex:         40,
  },
  estadoGuardado:   { fontSize: 12, color: "#a0998b", flex: 1, minWidth: 160 },
  botonesAnclados:  { display: "flex", gap: 10, flexWrap: "wrap" },
  fotoFila:   { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 6 },
  fotoPrevia: {
    width:        84,
    height:       84,
    borderRadius: "50%",
    background:   "#2a2420",
    border:       "1px solid #3a3028",
    overflow:     "hidden",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:   0,
  },
  fotoImg:      { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  fotoAcciones: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1, minWidth: 180 },
  btnFoto: {
    background:   "#3b2f1e",
    color:        "#f5f0e8",
    border:       "1px solid #7c5c3a",
    borderRadius: 8,
    padding:      "8px 16px",
    cursor:       "pointer",
    fontSize:     13,
    fontWeight:   600,
  },
  btnQuitar: {
    background:   "transparent",
    color:        "#a0998b",
    border:       "1px solid #3a3028",
    borderRadius: 8,
    padding:      "8px 14px",
    cursor:       "pointer",
    fontSize:     13,
  },
  fotoNota: { fontSize: 11, color: "#6b6358", flexBasis: "100%", lineHeight: 1.4 },
  avatarGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  avatarBtn: {
    width: 42, height: 42, fontSize: 20, borderRadius: 10,
    border: "1px solid #3a332b", background: "#1a1714", cursor: "pointer",
  },
  avatarOn: { borderColor: "#7fa05a", background: "#2a3524" },
  chips: { display: "flex", gap: 8 },
  chip: {
    padding: "8px 16px", borderRadius: 18, fontSize: 13,
    border: "1px solid #3a332b", background: "#1a1714",
    color: "#c4b99a", cursor: "pointer",
  },
  chipOn: { borderColor: "#7fa05a", background: "#2a3524", color: "#f5f0e8" },
  trustRow:   { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 },
  trustScore: { fontSize: 32, fontWeight: 700 },
  barTrack: {
    width: "100%", height: 8, background: "#2f2a24",
    borderRadius: 4, overflow: "hidden", marginBottom: 12,
  },
  barFill: { height: "100%", borderRadius: 4 },
  aviso:  { color: "#c4a05a", fontSize: 12, lineHeight: 1.7, margin: 0 },
  muted:  { color: "#8b8378", fontSize: 12, lineHeight: 1.7 },
  actions: { display: "flex", gap: 10, maxWidth: 520 },
  btn: {
    flex: 1, padding: "12px", borderRadius: 8, border: "none",
    background: "#4a5d3a", color: "#f5f0e8", cursor: "pointer",
    fontSize: 14, fontWeight: 600,
  },
  btnGhost: {
    padding: "12px 18px", borderRadius: 8, border: "1px solid #3a332b",
    background: "none", color: "#8b8378", cursor: "pointer", fontSize: 14,
  },
  error: {
    background: "#3a2420", color: "#f0a090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 520,
  },
  ok: {
    background: "#243a24", color: "#a0d090", padding: 12,
    borderRadius: 8, marginBottom: 16, fontSize: 13, maxWidth: 520,
  },
};
