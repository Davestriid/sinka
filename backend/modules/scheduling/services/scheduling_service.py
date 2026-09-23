"""
Reglas de las citas programadas.

Quien puede agendar con quien, cuantas veces al dia, y que pasa si dos citas
se pisan en el horario.
"""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException

from core.catalog import is_valid_topic, normalize_topic
from core.event_bus import EventBus
from modules.groups.repositories.group_repository import GroupRepository
from modules.identity.repositories.user_repository import UserRepository
from modules.scheduling.models import (
    CANCELLED,
    CONFIRMED,
    DECLINED,
    PENDING,
    Appointment,
)
from modules.scheduling.repositories.appointment_repository import (
    AppointmentQuotaRepository,
    AppointmentRepository,
)
from modules.social.repositories.social_repository import FriendshipRepository

logger = logging.getLogger(__name__)

# Con cuanta anticipacion minima se puede agendar
ANTICIPACION_MINIMA = timedelta(minutes=10)

# Hasta cuando se puede agendar hacia el futuro
HORIZONTE_MAXIMO = timedelta(days=30)

DURACIONES_VALIDAS = (25, 50, 90)

# Desde cuanto antes de la hora agendada se puede tocar "Unirse"
VENTANA_UNIRSE_ANTES = timedelta(minutes=10)


class SchedulingService:
    def __init__(
        self,
        appt_repo:   AppointmentRepository,
        quota_repo:  AppointmentQuotaRepository,
        friend_repo: FriendshipRepository,
        group_repo:  GroupRepository,
        user_repo:   UserRepository,
    ) -> None:
        self.appts = appt_repo
        self.quota = quota_repo
        self.friends = friend_repo
        self.groups = group_repo
        self.users = user_repo

    # ------------------------------------------------------------------
    # Crear
    # ------------------------------------------------------------------

    async def create(
        self,
        creator_id: str,
        scheduled_for: datetime,
        topic: str,
        duration_minutes: int = 25,
        invitee_id: str | None = None,
        group_id: str | None = None,
        title: str | None = None,
    ) -> dict:
        if (invitee_id is None) == (group_id is None):
            raise HTTPException(400, "Una cita es con una persona o con un grupo, no ambas.")

        if not is_valid_topic(topic):
            raise HTTPException(400, "Esa categoria no existe en el catalogo.")

        if duration_minutes not in DURACIONES_VALIDAS:
            raise HTTPException(
                400, f"La duracion debe ser una de {DURACIONES_VALIDAS} minutos."
            )

        cuando = self._normalizar_fecha(scheduled_for)
        self._validar_horario(cuando)

        if invitee_id is not None:
            await self._validar_invitado(creator_id, invitee_id)
        else:
            await self._validar_grupo(creator_id, group_id)  # type: ignore[arg-type]

        # Nadie puede estar comprometido en dos sitios a la vez
        fin = cuando + timedelta(minutes=duration_minutes)
        choque = await self.appts.find_overlap(creator_id, cuando, fin)
        if choque is not None:
            raise HTTPException(
                409,
                "Ya tienes una cita en ese horario. Elige otra hora o cancela la anterior.",
            )
        if invitee_id is not None:
            choque = await self.appts.find_overlap(invitee_id, cuando, fin)
            if choque is not None:
                raise HTTPException(
                    409, "Esa persona ya tiene una cita en ese horario."
                )

        if not await self.quota.consumir(creator_id, self._hoy()):
            raise HTTPException(
                429,
                f"Ya usaste tus {AppointmentQuotaRepository.LIMITE_DIARIO} citas de hoy. "
                "Manana tendras tres nuevas.",
            )

        # Las citas de grupo nacen confirmadas: no hay a quien preguntarle
        estado = PENDING if invitee_id is not None else CONFIRMED

        cita = await self.appts.create(
            creator_id=creator_id,
            invitee_id=invitee_id,
            group_id=group_id,
            topic=normalize_topic(topic),
            scheduled_for=cuando,
            duration_minutes=duration_minutes,
            title=(title or "").strip()[:80] or None,
            status=estado,
        )
        logger.info("Scheduling: %s agendo la cita %s para %s", creator_id, cita.id, cuando)
        return await self._dto(cita, creator_id)

    # ------------------------------------------------------------------
    # Responder
    # ------------------------------------------------------------------

    async def accept(self, appointment_id: str, user_id: str) -> dict:
        cita = await self._solo_invitado(appointment_id, user_id)

        # Puede haber aparecido un choque entre la invitacion y la respuesta
        fin = cita.scheduled_for + timedelta(minutes=cita.duration_minutes)
        choque = await self.appts.find_overlap(
            user_id, cita.scheduled_for, fin, excluir_id=cita.id
        )
        if choque is not None:
            raise HTTPException(409, "Ya tienes otra cita en ese horario.")

        cita = await self.appts.set_status(cita, CONFIRMED)
        return await self._dto(cita, user_id)

    async def decline(self, appointment_id: str, user_id: str) -> None:
        cita = await self._solo_invitado(appointment_id, user_id)
        await self.appts.set_status(cita, DECLINED)
        # Se devuelve el cupo a quien la creo: no fue su decision
        await self.quota.devolver(cita.creator_id, cita.created_at.date())

    async def cancel(self, appointment_id: str, user_id: str) -> None:
        cita = await self.appts.get_by_id(appointment_id)
        if cita is None:
            raise HTTPException(404, "Esa cita no existe.")
        if not cita.participa(user_id) and cita.creator_id != user_id:
            raise HTTPException(403, "No formas parte de esa cita.")

        await self.appts.set_status(cita, CANCELLED)
        if cita.creator_id == user_id and cita.created_at.date() == self._hoy():
            await self.quota.devolver(user_id, self._hoy())

    # ------------------------------------------------------------------
    # Unirse
    # ------------------------------------------------------------------

    async def join(self, appointment_id: str, user_id: str) -> dict:
        """
        Arranca (o reengancha) la sesion real detras de una cita confirmada.

        Reutiliza el mismo session_id si alguien ya toco "Unirse" antes, para
        que las dos personas terminen en la misma sesion. Publica el mismo
        evento que usa el matchmaking, asi el SessionService bootstrapea el
        estado en Redis exactamente igual que si se hubieran emparejado ahi.
        """
        cita = await self.appts.get_by_id(appointment_id)
        if cita is None:
            raise HTTPException(404, "Esa cita no existe.")
        if not cita.participa(user_id) and cita.creator_id != user_id:
            raise HTTPException(403, "No formas parte de esa cita.")
        if cita.is_group:
            raise HTTPException(
                400, "Unirse desde aqui todavia no esta disponible para citas de grupo."
            )
        if cita.status != CONFIRMED:
            raise HTTPException(409, "Esa cita todavia no esta confirmada.")

        ahora = datetime.now(timezone.utc)
        if ahora < cita.scheduled_for - VENTANA_UNIRSE_ANTES:
            raise HTTPException(
                400, "Todavia es muy pronto. Podras unirte 10 minutos antes de la hora."
            )

        if cita.session_id:
            return {"session_id": cita.session_id}

        session_id = str(uuid.uuid4())
        await self.appts.set_session_id(cita, session_id)

        task_info = {"topic": cita.topic, "task_title": cita.title}
        await EventBus.publish("match.created", {
            "session_id":  session_id,
            "user_a_id":   cita.creator_id,
            "user_b_id":   cita.invitee_id,
            "task_info_a": task_info,
            "task_info_b": task_info,
            "topic":       cita.topic,
            "by_affinity": False,
        })
        logger.info(
            "Scheduling: %s inicio la sesion %s de la cita %s", user_id, session_id, cita.id
        )
        return {"session_id": session_id}

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    async def list_mine(self, user_id: str) -> dict:
        ahora = datetime.now(timezone.utc)
        await self.appts.expire_past(ahora)

        grupos = await self.groups.list_for_user(user_id)
        citas = await self.appts.list_for_user(
            user_id,
            group_ids=[g.id for g in grupos],
            desde=ahora - timedelta(hours=1),  # se muestran las recien pasadas
        )

        hoy = ahora.date()
        return {
            "appointments": [await self._dto(c, user_id) for c in citas],
            "today":        [
                await self._dto(c, user_id)
                for c in citas if c.scheduled_for.date() == hoy
            ],
            "remaining":   await self.quota.restantes(user_id, hoy),
            "daily_limit": AppointmentQuotaRepository.LIMITE_DIARIO,
        }

    async def list_invitations(self, user_id: str) -> list[dict]:
        citas = await self.appts.list_pending_invitations(user_id)
        return [await self._dto(c, user_id) for c in citas]

    # ------------------------------------------------------------------
    # Auxiliares
    # ------------------------------------------------------------------

    @staticmethod
    def _hoy() -> date:
        return datetime.now(timezone.utc).date()

    @staticmethod
    def _normalizar_fecha(cuando: datetime) -> datetime:
        """Toda fecha se guarda en UTC. Si viene sin zona, se asume UTC."""
        if cuando.tzinfo is None:
            return cuando.replace(tzinfo=timezone.utc)
        return cuando.astimezone(timezone.utc)

    @staticmethod
    def _validar_horario(cuando: datetime) -> None:
        ahora = datetime.now(timezone.utc)
        if cuando < ahora + ANTICIPACION_MINIMA:
            raise HTTPException(
                400,
                "Agenda con al menos 10 minutos de anticipacion. "
                "Si quieres empezar ya, busca companero directamente.",
            )
        if cuando > ahora + HORIZONTE_MAXIMO:
            raise HTTPException(400, "Solo puedes agendar hasta 30 dias hacia adelante.")

    async def _validar_invitado(self, creator_id: str, invitee_id: str) -> None:
        if creator_id == invitee_id:
            raise HTTPException(400, "No puedes agendar una cita contigo mismo.")

        # Solo se agenda con amigos: una cita es un compromiso, no una invitacion fria
        if not await self.friends.are_friends(creator_id, invitee_id):
            raise HTTPException(
                403,
                "Solo puedes agendar citas con tus amigos. "
                "Envia primero una solicitud de amistad.",
            )

    async def _validar_grupo(self, creator_id: str, group_id: str) -> None:
        grupo = await self.groups.get_by_id(group_id)
        if grupo is None:
            raise HTTPException(404, "Ese grupo no existe.")
        if await self.groups.get_membership(group_id, creator_id) is None:
            raise HTTPException(403, "No perteneces a ese grupo.")

    async def _solo_invitado(self, appointment_id: str, user_id: str) -> Appointment:
        cita = await self.appts.get_by_id(appointment_id)
        if cita is None:
            raise HTTPException(404, "Esa cita no existe.")
        if cita.status != PENDING:
            raise HTTPException(409, "Esa cita ya fue respondida.")
        if cita.invitee_id != user_id:
            raise HTTPException(403, "Solo puedes responder las citas dirigidas a ti.")
        return cita

    async def _perfil(self, user_id: str | None) -> dict | None:
        if user_id is None:
            return None
        u = await self.users.get_by_id(user_id)
        if u is None:
            return {"id": user_id, "username": "usuario", "alias": None, "avatar_url": None}
        return {
            "id":         u.id,
            "username":   u.username,
            "alias":      u.alias,
            "avatar_url": u.avatar_url,
        }

    async def _dto(self, cita: Appointment, user_id: str) -> dict:
        grupo = None
        if cita.group_id:
            g = await self.groups.get_by_id(cita.group_id)
            if g is not None:
                grupo = {"id": g.id, "name": g.name, "topic": g.topic}

        # La otra parte depende de quien mira la cita
        otro_id = cita.invitee_id if cita.creator_id == user_id else cita.creator_id

        return {
            "id":               cita.id,
            "title":            cita.title,
            "topic":            cita.topic,
            "scheduled_for":    cita.scheduled_for,
            "duration_minutes": cita.duration_minutes,
            "status":           cita.status,
            "is_group":         cita.is_group,
            "is_creator":       cita.creator_id == user_id,
            "creator":          await self._perfil(cita.creator_id),
            "invitee":          await self._perfil(cita.invitee_id),
            "other_party":      await self._perfil(otro_id),
            "group":            grupo,
            "session_id":       cita.session_id,
            "created_at":       cita.created_at,
        }
