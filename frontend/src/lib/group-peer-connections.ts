/**
 * useGroupPeerConnections — videollamada de la sesion de grupo (2 a 8
 * personas).
 *
 * A diferencia de usePeerConnection (session/[sessionId], pensado para
 * exactamente dos personas con canales de audio/video/pantalla fijos), aca
 * cada participante arma una conexion WebRTC directa con cada uno de los
 * demas — una malla, no una estrella con servidor de medios. Con el tope de
 * 8 integrantes por grupo, eso son como mucho 7 conexiones por persona, algo
 * razonable sin montar infraestructura de SFU.
 *
 * Por simplicidad (y porque es una primera version), esta malla no tiene
 * canal fijo de pantalla compartida como la de parejas: cada conexion lleva
 * un track de audio y uno de video, renegociados con el patron estandar
 * onnegotiationneeded. Compartir pantalla queda fuera de esta primera
 * version del modo grupo.
 */
"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RTC_CONFIG } from "./webrtc-config";

export interface GroupSignal {
  type:  "offer" | "answer" | "ice";
  sdp?:  RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type EstadoCamara =
  | "pidiendo" | "lista" | "denegada" | "sin-camara" | "ocupada" | "error";

interface PeerRemoto {
  userId: string;
  stream: MediaStream | null;
  connected: boolean;
}

interface UseGroupPeerConnectionsOptions {
  /** Mi propio id — para decidir quien ofrece primero en cada par (desempate). */
  myUserId: string;
  /** Manda una señal a un participante puntual via el canal de la sesion. */
  sendSignal: (targetUserId: string, data: GroupSignal) => void;
}

function clasificarError(err: unknown): EstadoCamara {
  const nombre = (err as DOMException | undefined)?.name ?? "";
  if (nombre === "NotAllowedError" || nombre === "SecurityError") return "denegada";
  if (nombre === "NotFoundError"   || nombre === "OverconstrainedError") return "sin-camara";
  if (nombre === "NotReadableError" || nombre === "AbortError") return "ocupada";
  return "error";
}

interface _Conexion {
  pc: RTCPeerConnection;
  pendingIce: RTCIceCandidateInit[];
  negociando: boolean;
}

export function useGroupPeerConnections({ myUserId, sendSignal }: UseGroupPeerConnectionsOptions) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const conexionesRef  = useRef<Map<string, _Conexion>>(new Map());
  const colaSeñalesRef = useRef<Map<string, GroupSignal[]>>(new Map());

  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [estadoCamara, setEstadoCamara] = useState<EstadoCamara>("pidiendo");
  const [micEnabled,   setMicEnabled]   = useState(true);
  const [camEnabled,   setCamEnabled]   = useState(true);
  const [remotos, setRemotos] = useState<Record<string, PeerRemoto>>({});

  const cameraAllowed = estadoCamara === "lista";

  // ── Camara propia ───────────────────────────────────────────────────────

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
      // Si ya hay conexiones armadas (alguien se sumo antes de que la camara
      // terminara de pedirse), publicarles las pistas recien conseguidas.
      for (const [, conn] of conexionesRef.current) {
        for (const track of stream.getTracks()) {
          const yaTiene = conn.pc.getSenders().some(s => s.track?.kind === track.kind);
          if (!yaTiene) conn.pc.addTrack(track, stream);
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
    void encenderCamara().then(stream => {
      if (!vivo && stream) stream.getTracks().forEach(t => t.stop());
    });
    return () => {
      vivo = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && el.srcObject !== localStream) el.srcObject = localStream;
  }, [localStream]);

  // ── Conexion con un participante puntual ────────────────────────────────

  const cerrarConexion = useCallback((userId: string) => {
    const conn = conexionesRef.current.get(userId);
    if (!conn) return;
    conn.pc.ontrack = null;
    conn.pc.onicecandidate = null;
    conn.pc.close();
    conexionesRef.current.delete(userId);
    colaSeñalesRef.current.delete(userId);
    setRemotos(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  // Procesa una señal entrante para un participante puntual. Se define antes
  // que abrirConexion porque esta la usa (las funciones const no se "hoistean"
  // como las declaraciones function — usarla antes de definirla rompe en
  // tiempo de ejecucion, no es solo una cuestion de estilo).
  const procesarSeñal = useCallback(async (userId: string, msg: GroupSignal) => {
    const conn = conexionesRef.current.get(userId);
    if (!conn) {
      const cola = colaSeñalesRef.current.get(userId) ?? [];
      cola.push(msg);
      colaSeñalesRef.current.set(userId, cola);
      return;
    }
    const pc = conn.pc;
    try {
      if (msg.type === "offer" && msg.sdp) {
        const choque = pc.signalingState !== "stable";
        if (choque) {
          const meToca = myUserId < userId;
          if (meToca) return; // mi offer gana, el de la otra parte se descarta
          await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit).catch(() => {});
        }
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of conn.pendingIce) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        conn.pendingIce = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(userId, { type: "answer", sdp: pc.localDescription ?? answer });
      } else if (msg.type === "answer" && msg.sdp) {
        if (pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        for (const c of conn.pendingIce) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        conn.pendingIce = [];
      } else if (msg.type === "ice" && msg.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        } else {
          conn.pendingIce.push(msg.candidate);
        }
      }
    } catch (err) {
      console.warn("[GroupWebRTC] fallo procesando", msg.type, "de", userId, err);
    }
  }, [myUserId, sendSignal]);

  /**
   * Crea (si no existe) la conexion con un participante y, si corresponde,
   * manda el offer. Para decidir quien ofrece primero en cada par sin que
   * las dos partes se pisen, se compara el id: el de menor id ofrece.
   */
  const abrirConexion = useCallback((userId: string) => {
    if (conexionesRef.current.has(userId)) return;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const conn: _Conexion = { pc, pendingIce: [], negociando: false };
    conexionesRef.current.set(userId, conn);

    setRemotos(prev => ({ ...prev, [userId]: { userId, stream: null, connected: false } }));

    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }

    const pistas = new Map<string, MediaStreamTrack>();
    const publicar = () => {
      setRemotos(prev => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? { userId, connected: false }), stream: new MediaStream(Array.from(pistas.values())) },
      }));
    };

    pc.ontrack = (event) => {
      const track = event.track;
      pistas.set(track.kind, track);
      track.onended = () => { pistas.delete(track.kind); publicar(); };
      publicar();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal(userId, { type: "ice", candidate: event.candidate.toJSON() });
    };

    pc.onconnectionstatechange = () => {
      setRemotos(prev => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? { userId, stream: null }), connected: pc.connectionState === "connected" },
      }));
    };

    const ofrecer = async () => {
      if (conn.negociando || pc.signalingState === "closed") return;
      conn.negociando = true;
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        sendSignal(userId, { type: "offer", sdp: pc.localDescription ?? offer });
      } catch (err) {
        console.warn("[GroupWebRTC] no se pudo ofrecer a", userId, err);
      } finally {
        conn.negociando = false;
      }
    };

    // Desempate: ofrece quien tiene el id "menor" en orden de texto, asi los
    // dos lados de cada par llegan a la misma decision sin coordinarse.
    const meToca = myUserId < userId;

    // Vaciar señales que hayan llegado antes de que esta conexion existiera.
    const atrasadas = colaSeñalesRef.current.get(userId) ?? [];
    colaSeñalesRef.current.delete(userId);

    void (async () => {
      for (const s of atrasadas) await procesarSeñal(userId, s);
      if (meToca && pc.signalingState === "stable" && !pc.remoteDescription) {
        await ofrecer();
      }
    })();
  }, [myUserId, sendSignal, procesarSeñal]);

  const handleSignal = useCallback((fromUserId: string, msg: GroupSignal) => {
    void procesarSeñal(fromUserId, msg);
  }, [procesarSeñal]);

  // Limpieza general al desmontar
  useEffect(() => {
    return () => {
      for (const userId of Array.from(conexionesRef.current.keys())) cerrarConexion(userId);
    };
  }, [cerrarConexion]);

  // ── Controles ────────────────────────────────────────────────────────────

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

  return {
    localVideoRef,
    localStream,
    estadoCamara,
    cameraAllowed,
    micEnabled,
    camEnabled,
    remotos,
    abrirConexion,
    cerrarConexion,
    handleSignal,
    toggleMic,
    toggleCam,
    reintentarCamara: encenderCamara,
  };
}
