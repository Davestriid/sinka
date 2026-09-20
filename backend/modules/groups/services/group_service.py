"""
Reglas del modulo de grupos.

Decide quien puede crear, entrar, salir y expulsar, y cuando la pantalla
compartida pasa a ser obligatoria.
"""
import logging

from fastapi import HTTPException, status

from core.catalog import is_valid_topic, normalize_topic
from modules.groups.models import (
    MEMBER,
    OWNER,
    PRIVATE,
    PUBLIC,
    Group,
    generar_codigo,
)
from modules.groups.repositories.group_repository import GroupRepository
from modules.identity.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

# Cuantos grupos puede tener abiertos una misma persona. Evita que alguien
# cree decenas de grupos vacios que ensucian la pantalla de explorar.
MAX_GRUPOS_PROPIOS = 5


class GroupService:
    def __init__(self, group_repo: GroupRepository, user_repo: UserRepository) -> None:
        self.groups = group_repo
        self.users = user_repo

    # ------------------------------------------------------------------
    # Crear y administrar
    # ------------------------------------------------------------------

    async def create(
        self,
        owner_id: str,
        name: str,
        topic: str,
        visibility: str,
        description: str | None = None,
        default_task: str | None = None,
        open_to_strangers: bool = False,
    ) -> dict:
        nombre = name.strip()
        if len(nombre) < 3:
            raise HTTPException(400, "El nombre del grupo debe tener al menos 3 caracteres.")

        if not is_valid_topic(topic):
            raise HTTPException(400, "Esa categoria no existe en el catalogo.")

        if visibility not in (PUBLIC, PRIVATE):
            raise HTTPException(400, "La visibilidad debe ser 'public' o 'private'.")

        propios = await self.groups.count_owned(owner_id)
        if propios >= MAX_GRUPOS_PROPIOS:
            raise HTTPException(
                409,
                f"Ya tienes {MAX_GRUPOS_PROPIOS} grupos abiertos. "
                "Cierra alguno antes de crear otro.",
            )

        # Un grupo publico esta abierto a desconocidos por definicion
        abierto = open_to_strangers or visibility == PUBLIC

        grupo = await self.groups.create(
            name=nombre,
            topic=normalize_topic(topic),
            visibility=visibility,
            owner_id=owner_id,
            description=(description or "").strip()[:200] or None,
            default_task=(default_task or "").strip()[:80] or None,
            open_to_strangers=abierto,
        )
        logger.info("Groups: %s creo el grupo '%s' (%s)", owner_id, nombre, grupo.id)
        return await self._group_dto(grupo, owner_id)

    async def update(self, group_id: str, user_id: str, cambios: dict) -> dict:
        grupo = await self._solo_dueno(group_id, user_id)

        if "topic" in cambios and cambios["topic"] is not None:
            if not is_valid_topic(cambios["topic"]):
                raise HTTPException(400, "Esa categoria no existe en el catalogo.")

        if "visibility" in cambios and cambios["visibility"] == PUBLIC:
            # Volverlo publico lo abre a desconocidos, y eso activa la pantalla
            cambios["open_to_strangers"] = True

        grupo = await self.groups.update(grupo, **cambios)
        return await self._group_dto(grupo, user_id)

    async def regenerate_code(self, group_id: str, user_id: str) -> dict:
        """
        Genera un codigo nuevo. Sirve cuando el anterior se filtro y el dueno
        quiere cortar el acceso a quien ya no deberia entrar.
        """
        grupo = await self._solo_dueno(group_id, user_id)
        grupo = await self.groups.update(grupo, invite_code=generar_codigo())
        return {"invite_code": grupo.invite_code}

    async def disband(self, group_id: str, user_id: str) -> None:
        grupo = await self._solo_dueno(group_id, user_id)
        await self.groups.deactivate(grupo)
        logger.info("Groups: grupo %s disuelto por %s", group_id, user_id)

    # ------------------------------------------------------------------
    # Entrar y salir
    # ------------------------------------------------------------------

    async def join_public(self, group_id: str, user_id: str) -> dict:
        grupo = await self._existente(group_id)
        if grupo.visibility != PUBLIC:
            raise HTTPException(403, "Ese grupo es privado. Necesitas el codigo de invitacion.")
        return await self._entrar(grupo, user_id)

    async def join_by_code(self, code: str, user_id: str) -> dict:
        grupo = await self.groups.get_by_code(code)
        if grupo is None:
            raise HTTPException(404, "Ese codigo de invitacion no es valido.")
        return await self._entrar(grupo, user_id)

    async def leave(self, group_id: str, user_id: str) -> None:
        grupo = await self._existente(group_id)
        miembro = await self.groups.get_membership(group_id, user_id)
        if miembro is None:
            raise HTTPException(404, "No perteneces a ese grupo.")

        if miembro.role == OWNER:
            raise HTTPException(
                409,
                "El dueno no puede salir del grupo. Disuelvelo o traspasa la propiedad.",
            )

        await self.groups.remove_member(miembro)

    async def kick(self, group_id: str, user_id: str, target_id: str) -> None:
        await self._solo_dueno(group_id, user_id)
        if target_id == user_id:
            raise HTTPException(400, "No puedes expulsarte a ti mismo.")

        miembro = await self.groups.get_membership(group_id, target_id)
        if miembro is None:
            raise HTTPException(404, "Esa persona no esta en el grupo.")

        await self.groups.remove_member(miembro)
        logger.info("Groups: %s expulso a %s del grupo %s", user_id, target_id, group_id)

    async def transfer_ownership(self, group_id: str, user_id: str, target_id: str) -> dict:
        """Traspasa la propiedad para que el dueno actual pueda salir."""
        grupo = await self._solo_dueno(group_id, user_id)

        nuevo = await self.groups.get_membership(group_id, target_id)
        if nuevo is None:
            raise HTTPException(404, "Esa persona no esta en el grupo.")

        actual = await self.groups.get_membership(group_id, user_id)
        if actual is not None:
            actual.role = MEMBER
        nuevo.role = OWNER

        grupo = await self.groups.update(grupo, owner_id=target_id)
        return await self._group_dto(grupo, user_id)

    # ------------------------------------------------------------------
    # Consultas
    # ------------------------------------------------------------------

    async def explore(self, user_id: str, topic: str | None = None) -> list[dict]:
        """Grupos publicos con cupo. Se marcan los que el usuario ya integra."""
        grupos = await self.groups.explore(topic)
        return [await self._group_dto(g, user_id) for g in grupos]

    async def my_groups(self, user_id: str) -> list[dict]:
        grupos = await self.groups.list_for_user(user_id)
        return [await self._group_dto(g, user_id) for g in grupos]

    async def detail(self, group_id: str, user_id: str) -> dict:
        grupo = await self._existente(group_id)

        # A un grupo privado solo se asoma quien pertenece
        if grupo.visibility == PRIVATE:
            miembro = await self.groups.get_membership(group_id, user_id)
            if miembro is None:
                raise HTTPException(403, "Ese grupo es privado.")

        return await self._group_dto(grupo, user_id, con_miembros=True)

    # ------------------------------------------------------------------
    # Auxiliares
    # ------------------------------------------------------------------

    async def _existente(self, group_id: str) -> Group:
        grupo = await self.groups.get_by_id(group_id)
        if grupo is None:
            raise HTTPException(404, "Ese grupo no existe.")
        return grupo

    async def _solo_dueno(self, group_id: str, user_id: str) -> Group:
        grupo = await self._existente(group_id)
        if grupo.owner_id != user_id:
            raise HTTPException(403, "Solo el dueno del grupo puede hacer eso.")
        return grupo

    async def _entrar(self, grupo: Group, user_id: str) -> dict:
        if await self.groups.get_membership(grupo.id, user_id) is not None:
            return await self._group_dto(grupo, user_id)

        if len(grupo.members) >= grupo.max_members:
            raise HTTPException(409, "El grupo ya esta lleno.")

        await self.groups.add_member(grupo.id, user_id)
        grupo = await self._existente(grupo.id)
        logger.info("Groups: %s entro al grupo %s", user_id, grupo.id)
        return await self._group_dto(grupo, user_id)

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

    async def _group_dto(self, grupo: Group, user_id: str, con_miembros: bool = False) -> dict:
        miembro = await self.groups.get_membership(grupo.id, user_id)
        es_miembro = miembro is not None

        datos = {
            "id":                    grupo.id,
            "name":                  grupo.name,
            "description":           grupo.description,
            "topic":                 grupo.topic,
            "visibility":            grupo.visibility,
            "default_task":          grupo.default_task,
            "member_count":          len(grupo.members),
            "max_members":           grupo.max_members,
            "is_full":               len(grupo.members) >= grupo.max_members,
            "open_to_strangers":     grupo.open_to_strangers,
            "requires_screen_share": grupo.requires_screen_share,
            "is_member":             es_miembro,
            "is_owner":              grupo.owner_id == user_id,
            "my_role":               miembro.role if miembro else None,
            "created_at":            grupo.created_at,
            # El codigo solo lo ve quien pertenece al grupo
            "invite_code":           grupo.invite_code if es_miembro else None,
        }

        if con_miembros:
            datos["members"] = [
                {**await self._perfil(m.user_id), "role": m.role, "joined_at": m.joined_at}
                for m in grupo.members
            ]

        return datos
