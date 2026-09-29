"""
Servicio de logros.

El catalogo vive aca, como una lista fija — igual que las fases del jardin
en modules/social/services/growth_service.py. No hay tabla de logros ni
panel de administracion: agregar uno nuevo es agregar una entrada a CATALOG
y, si su metrica no existe todavia, un caso mas en `_medir`.

Cada logro tiene una "metric" (de donde sale el numero a comparar) y un
"target" (el numero que hay que alcanzar). La mayoria de las metricas se
leen de tablas que ya existen — sessions_completed y streak_max, por
ejemplo, ya los lleva user_stats para la gamificacion normal. Solo
"group_sessions" necesita un contador propio (ver models.py) porque ningun
otro modulo todavia registra cuantas sesiones de grupo empezo cada quien.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Final

from core.database import AsyncSessionLocal
from modules.achievements.repositories.achievements_repository import AchievementsRepository
from modules.identity.repositories.user_repository import UserRepository

logger = logging.getLogger(__name__)

MAX_PLANT_PHASE: Final[int] = 4   # ultima fase del jardin (ver growth_service.PHASES)


@dataclass(frozen=True)
class Achievement:
    id: str
    category: str          # primeros_pasos | constancia | vinculos | jardin | tienda | grupos
    name_es: str
    name_en: str
    description_es: str
    description_en: str
    icon: str               # nombre de icono lucide-react, ver frontend
    metric: str              # clave que resuelve _medir()
    target: int
    reward_fc: int


CATALOG: Final[list[Achievement]] = [
    # ── Primeros pasos ───────────────────────────────────────────────────
    Achievement(
        "primer_enfoque", "primeros_pasos",
        "Primer enfoque", "First focus",
        "Completa tu primera sesión de concentración.",
        "Complete your first focus session.",
        "Target", "sessions_completed", 1, 20,
    ),
    Achievement(
        "perfil_completo", "primeros_pasos",
        "Te presentaste", "You introduced yourself",
        "Agrega una foto o símbolo y una descripción a tu perfil.",
        "Add a photo or symbol and a bio to your profile.",
        "UserCircle", "profile_complete", 1, 20,
    ),
    Achievement(
        "primer_grupo", "primeros_pasos",
        "No estás solo", "You're not alone",
        "Únete a tu primer grupo de trabajo.",
        "Join your first work group.",
        "Users", "group_sessions", 1, 30,
    ),

    # ── Constancia ───────────────────────────────────────────────────────
    Achievement(
        "racha_3", "constancia",
        "Tres días seguidos", "Three days straight",
        "Mantén una racha de 3 días.",
        "Keep a 3-day streak.",
        "Flame", "streak_max", 3, 30,
    ),
    Achievement(
        "racha_7", "constancia",
        "Una semana entera", "A whole week",
        "Mantén una racha de 7 días.",
        "Keep a 7-day streak.",
        "Flame", "streak_max", 7, 75,
    ),
    Achievement(
        "racha_30", "constancia",
        "Hábito formado", "Habit formed",
        "Mantén una racha de 30 días.",
        "Keep a 30-day streak.",
        "Flame", "streak_max", 30, 300,
    ),

    # ── Vínculos ─────────────────────────────────────────────────────────
    Achievement(
        "primer_amigo", "vinculos",
        "Primer vínculo", "First bond",
        "Haz tu primer amigo en SINKA.",
        "Make your first friend on SINKA.",
        "Handshake", "friends_count", 1, 20,
    ),
    Achievement(
        "cinco_amigos", "vinculos",
        "Círculo cercano", "Close circle",
        "Ten 5 amistades.",
        "Have 5 friendships.",
        "Handshake", "friends_count", 5, 60,
    ),
    Achievement(
        "quince_amigos", "vinculos",
        "Comunidad", "Community",
        "Ten 15 amistades.",
        "Have 15 friendships.",
        "Handshake", "friends_count", 15, 150,
    ),

    # ── Jardín ───────────────────────────────────────────────────────────
    Achievement(
        "primera_planta_madura", "jardin",
        "Primera cosecha", "First harvest",
        "Haz crecer una planta hasta su fase máxima.",
        "Grow a plant to its final phase.",
        "Sprout", "plants_maxed", 1, 50,
    ),
    Achievement(
        "tres_plantas_maduras", "jardin",
        "Jardinero dedicado", "Dedicated gardener",
        "Haz crecer 3 plantas hasta su fase máxima.",
        "Grow 3 plants to their final phase.",
        "Sprout", "plants_maxed", 3, 150,
    ),
    Achievement(
        "quinientos_minutos_jardin", "jardin",
        "Raíces profundas", "Deep roots",
        "Acumula 500 minutos compartidos con tus amistades.",
        "Accumulate 500 shared minutes with your friends.",
        "Sprout", "garden_minutes", 500, 100,
    ),

    # ── Tienda ───────────────────────────────────────────────────────────
    Achievement(
        "primera_compra", "tienda",
        "Tu primer cosmético", "Your first cosmetic",
        "Compra tu primer artículo en la tienda.",
        "Buy your first shop item.",
        "ShoppingBag", "shop_purchases", 1, 10,
    ),
    Achievement(
        "cinco_compras", "tienda",
        "Coleccionista", "Collector",
        "Compra 5 artículos en la tienda.",
        "Buy 5 shop items.",
        "ShoppingBag", "shop_purchases", 5, 50,
    ),
    Achievement(
        "diez_compras", "tienda",
        "Estilo propio", "Signature style",
        "Compra 10 artículos en la tienda.",
        "Buy 10 shop items.",
        "ShoppingBag", "shop_purchases", 10, 100,
    ),

    # ── Grupos ───────────────────────────────────────────────────────────
    Achievement(
        "grupo_1", "grupos",
        "Trabajo en equipo", "Teamwork",
        "Participa en tu primera sesión de grupo.",
        "Take part in your first group session.",
        "Users", "group_sessions", 1, 30,
    ),
    Achievement(
        "grupo_5", "grupos",
        "Habitual del grupo", "Group regular",
        "Participa en 5 sesiones de grupo.",
        "Take part in 5 group sessions.",
        "Users", "group_sessions", 5, 75,
    ),
    Achievement(
        "grupo_15", "grupos",
        "Pilar de la comunidad", "Community pillar",
        "Participa en 15 sesiones de grupo.",
        "Take part in 15 group sessions.",
        "Users", "group_sessions", 15, 150,
    ),
]

_BY_METRIC: Final[dict[str, list[Achievement]]] = {}
for _a in CATALOG:
    _BY_METRIC.setdefault(_a.metric, []).append(_a)


class AchievementsService:
    """Evalúa y otorga logros. Idempotente: nunca desbloquea dos veces uno."""

    async def _medir(self, repo: AchievementsRepository, user_id: str, metric: str) -> int:
        """Devuelve el valor actual de una métrica para un usuario."""
        if metric == "sessions_completed":
            stats = await repo.get_user_stats(user_id)
            return stats.sessions_completed if stats else 0
        if metric == "streak_max":
            stats = await repo.get_user_stats(user_id)
            return stats.streak_max if stats else 0
        if metric == "friends_count":
            return await repo.count_friends(user_id)
        if metric == "plants_maxed":
            return await repo.count_maxed_plants(user_id, MAX_PLANT_PHASE)
        if metric == "garden_minutes":
            return await repo.sum_garden_minutes(user_id)
        if metric == "shop_purchases":
            return await repo.count_shop_purchases(user_id)
        if metric == "group_sessions":
            return await repo.get_group_sessions_started(user_id)
        if metric == "profile_complete":
            user_repo = UserRepository(repo.db)
            user = await user_repo.get_by_id(user_id)
            if not user:
                return 0
            tiene_avatar = bool(user.avatar_url)
            tiene_bio = bool(user.bio and user.bio.strip())
            return 1 if (tiene_avatar and tiene_bio) else 0
        logger.warning("Métrica de logro desconocida: %s", metric)
        return 0

    async def evaluate_for_user(self, user_id: str, metrics: set[str] | None = None) -> list[str]:
        """
        Revisa los logros del usuario y desbloquea los que ya se cumplen.

        `metrics`, si se da, limita la revisión a esas métricas (para no
        recalcular las 7 cada vez que se dispara un evento que solo afecta
        una). Devuelve los ids de los logros recién desbloqueados.
        """
        nuevos: list[str] = []
        async with AsyncSessionLocal() as db:
            repo = AchievementsRepository(db)
            ya_tiene = await repo.get_unlocked_ids(user_id)

            metricas_a_revisar = metrics if metrics is not None else set(_BY_METRIC.keys())
            valores_cache: dict[str, int] = {}

            for metrica in metricas_a_revisar:
                candidatos = _BY_METRIC.get(metrica, [])
                pendientes = [c for c in candidatos if c.id not in ya_tiene]
                if not pendientes:
                    continue
                if metrica not in valores_cache:
                    valores_cache[metrica] = await self._medir(repo, user_id, metrica)
                valor = valores_cache[metrica]
                for logro in pendientes:
                    if valor >= logro.target:
                        await repo.unlock(user_id, logro.id)
                        nuevos.append(logro.id)

            if nuevos:
                await db.commit()
                logger.info("Usuario %s desbloqueó logros: %s", user_id, nuevos)
        return nuevos

    async def get_summary(self, user_id: str) -> dict[str, Any]:
        """Catálogo completo con el progreso de un usuario, para el frontend."""
        async with AsyncSessionLocal() as db:
            repo = AchievementsRepository(db)
            desbloqueados = await repo.get_unlocked_ids(user_id)

            valores_cache: dict[str, int] = {}
            items = []
            for logro in CATALOG:
                if logro.metric not in valores_cache:
                    valores_cache[logro.metric] = await self._medir(repo, user_id, logro.metric)
                progreso = min(valores_cache[logro.metric], logro.target)
                items.append({
                    "id": logro.id,
                    "category": logro.category,
                    "name_es": logro.name_es,
                    "name_en": logro.name_en,
                    "description_es": logro.description_es,
                    "description_en": logro.description_en,
                    "icon": logro.icon,
                    "reward_fc": logro.reward_fc,
                    "target": logro.target,
                    "progress": progreso,
                    "unlocked": logro.id in desbloqueados,
                    "unlocked_at": None,
                })

            return {
                "total": len(CATALOG),
                "unlocked": len(desbloqueados),
                "achievements": items,
            }

    # ── manejadores del EventBus ─────────────────────────────────────────

    async def on_session_completed(self, payload: dict[str, Any]) -> None:
        for user_id in (payload.get("user_a_id"), payload.get("user_b_id")):
            if user_id:
                await self.evaluate_for_user(
                    user_id, metrics={"sessions_completed", "streak_max"}
                )

    async def on_group_session_started(self, payload: dict[str, Any]) -> None:
        participantes = payload.get("participants") or []
        for user_id in participantes:
            async with AsyncSessionLocal() as db:
                await AchievementsRepository(db).increment_group_sessions(user_id)
                await db.commit()
            await self.evaluate_for_user(user_id, metrics={"group_sessions"})


achievements_service = AchievementsService()
