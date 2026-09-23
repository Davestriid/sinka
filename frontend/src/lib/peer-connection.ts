/**
 * usePeerConnection — videollamada de la sesion de enfoque.
 *
 * Usa la API nativa del navegador, sin dependencias externas.
 *
 * La conexion se arma con tres canales fijos, creados siempre en el mismo
 * orden por las dos partes:
 *
 *   mid 0  audio del microfono
 *   mid 1  video de la camara
 *   mid 2  video de la pantalla compartida
 *
 * Fijar los canales de entrada resuelve dos problemas que teniamos. Uno, que
 * la camara podia tardar en abrirse y las pistas llegaban despues de haber
 * negociado, asi que nunca viajaban. Dos, que compartir pantalla reemplazaba
 * la pista de la camara y te dejaba sin imagen propia. Ahora la pantalla tiene
 * su propio canal y la camara sigue encendida al mismo tiempo.
 *
 * Las señales que llegan antes de que exista la conexion se guardan en cola en
 * vez de descartarse.
 */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RTC_CONFIG } from "./webrtc-config";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface WebRtcSignal {
  type:       "WEBRTC_OFFER" | "WEBRTC_ANSWER" | "WEBRTC_ICE";
  sdp?:       RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type EstadoCamara =
  | "pidiendo"
  | "lista"
  | "denegada"
  | "sin-camara"
  | "ocupada"
  | "error";

interface UsePeerConnectionOptions {
  enabled:     boolean;
  isInitiator: boolean;
  sendSignal:  (msg: WebRtcSignal) => void;
}

const MID_AUDIO    = 0;
const MID_CAMARA   = 1;
const MID_PANTALLA = 2;

function clasificarError(err: unknown): EstadoCamara {
  const nombre = (err as DOMException | undefined)?.name ?? "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "denegada";
  if (nombre === "NotFoundError"   || nombre === "OverconstrainedError") return "sin-camara";
  if (nombre === "NotReadableError" || nombre === "AbortError") return "ocupada";
  return "error";
}

export function usePeerConnection({
  enabled,
  isInitiator,
  sendSignal,
}: UsePeerConnectionOptions) {
  const localVideoRef        = useRef<HTMLVideoElement | null>(null);
  const localScreenRef       = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef       = useRef<HTMLVideoElement | null>(null);
  const remoteScreenRef      = useRef<HTMLVideoElement | null>(null);

  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const screenStreamRef  = useRef<MediaStream | null>(null);
  const colaSeñalesRef   = useRef<WebRtcSignal[]>([]);
  const pendingIceRef    = useRef<RTCIceCandidateInit[]>([]);
  const negociandoRef    = useRef(false);

  const [localStream,     setLocalStream]     = useState<MediaStream | null>(null);
  const [screenStream,    setScreenStream]    = useState<MediaStream | null>(null);
  const [remoteStream,    setRemoteStream]    = useState<MediaStream | null>(null);
  const [remoteScreen,    setRemoteScreen]    = useState<MediaStream | null>(null);
  const [partnerSharing,  setPartnerSharing]  = useState(false);
  const [estadoCamara,    setEstadoCamara]    = useState<EstadoCamara>("pidiendo");
  const [micEnabled,      setMicEnabled]      = useState(true);
  const [camEnabled,      setCamEnabled]      = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connected,       setConnected]       = useState(false);
  const [iceState,        setIceState]        = useState<RTCIceConnectionState | "">("");
  const [remoteFrozen,    setRemoteFrozen]    = useState(false);

  const cameraAllowed = estadoCamara === "lista";

  // ── Utilidades sobre los canales fijos ────────────────────────────────────

  /** Devuelve el transceiver que corresponde a un canal, o null. */
  const canal = useCallback((mid: number): RTCRtpTransceiver | null => {
    const pc = pcRef.current;
    if (!pc) return null;
    const lista = pc.getTransceivers();
    // Mientras no se haya negociado, mid es null y vale el orden de creacion
    const porMid = lista.find(t => t.mid === String(mid));
    return porMid ?? lista[mid] ?? null;
  }, []);

  /** Pone las pistas actuales en sus canales. Se puede llamar cuantas veces sea. */
  const sincronizarPistas = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;

    const cam    = localStreamRef.current;
    const screen = screenStreamRef.current;

    const pares: [number, MediaStreamTrack | null][] = [
      [MID_AUDIO,    cam?.getAudioTracks()[0]    ?? null],
      [MID_CAMARA,   cam?.getVideoTracks()[0]    ?? null],
      [MID_PANTALLA, screen?.getVideoTracks()[0] ?? null],
    ];

    for (const [mid, track] of pares) {
      const t = canal(mid);
      if (!t) continue;
      if (t.sender.track === track) continue;
      await t.sender.replaceTrack(track).catch(() => {});
    }
  }, [canal]);

  // ── 1. Camara propia, apenas entra a la sesion ────────────────────────────

  const encenderCamara = useCallback(async () => {
    setEstadoCamara("pidiendo");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setEstadoCamara("lista");
      setCamEnabled(true);
      setMicEnabled(true);
      await sincronizarPistas();
      return stream;
    } catch (err) {
      setEstadoCamara(clasificarError(err));
      return null;
    }
  }, [sincronizarPistas]);

  useEffect(() => {
    let vivo = true;
    void encenderCamara().then(stream => {
      if (!vivo && stream) stream.getTracks().forEach(t => t.stop());
    });
    return () => {
      vivo = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
    // encenderCamara es estable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enganchar cada stream a su elemento <video> cuando cualquiera de los dos
  // cambie. Hacerlo una sola vez fallaba si el elemento aun no estaba montado.
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && el.srcObject !== localStream) el.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    const el = localScreenRef.current;
    if (el && el.srcObject !== screenStream) el.srcObject = screenStream;
  }, [screenStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream;
  }, [remoteStream]);

  // Vigía de imagen congelada. Cuando la otra persona bloquea su celular, el
  // navegador suele dejar de mandar cuadros nuevos sin avisar por ningún
  // evento de WebRTC: la pista sigue "viva" y sin silenciar, así que la
  // pantalla se queda pegada en el último cuadro en vez de mostrar el aviso
  // de "conectando". Este vigía mide si de verdad siguen llegando cuadros y,
  // si no, lo marca aparte para que la interfaz pueda avisarlo. En cuanto la
  // otra persona desbloquea el celular, los cuadros vuelven a fluir solos y
  // esto se limpia sin que nadie tenga que hacer nada.
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteStream || remoteStream.getVideoTracks().length === 0) {
      setRemoteFrozen(false);
      return;
    }

    let cancelado  = false;
    let ultimoCuadro = performance.now();
    let rvfcId: number | null = null;

    type ElementoConRVFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?:  (id: number) => void;
    };
    const elRvfc = el as ElementoConRVFC;
    const soportaRVFC = typeof elRvfc.requestVideoFrameCallback === "function";

    const marcarCuadro = () => {
      ultimoCuadro = performance.now();
      if (!cancelado) setRemoteFrozen(false);
      if (!cancelado && soportaRVFC) {
        rvfcId = elRvfc.requestVideoFrameCallback!(marcarCuadro);
      }
    };

    if (soportaRVFC) {
      rvfcId = elRvfc.requestVideoFrameCallback!(marcarCuadro);
    }

    // Revisa cada 2s. Si no hay evidencia de cuadro nuevo en 6s, se marca
    // congelado. En navegadores sin requestVideoFrameCallback (Safari viejo)
    // esto nunca se limpia solo, pero es un caso raro y prefiere avisar de
    // mas a quedarse callado.
    const vigilante = setInterval(() => {
      if (cancelado) return;
      setRemoteFrozen(performance.now() - ultimoCuadro > 6000);
    }, 2000);

    return () => {
      cancelado = true;
      clearInterval(vigilante);
      if (soportaRVFC && rvfcId != null) elRvfc.cancelVideoFrameCallback?.(rvfcId);
    };
  }, [remoteStream]);

  useEffect(() => {
    const el = remoteScreenRef.current;
    if (el && el.srcObject !== remoteScreen) el.srcObject = remoteScreen;
  }, [remoteScreen]);

  // ── 2. Señalizacion ───────────────────────────────────────────────────────

  const procesarSeñal = useCallback(async (msg: WebRtcSignal) => {
    const pc = pcRef.current;
    if (!pc) { colaSeñalesRef.current.push(msg); return; }

    try {
      if (msg.type === "WEBRTC_OFFER" && msg.sdp) {
        // Si llega un offer mientras nosotros tambien ofreciamos, cede quien
        // no es el iniciador. Evita que las dos partes se pisen.
        const choque = pc.signalingState !== "stable";
        if (choque) {
          if (isInitiator) return;
          await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit)
                  .catch(() => {});
        }

        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

        // Quien responde debe poder enviar tambien, no solo recibir
        for (const t of pc.getTransceivers()) {
          if (t.direction === "recvonly") t.direction = "sendrecv";
        }
        await sincronizarPistas();

        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "WEBRTC_ANSWER", sdp: pc.localDescription ?? answer });

      } else if (msg.type === "WEBRTC_ANSWER" && msg.sdp) {
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        await sincronizarPistas();
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];

      } else if (msg.type === "WEBRTC_ICE" && msg.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          pendingIceRef.current.push(msg.candidate);
        }
      }
    } catch (err) {
      console.warn("[WebRTC] fallo procesando", msg.type, err);
    }
  }, [sendSignal, sincronizarPistas, isInitiator]);

  const handleSignal = useCallback((msg: WebRtcSignal) => {
    void procesarSeñal(msg);
  }, [procesarSeñal]);

  // ── 3. Conexion con la pareja ─────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    let cancelado = false;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Los tres canales, siempre en el mismo orden. Quien responde los recibe
    // del offer, asi que solo los crea el iniciador.
    if (isInitiator) {
      pc.addTransceiver("audio", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
      pc.addTransceiver("video", { direction: "sendrecv" });
    }

    // Las pistas remotas se acumulan aqui. Cada vez que cambian se crea un
    // MediaStream nuevo: si se reutilizara el mismo objeto, React lo veria
    // igual, no volveria a renderizar y el elemento <video> se quedaria con el
    // stream viejo. Ese era el motivo de que no se viera a la otra persona.
    const pistasCamara   = new Map<string, MediaStreamTrack>();
    const pistasPantalla = new Map<string, MediaStreamTrack>();

    const publicarCamara = () => {
      if (cancelado) return;
      setRemoteStream(new MediaStream(Array.from(pistasCamara.values())));
    };
    const publicarPantalla = () => {
      if (cancelado) return;
      const pistas = Array.from(pistasPantalla.values());
      setRemoteScreen(pistas.length ? new MediaStream(pistas) : null);
    };

    pc.ontrack = (event) => {
      if (cancelado) return;
      const track = event.track;
      const mid   = event.transceiver.mid;

      const esPantalla = mid === String(MID_PANTALLA);
      const destino    = esPantalla ? pistasPantalla : pistasCamara;
      destino.set(track.kind, track);

      // Una pista recien negociada llega en silencio y se "despierta" cuando
      // empieza a fluir el video. Hay que volver a publicar en ese momento.
      const refrescar = esPantalla ? publicarPantalla : publicarCamara;

      track.onunmute = () => {
        if (cancelado) return;
        refrescar();
        if (esPantalla) setPartnerSharing(true);
      };
      track.onmute = () => {
        if (cancelado) return;
        if (esPantalla) setPartnerSharing(false);
      };
      track.onended = () => {
        if (cancelado) return;
        destino.delete(track.kind);
        refrescar();
        if (esPantalla) setPartnerSharing(false);
      };

      refrescar();
      if (esPantalla) setPartnerSharing(!track.muted);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "WEBRTC_ICE", candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (!cancelado) setConnected(pc.connectionState === "connected");
    };

    pc.oniceconnectionstatechange = () => {
      if (!cancelado) setIceState(pc.iceConnectionState);
    };

    const ofrecer = async () => {
      if (cancelado || pc.signalingState === "closed") return;
      if (negociandoRef.current) return;
      negociandoRef.current = true;
      try {
        await sincronizarPistas();
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        sendSignal({ type: "WEBRTC_OFFER", sdp: pc.localDescription ?? offer });
      } catch (err) {
        console.warn("[WebRTC] no se pudo crear el offer:", err);
      } finally {
        negociandoRef.current = false;
      }
    };

    // Vaciar lo que llego antes de que existiera la conexion
    const atrasadas = colaSeñalesRef.current;
    colaSeñalesRef.current = [];
    void (async () => {
      for (const m of atrasadas) await procesarSeñal(m);
      if (isInitiator && pc.signalingState === "stable" && !pc.remoteDescription) {
        await ofrecer();
      }
    })();

    let reintento: ReturnType<typeof setInterval> | null = null;

    if (isInitiator) {
      void ofrecer();

      // Si la otra parte todavia estaba cargando cuando mandamos el primer
      // offer, no lo pudo contestar. Se reintenta unas pocas veces.
      let intentos = 0;
      reintento = setInterval(() => {
        intentos += 1;
        if (cancelado || pc.connectionState === "connected" || intentos > 5) {
          if (reintento) clearInterval(reintento);
          return;
        }
        if (pc.signalingState === "stable" && !pc.remoteDescription) void ofrecer();
      }, 4000);
    }

    return () => {
      cancelado = true;
      if (reintento) clearInterval(reintento);
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      pcRef.current = null;
      pendingIceRef.current = [];
      negociandoRef.current = false;
      setRemoteStream(null);
      setRemoteScreen(null);
      setPartnerSharing(false);
      setConnected(false);
      setIceState("");
    };
  // sendSignal se estabiliza en el componente padre
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isInitiator]);

  // ── 4. Controles ──────────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nuevo = !stream.getAudioTracks().every(t => t.enabled);
    stream.getAudioTracks().forEach(t => { t.enabled = nuevo; });
    setMicEnabled(nuevo);
  }, []);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nuevo = !stream.getVideoTracks().every(t => t.enabled);
    stream.getVideoTracks().forEach(t => { t.enabled = nuevo; });
    setCamEnabled(nuevo);
  }, []);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    // La camara nunca se toco, solo se libera el canal de la pantalla
    await sincronizarPistas();
  }, [sincronizarPistas]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      await sincronizarPistas();

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) videoTrack.onended = () => { void stopScreenShare(); };
    } catch {
      // La persona cancelo el dialogo. No es un error.
    }
  }, [sincronizarPistas, stopScreenShare]);

  return {
    localVideoRef,
    localScreenRef,
    remoteVideoRef,
    remoteScreenRef,
    localStream,
    screenStream,
    remoteStream,
    remoteScreen,
    partnerSharing,
    estadoCamara,
    cameraAllowed,
    micEnabled,
    camEnabled,
    isScreenSharing,
    connected,
    iceState,
    remoteFrozen,
    handleSignal,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    reintentarCamara: encenderCamara,
  };
}
