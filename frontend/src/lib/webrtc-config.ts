/**
 * Configuración de ICE servers para WebRTC.
 *
 * STUN  — Google público, sin límite de peticiones.
 * TURN  — openrelay.metered.ca (openrelayproject.org), tier gratuito.
 *         Funciona como relay cuando NAT simétrico bloquea P2P directo
 *         (redes universitarias, VPN, CGNAT).
 */
export const ICE_SERVERS: RTCIceServer[] = [
  // STUN: descubre IP pública y hace hole-punching
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // TURN UDP — relay cuando P2P falla
  {
    urls:       "turn:openrelay.metered.ca:80",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
  // TURN TCP — fallback para firewalls que bloquean UDP
  {
    urls:       "turn:openrelay.metered.ca:443",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
  // TURNS (TLS) — último recurso
  {
    urls:       "turns:openrelay.metered.ca:443",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};
