/**
 * Configuracion de servidores ICE para WebRTC.
 *
 * STUN sirve para que cada navegador descubra su direccion publica y pueda
 * negociar una conexion directa. Cuando la red bloquea esa via directa, cosa
 * habitual en redes institucionales y en el internet movil del pais, hace
 * falta un servidor TURN que reenvie el video.
 *
 * Las credenciales del TURN se leen de variables de entorno para no dejarlas
 * escritas en el repositorio. Si no estan configuradas el sistema sigue
 * funcionando, pero solo entre personas cuya red permita la conexion directa.
 */

const TURN_URL = process.env.NEXT_PUBLIC_TURN_URL;
const TURN_USER = process.env.NEXT_PUBLIC_TURN_USERNAME;
const TURN_PASS = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.relay.metered.ca:80" },
];

function construirTurn(): RTCIceServer[] {
  if (!TURN_URL || !TURN_USER || !TURN_PASS) return [];

  // Se aceptan varias direcciones separadas por coma para cubrir UDP, TCP y TLS
  const direcciones = TURN_URL.split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  return [{ urls: direcciones, username: TURN_USER, credential: TURN_PASS }];
}

export const ICE_SERVERS: RTCIceServer[] = [...STUN_SERVERS, ...construirTurn()];

/** Permite avisar en la interfaz cuando no hay retransmision configurada. */
export const TURN_CONFIGURADO = construirTurn().length > 0;

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};
