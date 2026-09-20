"""Acceso a datos del modulo de grupos."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from modules.groups.models import MEMBER, OWNER, PUBLIC, Group, GroupMember


class GroupRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # -- Lecturas -------------------------------------------------------

    async def get_by_id(self, group_id: str) -> Group | None:
        result = await self.db.execute(
            select(Group)
            .options(selectinload(Group.members))
            .where(Group.id == group_id, Group.is_active.is_(True))
        )
        return result.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Group | None:
        result = await self.db.execute(
            select(Group)
            .options(selectinload(Group.members))
            .where(
                func.upper(Group.invite_code) == code.strip().upper(),
                Group.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def explore(self, topic: str | None, limite: int = 50) -> list[Group]:
        """Grupos publicos que aun tienen cupo, opcionalmente filtrados por tema."""
        consulta = (
            select(Group)
            .options(selectinload(Group.members))
            .where(Group.visibility == PUBLIC, Group.is_active.is_(True))
        )
        if topic:
            consulta = consulta.where(Group.topic == topic)

        result = await self.db.execute(consulta.order_by(Group.created_at.desc()).limit(limite))
        grupos = list(result.scalars().all())
        # El cupo se filtra en memoria porque members ya viene cargado
        return [g for g in grupos if len(g.members) < g.max_members]

    async def list_for_user(self, user_id: str) -> list[Group]:
        result = await self.db.execute(
            select(Group)
            .options(selectinload(Group.members))
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.user_id == user_id, Group.is_active.is_(True))
            .order_by(Group.created_at.desc())
        )
        return list(result.scalars().unique().all())

    async def count_owned(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count(Group.id)).where(
                Group.owner_id == user_id, Group.is_active.is_(True)
            )
        )
        return int(result.scalar_one() or 0)

    async def get_membership(self, group_id: str, user_id: str) -> GroupMember | None:
        result = await self.db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def member_ids(self, group_id: str) -> list[str]:
        result = await self.db.execute(
            select(GroupMember.user_id).where(GroupMember.group_id == group_id)
        )
        return [row[0] for row in result.all()]

    # -- Escrituras -----------------------------------------------------

    async def create(
        self,
        name: str,
        topic: str,
        visibility: str,
        owner_id: str,
        description: str | None,
        default_task: str | None,
        open_to_strangers: bool,
    ) -> Group:
        grupo = Group(
            name=name,
            topic=topic,
            visibility=visibility,
            owner_id=owner_id,
            description=description,
            default_task=default_task,
            open_to_strangers=open_to_strangers,
        )
        self.db.add(grupo)
        await self.db.flush()

        # Quien lo crea entra como dueno
        self.db.add(GroupMember(group_id=grupo.id, user_id=owner_id, role=OWNER))
        await self.db.commit()

        return await self.get_by_id(grupo.id)  # type: ignore[return-value]

    async def add_member(self, group_id: str, user_id: str) -> GroupMember:
        miembro = GroupMember(group_id=group_id, user_id=user_id, role=MEMBER)
        self.db.add(miembro)
        await self.db.commit()
        await self.db.refresh(miembro)
        return miembro

    async def remove_member(self, miembro: GroupMember) -> None:
        await self.db.delete(miembro)
        await self.db.commit()

    async def update(self, grupo: Group, **campos) -> Group:
        for nombre, valor in campos.items():
            if valor is not None and hasattr(grupo, nombre):
                setattr(grupo, nombre, valor)
        await self.db.commit()
        await self.db.refresh(grupo)
        return grupo

    async def deactivate(self, grupo: Group) -> None:
        """
        Se marca como inactivo en vez de borrarlo, para conservar el historial
        de sesiones que apuntan a este grupo.
        """
        grupo.is_active = False
        await self.db.commit()
