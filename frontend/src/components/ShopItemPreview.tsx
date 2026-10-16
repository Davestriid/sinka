"use client";

/**
 * Vista previa grande de un artículo de la tienda, antes de comprarlo.
 *
 * Las tarjetas del catálogo ya traen una muestra chiquita (34-40px), mal que
 * bien para reconocer el artículo en una grilla, pero no alcanza para saber
 * "cómo se vería en mi perfil de verdad". Este modal amplía esa muestra
 * según la categoría: el marco sobre un avatar de tamaño real, el fondo a
 * pantalla completa (dentro del modal), el banner a todo el ancho, las 5
 * fases de una skin de planta en fila, o un botón para escuchar un adelanto
 * de la pista si es música.
 *
 * No depende de haber comprado el artículo — es justamente para decidir si
 * vale la pena comprarlo.
 */
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, X, Coins } from "lucide-react";
import { color, radius, shadow, fontSerif } from "@/lib/theme";
import type { ShopItem } from "@/lib/api";
import { AvatarFrame, type FrameId } from "@/components/AvatarFrame";
import { PageBackground, type BgId } from "@/components/PageBackground";
import { BannerTexture } from "@/components/BannerTexture";
import { emojiConSkin, nombreDeSkin } from "@/lib/plantSkins";
import { MUSICA_TIENDA_SRC } from "@/lib/musicTracks";

// Mismo orden de fases que growth_service.PHASES en el backend.
const FASES: { id: string; etiqueta: string; emoji: string }[] = [
  { id: "semilla",     etiqueta: "Semilla",     emoji: "🌰" },
  { id: "brote",       etiqueta: "Brote",       emoji: "🌱" },
  { id: "planta",      etiqueta: "Planta",      emoji: "🌿" },
  { id: "floreciendo", etiqueta: "Floreciendo", emoji: "🌸" },
  { id: "arbol",       etiqueta: "Árbol",       emoji: "🌳" },
];

interface Props {
  item: ShopItem;
  avatarUrl?: string | null;
  avatarIniciales?: string;
  onClose: () => void;
  /** Opcional: si se pasa, el modal también ofrece comprar desde aquí. */
  onBuy?: () => void;
  comprando?: boolean;
  puedeComprar?: boolean;
}

export function ShopItemPreview({
  item, avatarUrl, avatarIniciales, onClose, onBuy, comprando, puedeComprar = true,
}: Props) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <button style={s.cerrar} onClick={onClose} aria-label="Cerrar">
          <X size={18} strokeWidth={2} />
        </button>

        <h2 style={s.nombre}>{item.name}</h2>
        <p style={s.desc}>{item.description}</p>

        <div style={s.previewArea}>
          <ContenidoPreview item={item} avatarUrl={avatarUrl} avatarIniciales={avatarIniciales} />
        </div>

        <div style={s.footer}>
          {item.owned ? (
            <span style={s.ownedNote}>Ya está en tu inventario.</span>
          ) : onBuy ? (
            <button
              style={{ ...s.buyBtn, opacity: puedeComprar ? 1 : 0.5, cursor: puedeComprar ? "pointer" : "not-allowed" }}
              onClick={onBuy}
              disabled={!puedeComprar || comprando}
            >
              {comprando ? "…" : <><Coins size={14} strokeWidth={2} /> Comprar por {item.price_fc} FC</>}
            </button>
          ) : (
            <span style={s.ownedNote}>{item.price_fc} FC</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ContenidoPreview({
  item, avatarUrl, avatarIniciales,
}: { item: ShopItem; avatarUrl?: string | null; avatarIniciales?: string }) {
  switch (item.category) {
    case "avatar_frame":
      return <PreviewMarco item={item} avatarUrl={avatarUrl} avatarIniciales={avatarIniciales} />;
    case "background":
      return <PreviewFondo item={item} />;
    case "profile_banner":
      return <PreviewBanner item={item} />;
    case "plant_skin":
      return <PreviewSkin item={item} />;
    case "music":
      return <PreviewMusica item={item} />;
    default:
      return <div style={s.previewGenerico}>{item.preview}</div>;
  }
}

function PreviewMarco({ item, avatarUrl, avatarIniciales }: { item: ShopItem; avatarUrl?: string | null; avatarIniciales?: string }) {
  const tam = 96;
  return (
    <div style={s.marcoWrap}>
      <span style={{ position: "relative", display: "inline-flex", width: tam, height: tam }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" style={{ width: tam, height: tam, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <span style={{
            width: tam, height: tam, borderRadius: "50%", background: color.surfaceRaised,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 700, color: color.textMuted,
          }}>
            {avatarIniciales ?? "👤"}
          </span>
        )}
        <AvatarFrame frameId={item.id as FrameId} size={tam} />
      </span>
      <span style={s.previewNota}>Así se vería en tu avatar</span>
    </div>
  );
}

function PreviewFondo({ item }: { item: ShopItem }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ ...s.fondoBox, background: item.preview }}>
        <PageBackground bgId={item.id as BgId} contenido />
      </div>
      <span style={s.previewNota}>Así se vería de fondo en tus pantallas</span>
    </div>
  );
}

function PreviewBanner({ item }: { item: ShopItem }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ ...s.bannerBox, background: item.preview }}>
        <BannerTexture />
      </div>
      <span style={s.previewNota}>Así se vería en tu perfil</span>
    </div>
  );
}

function PreviewSkin({ item }: { item: ShopItem }) {
  const nombre = nombreDeSkin(item.id);
  return (
    <div style={{ width: "100%" }}>
      <div style={s.skinFila}>
        {FASES.map((f) => (
          <div key={f.id} style={s.skinFase}>
            <span style={{ fontSize: 26 }}>{emojiConSkin(f.id, f.emoji, item.id)}</span>
            <span style={s.skinEtiqueta}>{f.etiqueta}</span>
          </div>
        ))}
      </div>
      <span style={s.previewNota}>
        {nombre ? `Así crece tu planta con la skin "${nombre}"` : "Así se vería tu planta en cada fase"}
      </span>
    </div>
  );
}

function PreviewMusica({ item }: { item: ShopItem }) {
  const src = MUSICA_TIENDA_SRC[item.id];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  if (!src) {
    return (
      <div style={s.musicaBox}>
        <Volume2 size={28} strokeWidth={1.5} color={color.textFaint} />
        <span style={s.previewNota}>Podrás escucharla una vez que la compres, desde el Pomodoro en solitario.</span>
      </div>
    );
  }

  const alternar = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (sonando) { audio.pause(); setSonando(false); }
    else { audio.play().catch(() => {}); setSonando(true); }
  };

  return (
    <div style={s.musicaBox}>
      <audio
        ref={audioRef}
        src={src}
        loop
        preload="none"
        onEnded={() => setSonando(false)}
      />
      <button style={s.playBtn} onClick={alternar} aria-label={sonando ? "Pausar" : "Escuchar muestra"}>
        {sonando ? <Pause size={22} strokeWidth={2} /> : <Play size={22} strokeWidth={2} />}
      </button>
      <span style={s.previewNota}>{sonando ? "Sonando…" : "Escucha un adelanto"}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2100, padding: 20,
  },
  modal: {
    position: "relative",
    background: color.surface, borderRadius: radius.lg, padding: 24,
    maxWidth: 420, width: "100%", boxShadow: shadow.raised,
    border: `1px solid ${color.border}`,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  cerrar: {
    position: "absolute", top: 12, right: 12,
    background: "none", border: "none", color: color.textFaint, cursor: "pointer",
    padding: 4, display: "flex",
  },
  nombre: { fontFamily: fontSerif, fontSize: 20, margin: "4px 0 0", textAlign: "center" as const },
  desc:   { fontSize: 13, color: color.textMuted, textAlign: "center" as const, margin: 0, lineHeight: 1.5 },
  previewArea: {
    width: "100%", display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, padding: "8px 0",
  },
  previewGenerico: { fontSize: 48, lineHeight: 1 },
  previewNota: { fontSize: 11.5, color: color.textFaint, textAlign: "center" as const },
  marcoWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  fondoBox: {
    width: "100%", height: 200, borderRadius: radius.md, overflow: "hidden",
    position: "relative", border: `1px solid ${color.border}`,
  },
  bannerBox: {
    width: "100%", height: 76, borderRadius: radius.md, overflow: "hidden",
    position: "relative", border: `1px solid ${color.border}`,
  },
  skinFila: {
    display: "flex", justifyContent: "space-between", width: "100%",
    background: color.bg, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "14px 8px",
  },
  skinFase: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 },
  skinEtiqueta: { fontSize: 9.5, color: color.textFaint },
  musicaBox: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
    background: color.bg, border: `1px solid ${color.border}`, borderRadius: radius.md,
    padding: "22px 16px", width: "100%",
  },
  playBtn: {
    width: 52, height: 52, borderRadius: "50%", border: "none",
    background: color.accentDeep, color: color.text, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  footer: { width: "100%", marginTop: 4 },
  ownedNote: { display: "block", textAlign: "center" as const, fontSize: 13, color: color.textMuted },
  buyBtn: {
    width: "100%", background: color.accentDeep, border: "none", borderRadius: radius.sm,
    color: color.text, fontWeight: 700, fontSize: 14, padding: "10px 16px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
};
