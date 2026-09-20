"""
Sala de espera de los grupos.

Antes de que un grupo empiece a trabajar junto, sus integrantes entran a una
sala donde se ven quienes estan conectados y se marcan como listos. Cuando al
menos dos personas estan listas, el dueno puede arrancar la sesion.

El estado vive en memoria del proceso. Es informacion efimera que no tiene
sentido persistir: si el servidor se reinicia, la sala simplemente se vacia y
la gente vuelve a entrar.
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from core.event_bus import EventBus

if TYPE_CHECKING:
    from fastapi import WebSocket

logger = logging.getLogger(__name__)

MIN_PARA_INICIAR = 2


@dataclass
class _Presencia:
    websocket: "WebSocket"
    username:  str
    avatar_url: str | None = None
    ready:     bool = False
    sharing_screen: bool = False


@dataclass
class _Lobby:
    group_id: str
    requires_screen_share: bool
    owner_id: str
    presentes: dict[str, _Presencia] = field(default_factory=dict)

    def puede_iniciar(self) -> tuple[bool, str]:
        """
        Si el grupo puede arrancar la sesion y, si no, por que no.
        """
        listos = [p for p in self.presentes.values() if p.ready]
        if len(listos) < MIN_PARA_INICIAR:
            return False, f"Hacen falta al menos {MIN_PARA_INICIAR} personas listas."

        if self.requires_screen_share:
            sin_pantalla = [p for p in listos if not p.sharing_screen]
            if sin_pantalla:
                return False, (
                    "En este grupo compartir pantalla es obligatorio. "
                    "Falta que la compartan: "
                    + ", ".join(p.username for p in sin_pantalla)
                )

        return True, ""


class LobbyService:
    """Una sala por grupo, viva mientras haya alguien conectado."""

    def __init__(self) -> None:
        self._lobbies: dict[str, _Lobby] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Conexion
    # ------------------------------------------------------------------

    async def connect(
        self,
        group_id: str,
        user_id: str,
        username: str,
        avatar_url: str | None,
        owner_id: str,
        requires_screen_share: bool,
        websocket: "WebSocket",
    ) -> None:
        async with self._lock:
            lobby = self._lobbies.get(group_id)
            if lobby is None:
                lobby = _Lobby(
                    group_id=group_id,
                    requires_screen_share=requires_screen_share,
                    owner_id=owner_id,
                )
                self._lobbies[group_id] = lobby

            lobby.presentes[user_id] = _Presencia(
                websocket=websocket,
                username=username,
                avatar_url=avatar_url,
            )

        logger.info("Lobby: %s entro a la sala del grupo %s", user_id, group_id)
        await self._difundir_estado(group_id)

    async def disconnect(self, group_id: str, user_id: str) -> None:
        async with self._lock:
            lobby = self._lobbies.get(group_id)
            if lobby is None:
                return
            lobby.presentes.pop(user_id, None)
            vacia = not lobby.presentes
            if vacia:
                self._lobbies.pop(group_id, None)

        if not vacia:
            await self._difundir_estado(group_id)
        logger.info("Lobby: %s salio de la sala del grupo %s", user_id, group_id)

    # ------------------------------------------------------------------
    # Acciones dentro de la sala
    # ------------------------------------------------------------------

    async def set_ready(self, group_id: str, user_id: str, listo: bool) -> None:
        lobby = self._lobbies.get(group_id)
        if lobby is None:
            return
        presencia = lobby.presentes.get(user_id)
        if presencia is None:
            return
        presencia.ready = listo
        await self._difundir_estado(group_id)

    async def set_screen_share(self, group_id: str, user_id: str, compartiendo: bool) -> None:
        lobby = self._lobbies.get(group_id)
        if lobby is None:
            return
        presencia = lobby.presentes.get(user_id)
        if presencia is None:
            return
        presencia.sharing_screen = compartiendo
        await self._difundir_estado(group_id)

    async def start_session(self, group_id: str, user_id: str) -> dict[str, Any]:
        """
        Arranca la sesion grupal. Solo el dueno puede hacerlo y solo si se
        cumplen las condiciones de la sala.
        """
        lobby = self._lobbies.get(group_id)
        if lobby is None:
            return {"ok": False, "reason": "La sala esta vacia."}

        if user_id != lobby.owner_id:
            return {"ok": False, "reason": "Solo quien creo el grupo puede iniciar la sesion."}

        puede, motivo = lobby.puede_iniciar()
        if not puede:
            return {"ok": False, "reason": motivo}

        session_id = str(uuid.uuid4())
        participantes = [uid for uid, p in lobby.presentes.items() if p.ready]

        await EventBus.publish("group.session.started", {
            "group_id":     group_id,
            "session_id":   session_id,
            "participants": participantes,
        })

        await self._difundir(group_id, {
            "type": "SESSION_STARTED",
            "payload": {
                "session_id":   session_id,
                "participants": participantes,
            },
        })

        logger.info(
            "Lobby: sesion grupal %s iniciada en el grupo %s con %d personas",
            session_id, group_id, len(participantes),
        )
        return {"ok": True, "session_id": session_id, "participants": participantes}

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    def snapshot(self, group_id: str) -> dict[str, Any]:
        """Estado actual de la sala, tal como lo ve el frontend."""
        lobby = self._lobbies.get(group_id)
        if lobby is None:
            return {
                "present": [],
                "ready_count": 0,
                "can_start": False,
                "reason": "La sala esta vacia.",
                "requires_screen_share": False,
            }

        puede, motivo = lobby.puede_iniciar()
        return {
            "present": [
                {
                    "user_id":        uid,
                    "username":       p.username,
                    "avatar_url":     p.avatar_url,
                    "ready":          p.ready,
                    "sharing_screen": p.sharing_screen,
                    "is_owner":       uid == lobby.owner_id,
                }
                for uid, p in lobby.presentes.items()
            ],
            "ready_count":           sum(1 for p in lobby.presentes.values() if p.ready),
            "can_start":             puede,
            "reason":                motivo,
            "requires_screen_share": lobby.requires_screen_share,
        }

    def online_count(self, group_id: str) -> int:
        lobby = self._lobbies.get(group_id)
        return len(lobby.presentes) if lobby else 0

    # ------------------------------------------------------------------
    # Difusion
    # ------------------------------------------------------------------

    async def _difundir_estado(self, group_id: str) -> None:
        await self._difundir(group_id, {
            "type":    "LOBBY_STATE",
            "payload": self.snapshot(group_id),
        })

    async def _difundir(self, group_id: str, mensaje: dict) -> None:
        """
        Envia un mensaje a todos los presentes.

        Si a alguien no se le puede escribir, se le da por desconectado y se
        limpia. Un socket caido no debe impedir que los demas reciban el aviso.
        """
        lobby = self._lobbies.get(group_id)
        if lobby is None:
            return

        caidos: list[str] = []
        for uid, presencia in list(lobby.presentes.items()):
            try:
                await presencia.websocket.send_json(mensaje)
            except Exception:
                caidos.append(uid)

        for uid in caidos:
            lobby.presentes.pop(uid, None)
            logger.info("Lobby: %s quedo desconectado del grupo %s", uid, group_id)


lobby_service = LobbyService()
