"""Acceso a datos del modulo social: amistades, cuota diaria y plantas."""
from datetime import date, datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from modules.social.models import (
    ACCEPTED,
    BLOCKED,
    PENDING,
    Friendship,
    FriendRequestQuota,
    GardenPlant,
)


class FriendshipRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -- Lecturas -------------------------------------------------------

    async def get_by_id(self, friendship_id: str) -> Friendship | None:
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.plant))
            .where(Friendship.id == friendship_id)
        )
        return result.scalar_one_or_none()

    async def get_between(self, user_a: str, user_b: str) -> Friendship | None:
        """La relacion entre dos personas, sin importar quien la inicio."""
        low, high = Friendship.ordenar(user_a, user_b)
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.plant))
            .where(Friendship.user_low_id == low, Friendship.user_high_id == high)
        )
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: str, status: str) -> list[Friendship]:
        result = await self.db.execute(
            select(Friendship)
            .options(selectinload(Friendship.plant))
            .where(
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
                Friendship.status == status,
            )
            .order_by(Friendship.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_incoming_requests(self, user_id: str) -> list[Friendship]:
        """Solicitudes que le llegaron y aun no responde."""
        result = await self.db.execute(
            select(Friendship)
            .where(Friendship.addressee_id == user_id, Friendship.status == PENDING)
            .order_by(Friendship.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_outgoing_requests(self, user_id: str) -> list[Friendship]:
        """Solicitudes que envio y siguen sin respuesta."""
        result = await self.db.execute(
            select(Friendship)
            .where(Friendship.requester_id == user_id, Friendship.status == PENDING)
            .order_by(Friendship.created_at.desc())
        )
        return list(result.scalars().all())

    async def are_friends(self, user_a: str, user_b: str) -> bool:
        rel = await self.get_between(user_a, user_b)
        return rel is not None and rel.status == ACCEPTED

    async def is_blocked_between(self, user_a: str, user_b: str) -> bool:
        rel = await self.get_between(user_a, user_b)
        return rel is not None and rel.status == BLOCKED

    async def blocked_ids_for(self, user_id: str) -> list[str]:
        """Ids con los que este usuario no debe volver a emparejarse."""
        result = await self.db.execute(
            select(Friendship).where(
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
                Friendship.status == BLOCKED,
            )
        )
        return [rel.otro(user_id) for rel in result.scalars().all()]

    # -- Escrituras -----------------------------------------------------

    async def create_request(self, requester_id: str, addressee_id: str) -> Friendship:
        low, high = Friendship.ordenar(requester_id, addressee_id)
        rel = Friendship(
            user_low_id=low,
            user_high_id=high,
            requester_id=requester_id,
            addressee_id=addressee_id,
            status=PENDING,
        )
        self.db.add(rel)
        await self.db.commit()
        await self.db.refresh(rel)
        return rel

    async def set_status(
        self,
        rel: Friendship,
        status: str,
        blocked_by: str | None = None,
    ) -> Friendship:
        rel.status = status
        rel.responded_at = datetime.now(timezone.utc)
        if blocked_by is not None:
            rel.blocked_by_id = blocked_by
        await self.db.commit()
        await self.db.refresh(rel)
        return rel

    async def delete(self, rel: Friendship) -> None:
        await self.db.delete(rel)
        await self.db.commit()


class QuotaRepository:
    """Cuota diaria de solicitudes de amistad."""

    LIMITE_DIARIO = 3

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get_or_create(self, user_id: str, dia: date) -> FriendRequestQuota:
        result = await self.db.execute(
            select(FriendRequestQuota).where(
                FriendRequestQuota.user_id == user_id,
                FriendRequestQuota.quota_date == dia,
            )
        )
        cuota = result.scalar_one_or_none()
        if cuota is None:
            cuota = FriendRequestQuota(user_id=user_id, quota_date=dia, used=0)
            self.db.add(cuota)
            await self.db.commit()
            await self.db.refresh(cuota)
        return cuota

    async def usadas_hoy(self, user_id: str, hoy: date) -> int:
        cuota = await self._get_or_create(user_id, hoy)
        return cuota.used

    async def restantes(self, user_id: str, hoy: date) -> int:
        usadas = await self.usadas_hoy(user_id, hoy)
        return max(0, self.LIMITE_DIARIO - usadas)

    async def consumir(self, user_id: str, hoy: date) -> bool:
        """
        Descuenta una solicitud. Devuelve False si ya no quedan.
        """
        cuota = await self._get_or_create(user_id, hoy)
        if cuota.used >= self.LIMITE_DIARIO:
            return False
        cuota.used += 1
        await self.db.commit()
        return True

    async def devolver(self, user_id: str, hoy: date) -> None:
        """
        Regresa una solicitud a la cuota. Se usa cuando el usuario cancela
        una solicitud que aun nadie respondio, para no castigarlo por
        arrepentirse.
        """
        cuota = await self._get_or_create(user_id, hoy)
        if cuota.used > 0:
            cuota.used -= 1
            await self.db.commit()


class GardenRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_friendship(self, friendship_id: str) -> GardenPlant | None:
        result = await self.db.execute(
            select(GardenPlant).where(GardenPlant.friendship_id == friendship_id)
        )
        return result.scalar_one_or_none()

    async def create(self, friendship_id: str) -> GardenPlant:
        planta = GardenPlant(friendship_id=friendship_id)
        self.db.add(planta)
        await self.db.commit()
        await self.db.refresh(planta)
        return planta

    async def get_or_create(self, friendship_id: str) -> GardenPlant:
        planta = await self.get_by_friendship(friendship_id)
        return planta if planta is not None else await self.create(friendship_id)

    async def list_for_user(self, user_id: str) -> list[tuple[Friendship, GardenPlant]]:
        """Todas las plantas del jardin de un usuario, con su amistad."""
        result = await self.db.execute(
            select(Friendship, GardenPlant)
            .join(GardenPlant, GardenPlant.friendship_id == Friendship.id)
            .where(
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
                Friendship.status == ACCEPTED,
            )
            .order_by(GardenPlant.phase.desc(), GardenPlant.nourishment.desc())
        )
        return [(f, p) for f, p in result.all()]

    async def save(self, planta: GardenPlant) -> GardenPlant:
        await self.db.commit()
        await self.db.refresh(planta)
        return planta

    async def total_plants(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count(GardenPlant.id))
            .join(Friendship, GardenPlant.friendship_id == Friendship.id)
            .where(
                or_(Friendship.user_low_id == user_id, Friendship.user_high_id == user_id),
                Friendship.status == ACCEPTED,
            )
        )
        return int(result.scalar_one() or 0)
