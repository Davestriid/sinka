"""
Reglas del modulo social.

Aqui viven las decisiones de negocio: quien puede enviar una solicitud, cuantas
por dia, cuando nace una planta y cuanto crece con cada sesion compartida.
"""
import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from modules.identity.repositories.user_repository import UserRepository
from modules.social.models import ACCEPTED, BLOCKED, PENDING, REJECTED, Friendship
from modules.social.repositories.social_repository import (
    FriendshipRepository,
    GardenRepository,
    QuotaRepository,
)
from modules.social.services import growth_service

logger = logging.getLogger(__name__)


class SocialService:
    def __init__(
        self,
        friend_repo: FriendshipRepository,
        quota_repo:  QuotaRepository,
        garden_repo: GardenRepository,
        user_repo:   UserRepository,
    ) -> None:
        self.friends = friend_repo
        self.quota = quota_repo
        self.garden = garden_repo
        self.users = user_repo

    # ------------------------------------------------------------------
    # Solicitudes de amistad
    # ------------------------------------------------------------------

    async def send_request(self, requester_id: str, addressee_id: str) -> dict:
        """
        Envia una solicitud de amistad.

        Se gasta una de las tres solicitudes diarias. El limite existe para
        evitar el envio masivo y mantener la calidad de la comunidad.
        """
        if requester_id == addressee_id:
            raise HTTPException(400, "No puedes enviarte una solicitud a ti mismo.")

        destino = await self.users.get_by_id(addressee_id)
        if destino is None or not destino.is_active:
            raise HTTPException(404, "Ese usuario no existe.")

        existente = await self.friends.get_between(requester_id, addressee_id)
        if existente is not None:
            if existente.status == ACCEPTED:
                raise HTTPException(409, "Ya son amigos.")
            if existente.status == BLOCKED:
                raise HTTPException(403, "No es posible enviar una solicitud a este usuario.")
            if existente.status == PENDING:
                # Si la otra persona ya te habia escrito, aceptar en vez de duplicar
                if existente.requester_id == addressee_id:
                    return await self.accept_request(existente.id, requester_id)
                raise HTTPException(409, "Ya enviaste una solicitud a esta persona.")
            if existente.status == REJECTED:
                # Se permite reintentar tras un rechazo, gastando cuota
                if not await self.quota.consumir(requester_id, self._hoy()):
                    raise self._sin_cuota()
                await self.friends.set_status(existente, PENDING)
                return await self._request_dto(existente, requester_id)

        if not await self.quota.consumir(requester_id, self._hoy()):
            raise self._sin_cuota()

        rel = await self.friends.create_request(requester_id, addressee_id)
        logger.info("Social: %s envio solicitud a %s", requester_id, addressee_id)
        return await self._request_dto(rel, requester_id)

    async def accept_request(self, friendship_id: str, user_id: str) -> dict:
        """
        Acepta una solicitud pendiente y planta la semilla del vinculo.
        Solo puede aceptar quien recibio la solicitud.
        """
        rel = await self._get_pendiente(friendship_id, user_id)
        rel = await self.friends.set_status(rel, ACCEPTED)

        # La planta nace al aceptar, no antes: solo hay jardin entre amigos
        await self.garden.get_or_create(rel.id)
        logger.info("Social: amistad %s aceptada, planta creada", rel.id)
        return await self._friend_dto(rel, user_id)

    async def reject_request(self, friendship_id: str, user_id: str) -> None:
        rel = await self._get_pendiente(friendship_id, user_id)
        await self.friends.set_status(rel, REJECTED)

    async def cancel_request(self, friendship_id: str, user_id: str) -> None:
        """
        Cancela una solicitud propia que nadie ha respondido. Devuelve la
        cuota porque no tiene sentido castigar a quien se arrepiente.
        """
        rel = await self.friends.get_by_id(friendship_id)
        if rel is None or rel.status != PENDING:
            raise HTTPException(404, "Esa solicitud ya no existe.")
        if rel.requester_id != user_id:
            raise HTTPException(403, "Solo puedes cancelar tus propias solicitudes.")

        await self.friends.delete(rel)
        if rel.created_at is not None and rel.created_at.date() == self._hoy():
            await self.quota.devolver(user_id, self._hoy())

    async def remove_friend(self, friendship_id: str, user_id: str) -> None:
        """Elimina la amistad y con ella la planta compartida."""
        rel = await self.friends.get_by_id(friendship_id)
        if rel is None or rel.status != ACCEPTED:
            raise HTTPException(404, "Esa amistad no existe.")
        if user_id not in (rel.user_low_id, rel.user_high_id):
            raise HTTPException(403, "No formas parte de esa amistad.")
        await self.friends.delete(rel)

    async def block_user(self, user_id: str, otro_id: str) -> None:
        """
        Bloquea a alguien. Si ya existia relacion se marca como bloqueada,
        y si no, se crea la fila para que el matchmaking la respete.
        """
        if user_id == otro_id:
            raise HTTPException(400, "No puedes bloquearte a ti mismo.")

        rel = await self.friends.get_between(user_id, otro_id)
        if rel is None:
            rel = await self.friends.create_request(user_id, otro_id)
        await self.friends.set_status(rel, BLOCKED, blocked_by=user_id)
        logger.info("Social: %s bloqueo a %s", user_id, otro_id)

    async def unblock_user(self, user_id: str, otro_id: str) -> None:
        """Solo quien bloqueo puede desbloquear."""
        rel = await self.friends.get_between(user_id, otro_id)
        if rel is None or rel.status != BLOCKED:
            raise HTTPException(404, "Ese usuario no esta bloqueado.")
        if rel.blocked_by_id != user_id:
            raise HTTPException(403, "Solo quien bloqueo puede deshacer el bloqueo.")
        await self.friends.delete(rel)

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    async def list_friends(self, user_id: str) -> list[dict]:
        rels = await self.friends.list_for_user(user_id, ACCEPTED)
        return [await self._friend_dto(r, user_id) for r in rels]

    async def list_requests(self, user_id: str) -> dict:
        entrantes = await self.friends.list_incoming_requests(user_id)
        salientes = await self.friends.list_outgoing_requests(user_id)
        return {
            "incoming":  [await self._request_dto(r, user_id) for r in entrantes],
            "outgoing":  [await self._request_dto(r, user_id) for r in salientes],
            "remaining": await self.quota.restantes(user_id, self._hoy()),
            "daily_limit": QuotaRepository.LIMITE_DIARIO,
        }

    async def blocked_ids(self, user_id: str) -> list[str]:
        """Consumido por matchmaking para no volver a emparejar a estas personas."""
        return await self.friends.blocked_ids_for(user_id)

    # ------------------------------------------------------------------
    # Jardin
    # ------------------------------------------------------------------

    async def list_garden(self, user_id: str, lang: str = "es") -> dict:
        pares = await self.garden.list_for_user(user_id)
        plantas = []
        for rel, planta in pares:
            plantas.append(await self._plant_dto(rel, planta, user_id, lang))
        return {"plants": plantas, "total": len(plantas)}

    async def get_plant(self, friendship_id: str, user_id: str, lang: str = "es") -> dict:
        rel = await self.friends.get_by_id(friendship_id)
        if rel is None or rel.status != ACCEPTED:
            raise HTTPException(404, "Ese vinculo no existe.")
        if user_id not in (rel.user_low_id, rel.user_high_id):
            raise HTTPException(403, "Ese jardin no es tuyo.")

        planta = await self.garden.get_or_create(rel.id)
        return await self._plant_dto(rel, planta, user_id, lang)

    async def rename_plant(self, friendship_id: str, user_id: str, nombre: str) -> dict:
        rel = await self.friends.get_by_id(friendship_id)
        if rel is None or user_id not in (rel.user_low_id, rel.user_high_id):
            raise HTTPException(404, "Ese vinculo no existe.")

        planta = await self.garden.get_or_create(rel.id)
        planta.name = nombre.strip()[:60] or None
        await self.garden.save(planta)
        return await self._plant_dto(rel, planta, user_id)

    async def on_session_completed(self, payload: dict[str, Any]) -> None:
        """
        Escucha session.completed y riega la planta si los dos son amigos.

        Un primer encuentro entre desconocidos no crea planta. La relacion
        tiene que existir antes de que el jardin empiece a crecer.
        """
        user_a = payload.get("user_a_id")
        user_b = payload.get("user_b_id")
        if not user_a or not user_b:
            return

        rel = await self.friends.get_between(user_a, user_b)
        if rel is None or rel.status != ACCEPTED:
            return  # todavia no son amigos: no hay planta que regar

        minutos = self._minutos_de(payload)
        if minutos <= 0:
            return

        planta = await self.garden.get_or_create(rel.id)
        hoy = self._hoy()
        primer_riego_del_dia = planta.last_watered_on != hoy

        abono = growth_service.nourishment_from_session(
            minutes=minutos,
            completed=payload.get("reason") == "timer_completed",
            new_day=primer_riego_del_dia,
        )
        resultado = growth_service.water(planta.phase, planta.nourishment, abono)

        planta.phase = resultado.phase
        planta.nourishment = resultado.nourishment
        planta.sessions_together += 1
        planta.minutes_together += minutos
        planta.last_watered_on = hoy
        await self.garden.save(planta)

        if resultado.phases_advanced:
            logger.info(
                "Social: planta %s avanzo a fase '%s'",
                planta.id, resultado.phase_name,
            )

    # ------------------------------------------------------------------
    # Auxiliares
    # ------------------------------------------------------------------

    @staticmethod
    def _hoy() -> date:
        return datetime.now(timezone.utc).date()

    @staticmethod
    def _sin_cuota() -> HTTPException:
        return HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Ya usaste tus {QuotaRepository.LIMITE_DIARIO} solicitudes de hoy. "
            "Manana tendras tres nuevas.",
        )

    @staticmethod
    def _minutos_de(payload: dict[str, Any]) -> int:
        """
        Minutos de foco de la sesion. Se calcula desde las rondas porque es
        el dato que ya publica el modulo de sesiones.
        """
        rondas = int(payload.get("rounds_completed", 0) or 0)
        return rondas * 25

    async def _get_pendiente(self, friendship_id: str, user_id: str) -> Friendship:
        rel = await self.friends.get_by_id(friendship_id)
        if rel is None or rel.status != PENDING:
            raise HTTPException(404, "Esa solicitud ya no esta pendiente.")
        if rel.addressee_id != user_id:
            raise HTTPException(403, "Solo puedes responder solicitudes dirigidas a ti.")
        return rel

    async def _perfil(self, user_id: str) -> dict:
        u = await self.users.get_by_id(user_id)
        if u is None:
            return {"id": user_id, "username": "usuario", "alias": None, "avatar_url": None}
        return {
            "id":         u.id,
            "username":   u.username,
            "alias":      u.alias,
            "avatar_url": u.avatar_url,
        }

    async def _request_dto(self, rel: Friendship, user_id: str) -> dict:
        otro = rel.otro(user_id)
        return {
            "friendship_id": rel.id,
            "user":          await self._perfil(otro),
            "direction":     "outgoing" if rel.requester_id == user_id else "incoming",
            "created_at":    rel.created_at,
        }

    async def _friend_dto(self, rel: Friendship, user_id: str) -> dict:
        otro = rel.otro(user_id)
        planta = await self.garden.get_by_friendship(rel.id)
        return {
            "friendship_id": rel.id,
            "user":          await self._perfil(otro),
            "since":         rel.responded_at or rel.created_at,
            "plant": None if planta is None else {
                "phase":             planta.phase,
                "phase_name":        growth_service.phase_name(planta.phase),
                "emoji":             growth_service.phase_emoji(planta.phase),
                "sessions_together": planta.sessions_together,
            },
        }

    async def _plant_dto(self, rel: Friendship, planta, user_id: str, lang: str = "es") -> dict:
        otro = rel.otro(user_id)
        return {
            "friendship_id":     rel.id,
            "friend":            await self._perfil(otro),
            "name":              planta.name,
            "phase":             planta.phase,
            "phase_name":        growth_service.phase_name(planta.phase),
            "phase_label":       growth_service.phase_label(planta.phase, lang),
            "emoji":             growth_service.phase_emoji(planta.phase),
            "nourishment":       planta.nourishment,
            "next_phase_cost":   growth_service.cost_of(planta.phase),
            "progress_pct":      growth_service.progress_pct(planta.phase, planta.nourishment),
            "is_max_phase":      planta.phase >= growth_service.MAX_PHASE,
            "sessions_together": planta.sessions_together,
            "minutes_together":  planta.minutes_together,
            "hours_together":    round(planta.minutes_together / 60, 1),
            "last_watered_on":   planta.last_watered_on,
            "since":             rel.responded_at or rel.created_at,
        }
