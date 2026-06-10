/**
 * usePeerConnection — hook de WebRTC para SINKA.
 *
 * Usa la API nativa del navegador (RTCPeerConnection) sin dependencias externas.
 *
 * Flujo de señalización (a través del WS de sesión existente):
 *   Iniciador (user_a):
 *     1. Obtiene cámara/micrófono → agrega tracks → crea offer → envía WEBRTC_OFFER
 *   Receptor (user_b):
 *     2. Recibe WEBRTC_OFFER → setRemoteDescription → crea answer → envía WEBRTC_ANSWER
 *   Ambos:
 *     3. Generan ICE candidates → envían WEBRTC_ICE
 *
 * UX por fase:
 *   focus  — thumbnail pequeño local + thumbnail remoto SIN audio
 *   break  — vídeo más grande + audio habilitado + controles mic/pantalla
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

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UsePeerConnectionOptions {
  /** true cuando la pareja ya está conectada al WS de sesión */
  enabled:     boolean;
  /** true si este usuario es user_a (quien crea el offer) */
  isInitiator: boolean;
  /** función que envía la señal WebRTC a través del WS de sesión */
  sendSignal:  (msg: WebRtcSignal) => void;
}

export function usePeerConnection({
  enabled,
  isInitiator,
  sendSignal,
}: UsePeerConnectionOptions) {
  // Refs de los elementos <video>
  const localVideoRef  = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Refs internos de streams y PC
  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const screenStreamRef  = useRef<MediaStream | null>(null);
  // ICE candidates que llegan antes del remoteDescription
  const pendingIceRef    = useRef<RTCIceCandidateInit[]>([]);

  // Estado exportado al componente
  const [remoteStream,   setRemoteStream]   = useState<MediaStream | null>(null);
  const [micEnabled,     setMicEnabled]     = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [cameraAllowed,  setCameraAllowed]  = useState(true);
  const [connected,      setConnected]      = useState(false);

  // ── Inicialización: adquirir cámara + micrófono y crear RTCPeerConnection ──
  useEffect(() => {
    if (!enabled) return;

    let pc: RTCPeerConnection;
    let cancelled = false;

    async function init() {
      // 1. Obtener stream local
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!cancelled) setCameraAllowed(true);
      } catch {
        // Permiso denegado o dispositivo no disponible — degradar gracefully
        if (!cancelled) setCameraAllowed(false);
        stream = new MediaStream(); // stream vacío para que el PC no falle
      }

      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      localStreamRef.current = stream;

      // Mostrar vídeo local
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Crear RTCPeerConnection
      pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // 3. Agregar tracks locales
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 4. Recibir tracks remotos
      pc.ontrack = (event) => {
        const remote = event.streams[0];
        setRemoteStream(remote);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remote;
        }
      };

      // 5. Enviar ICE candidates al partner
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: "WEBRTC_ICE", candidate: event.candidate.toJSON() });
        }
      };

      // 6. Monitorear estado de conexión
      pc.onconnectionstatechange = () => {
        setConnected(pc.connectionState === "connected");
      };

      // 7. Si es iniciador, crear offer
      if (isInitiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal({ type: "WEBRTC_OFFER", sdp: pc.localDescription ?? offer });
        } catch (err) {
          console.warn("[WebRTC] Error al crear offer:", err);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      pc?.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current = null;
      setRemoteStream(null);
      setConnected(false);
    };
  // sendSignal se estabiliza con useCallback en el componente padre
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isInitiator]);

  // ── Procesar señales entrantes (llamado desde onmessage del WS) ───────────

  const handleSignal = useCallback(async (msg: WebRtcSignal) => {
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (msg.type === "WEBRTC_OFFER" && msg.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        // Vaciar candidates pendientes
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "WEBRTC_ANSWER", sdp: pc.localDescription ?? answer });

      } else if (msg.type === "WEBRTC_ANSWER" && msg.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];

      } else if (msg.type === "WEBRTC_ICE" && msg.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          // Guardar para procesar después de setRemoteDescription
          pendingIceRef.current.push(msg.candidate);
        }
      }
    } catch (err) {
      console.warn("[WebRTC] Error procesando señal:", msg.type, err);
    }
  }, [sendSignal]);

  // ── Controles de medios ───────────────────────────────────────────────────

  /** Activa/desactiva el micrófono local */
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMicEnabled(prev => !prev);
  }, []);

  /** Inicia compartir pantalla y reemplaza la pista de vídeo en el PC */
  const startScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const videoTrack = screenStream.getVideoTracks()[0];

      // Reemplazar la pista de vídeo en el sender
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(videoTrack);

      // Mostrar pantalla en vídeo local
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setIsScreenSharing(true);

      // Al parar la compartición desde el navegador → restaurar cámara
      videoTrack.onended = () => { stopScreenShare(); };
    } catch {
      // Usuario canceló el diálogo — no error fatal
    }
  }, []);

  /** Restaura la cámara después de compartir pantalla */
  const stopScreenShare = useCallback(async () => {
    const pc     = pcRef.current;
    const local  = localStreamRef.current;
    if (!pc || !local) return;

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    const cameraTrack = local.getVideoTracks()[0];
    if (cameraTrack) {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(cameraTrack).catch(() => {});
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = local;
    }
    setIsScreenSharing(false);
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    remoteStream,
    micEnabled,
    isScreenSharing,
    cameraAllowed,
    connected,
    handleSignal,
    toggleMic,
    startScreenShare,
    stopScreenShare,
  };
}
