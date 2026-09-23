"""Acceso a datos de citas programadas."""
from datetime import date, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.scheduling.models import (
    CUPO_DIARIO,
    ESTADOS_VIVOS,
    Appointment,
    AppointmentQuota,
)


class AppointmentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, appointment_id: str) -> Appointment | None:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        user_id: str,
        group_ids: list[str],
        desde: datetime | None = None,
    ) -> list[Appointment]:
        """
        Citas donde el usuario participa, sea como creador, invitado, o por
        pertenecer al grupo convocado.
        """
        condiciones = [
            Appointment.creator_id == user_id,
            Appointment.invitee_id == user_id,
        ]
        if group_ids:
            condiciones.append(Appointment.group_id.in_(group_ids))

        consulta = select(Appointment).where(
            or_(*condiciones),
            Appointment.status.in_(ESTADOS_VIVOS),
        )
        if desde is not None:
            consulta = consulta.where(Appointment.scheduled_for >= desde)

        result = await self.db.execute(consulta.order_by(Appointment.scheduled_for.asc()))
        return list(result.scalars().all())

    async def list_pending_invitations(self, user_id: str) -> list[Appointment]:
        result = await self.db.execute(
            select(Appointment)
            .where(Appointment.invitee_id == user_id, Appointment.status == "pending")
            .order_by(Appointment.scheduled_for.asc())
        )
        return list(result.scalars().all())

    async def find_overlap(
        self,
        user_id: str,
        inicio: datetime,
        fin: datetime,
        excluir_id: str | None = None,
    ) -> Appointment | None:
        """
        Busca una cita viva del usuario que se solape con el rango dado.
        Evita que alguien quede comprometido en dos lugares a la vez.
        """
        consulta = select(Appointment).where(
            or_(Appointment.creator_id == user_id, Appointment.invitee_id == user_id),
            Appointment.status.in_(ESTADOS_VIVOS),
        )
        if excluir_id:
            consulta = consulta.where(Appointment.id != excluir_id)

        result = await self.db.execute(consulta)
        for cita in result.scalars().all():
            cita_fin = cita.scheduled_for + timedelta(minutes=cita.duration_minutes)
            if cita.scheduled_for < fin and inicio < cita_fin:
                return cita
        return None

    async def create(
        self,
        creator_id: str,
        topic: str,
        scheduled_for: datetime,
        duration_minutes: int,
        invitee_id: str | None = None,
        group_id: str | None = None,
        title: str | None = None,
        status: str = "pending",
    ) -> Appointment:
        cita = Appointment(
            creator_id=creator_id,
            invitee_id=invitee_id,
            group_id=group_id,
            title=title,
            topic=topic,
            scheduled_for=scheduled_for,
            duration_minutes=duration_minutes,
            status=status,
        )
        self.db.add(cita)
        await self.db.commit()
        await self.db.refresh(cita)
        return cita

    async def set_status(self, cita: Appointment, estado: str) -> Appointment:
        cita.status = estado
        cita.responded_at = datetime.now(cita.scheduled_for.tzinfo)
        await self.db.commit()
        await self.db.refresh(cita)
        return cita

    async def set_session_id(self, cita: Appointment, session_id: str) -> Appointment:
        cita.session_id = session_id
        await self.db.commit()
        await self.db.refresh(cita)
        return cita

    async def expire_past(self, ahora: datetime) -> int:
        """
        Marca como vencidas las citas pendientes cuya hora ya paso.
        Devuelve cuantas cambio.
        """
        result = await self.db.execute(
            select(Appointment).where(
                Appointment.status == "pending",
                Appointment.scheduled_for < ahora,
            )
        )
        vencidas = list(result.scalars().all())
        for cita in vencidas:
            cita.status = "expired"
        if vencidas:
            await self.db.commit()
        return len(vencidas)


class AppointmentQuotaRepository:
    LIMITE_DIARIO = CUPO_DIARIO

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_create(self, user_id: str, dia: date) -> AppointmentQuota:
        result = await self.db.execute(
            select(AppointmentQuota).where(
                AppointmentQuota.user_id == user_id,
                AppointmentQuota.quota_date == dia,
            )
        )
        cupo = result.scalar_one_or_none()
        if cupo is None:
            cupo = AppointmentQuota(user_id=user_id, quota_date=dia, used=0)
            self.db.add(cupo)
            await self.db.commit()
            await self.db.refresh(cupo)
        return cupo

    async def restantes(self, user_id: str, hoy: date) -> int:
        cupo = await self._get_or_create(user_id, hoy)
        return max(0, self.LIMITE_DIARIO - cupo.used)

    async def consumir(self, user_id: str, hoy: date) -> bool:
        cupo = await self._get_or_create(user_id, hoy)
        if cupo.used >= self.LIMITE_DIARIO:
            return False
        cupo.used += 1
        await self.db.commit()
        return True

    async def devolver(self, user_id: str, hoy: date) -> None:
        cupo = await self._get_or_create(user_id, hoy)
        if cupo.used > 0:
            cupo.used -= 1
            await self.db.commit()
