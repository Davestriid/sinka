/**
 * usePeerConnection — videollamada de la sesion de enfoque.
 *
 * Usa la API nativa del navegador, sin dependencias externas.
 *
 * Hay dos momentos distintos y conviene no mezclarlos:
 *
 *   1. La camara propia se enciende apenas entras a la sesion, aunque todavia
 *      estes solo. Asi siempre te ves a vos mismo y sabes que la camara anda.
 *   2. La conexion con la otra persona se arma recien cuando ella entra.
 *
 * Señalizacion, a traves del WebSocket de la sesion:
 *   quien inicia   envia WEBRTC_OFFER
 *   quien responde envia WEBRTC_ANSWER
 *   los dos        envian WEBRTC_ICE
 *
 * Las señales que llegan antes de que exista la conexion se guardan en cola en
 * vez de descartarse. Antes se perdian, y como nadie reintentaba, el video se
 * quedaba para siempre en "conectando".
 */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RTC_CONFIG } from "./webrtc-config";

// ── Tipos de señal ────────────────────────────────────────────────────────────

export interface WebRtcSignal {
  type:       "WEBRTC_OFFER" | "WEBRTC_ANSWER" | "WEBRTC_ICE";
  sdp?:       RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

/** Por que no hay camara disponible. */
export type EstadoCamara =
  | "pidiendo"      // esperando que la persona acepte el permiso
  | "lista"         // hay imagen
  | "denegada"      // la persona dijo que no, o el navegador lo bloqueo
  | "sin-camara"    // no se encontro ningun dispositivo
  | "ocupada"       // otra aplicacion la tiene tomada
  | "error";        // cualquier otra cosa

interface UsePeerConnectionOptions {
  /** true cuando la pareja ya esta conectada al WS de sesion */
  enabled:     boolean;
  /** true si este usuario es quien crea el offer */
  isInitiator: boolean;
  /** envia la señal a traves del WS de sesion */
  sendSignal:  (msg: WebRtcSignal) => void;
}

/** Traduce el error de getUserMedia a algo que se le pueda mostrar a la gente. */
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
  const localVideoRef  = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Señales que llegaron antes de tiempo
  const colaSeñalesRef  = useRef<WebRtcSignal[]>([]);
  const pendingIceRef   = useRef<RTCIceCandidateInit[]>([]);

  const [localStream,     setLocalStream]     = useState<MediaStream | null>(null);
  const [screenStream,    setScreenStream]    = useState<MediaStream | null>(null);
  const [remoteStream,    setRemoteStream]    = useState<MediaStream | null>(null);
  const [estadoCamara,    setEstadoCamara]    = useState<EstadoCamara>("pidiendo");
  const [micEnabled,      setMicEnabled]      = useState(true);
  const [camEnabled,      setCamEnabled]      = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connected,       setConnected]       = useState(false);
  const [iceState,        setIceState]        = useState<RTCIceConnectionState | "">("");

  const cameraAllowed = estadoCamara === "lista";

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

      // Si ya habia una conexion armada, engancharle las pistas nuevas
      const pc = pcRef.current;
      if (pc) {
        for (const track of stream.getTracks()) {
          const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
          if (sender) await sender.replaceTrack(track).catch(() => {});
          else pc.addTrack(track, stream);
        }
      }
      return stream;
    } catch (err) {
      setEstadoCamara(clasificarError(err));
      return null;
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    encenderCamara().then(stream => {
      if (!vivo && stream) stream.getTracks().forEach(t => t.stop());
    });
    return () => {
      vivo = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
  }, [encenderCamara]);

  // Enganchar el stream al elemento <video> cada vez que alguno de los dos
  // cambie. Hacerlo solo al obtener la camara fallaba cuando el elemento
  // todavia no estaba montado.
  const streamPropio = screenStream ?? localStream;

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && el.srcObject !== streamPropio) el.srcObject = streamPropio;
  }, [streamPropio]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream;
  }, [remoteStream]);

  // ── 2. Conexion con la pareja ─────────────────────────────────────────────

  const procesarSeñal = useCallback(async (msg: WebRtcSignal) => {
    const pc = pcRef.current;
    if (!pc) { colaSeñalesRef.current.push(msg); return; }

    try {
      if (msg.type === "WEBRTC_OFFER" && msg.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "WEBRTC_ANSWER", sdp: pc.localDescription ?? answer });

      } else if (msg.type === "WEBRTC_ANSWER" && msg.sdp) {
        // Un answer que llega cuando ya estamos estables es un duplicado
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
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
  }, [sendSignal]);

  /** Lo llama el componente cuando entra una señal por el WebSocket. */
  const handleSignal = useCallback((msg: WebRtcSignal) => {
    void procesarSeñal(msg);
  }, [procesarSeñal]);

  useEffect(() => {
    if (!enabled) return;

    let cancelado = false;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Pistas locales, si la camara ya esta lista. Si todavia no, se enganchan
    // despues desde encenderCamara.
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach(t => pc.addTrack(t, local));

    pc.ontrack = (event) => {
      if (cancelado) return;
      setRemoteStream(event.streams[0] ?? null);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: "WEBRTC_ICE", candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (cancelado) return;
      setConnected(pc.connectionState === "connected");
    };

    pc.oniceconnectionstatechange = () => {
      if (cancelado) return;
      setIceState(pc.iceConnectionState);
    };

    // Vaciar lo que haya llegado antes de que existiera la conexion
    const atrasadas = colaSeñalesRef.current;
    colaSeñalesRef.current = [];
    (async () => {
      for (const m of atrasadas) await procesarSeñal(m);
    })();

    let reintento: ReturnType<typeof setInterval> | null = null;

    if (isInitiator) {
      const ofrecer = async () => {
        if (cancelado || pc.signalingState === "closed") return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "WEBRTC_OFFER", sdp: pc.localDescription ?? offer });
        } catch (err) {
          console.warn("[WebRTC] no se pudo crear el offer:", err);
        }
      };
      void ofrecer();

      // Si la otra persona todavia estaba cargando su camara cuando mandamos el
      // primer offer, no lo pudo contestar. Se reintenta unas pocas veces.
      let intentos = 0;
      reintento = setInterval(() => {
        intentos += 1;
        const listo = pc.connectionState === "connected" ||
                      pc.signalingState  === "stable";
        if (listo || intentos > 4) {
          if (reintento) clearInterval(reintento);
          return;
        }
        void ofrecer();
      }, 4000);
    }

    return () => {
      cancelado = true;
      if (reintento) clearInterval(reintento);
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      pcRef.current = null;
      pendingIceRef.current = [];
      setRemoteStream(null);
      setConnected(false);
      setIceState("");
    };
  // sendSignal y procesarSeñal se estabilizan en el componente padre
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isInitiator]);

  // ── 3. Controles ──────────────────────────────────────────────────────────

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
    const pc    = pcRef.current;
    const local = localStreamRef.current;

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    const cameraTrack = local?.getVideoTracks()[0];
    if (pc && cameraTrack) {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(cameraTrack).catch(() => {});
    }
    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      screenStreamRef.current = screenStream;
      setScreenStream(screenStream);
      const videoTrack = screenStream.getVideoTracks()[0];

      const pc = pcRef.current;
      if (pc) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(videoTrack).catch(() => {});
        else pc.addTrack(videoTrack, screenStream);
      }

      setIsScreenSharing(true);
      videoTrack.onended = () => { void stopScreenShare(); };
    } catch {
      // La persona cancelo el dialogo. No es un error.
    }
  }, [stopScreenShare]);

  return {
    localVideoRef,
    remoteVideoRef,
    localStream:  streamPropio,
    remoteStream,
    estadoCamara,
    cameraAllowed,
    micEnabled,
    camEnabled,
    isScreenSharing,
    connected,
    iceState,
    handleSignal,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    reintentarCamara: encenderCamara,
  };
}
