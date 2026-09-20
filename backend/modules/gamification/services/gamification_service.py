"""
GamificationService: lógica de XP, niveles, rachas y FocusCoins.

Sistema de XP:
  - 100 XP base por cada pomodoro completado en la sesión
  - Bonus de racha: +25 % por día de racha acumulada, tope 100 %
    → racha 1: 100 % | racha 2: 125 % | racha 5: 200 % | racha 5+: 200 %

Sistema de FocusCoins (FC):
  - +15 FC por sesión completada (timer_completed)
  - +50 FC si la planta llegó al estado "majestic" al finalizar
  - +5 FC si es la primera sesión del día (bonus de primera sesión)

Tabla de niveles (XP total acumulado):
  Nivel 1:  0 – 199       Nivel 6:  5 000 – 9 999
  Nivel 2:  200 – 499     Nivel 7:  10 000 – 19 999
  Nivel 3:  500 – 999     Nivel 8:  20 000 – 34 999
  Nivel 4:  1 000 – 2 499 Nivel 9:  35 000 – 59 999
  Nivel 5:  2 500 – 4 999 Nivel 10: 60 000+
"""
import logging
from datetime import date
from typing import Any

from core.database import AsyncSessionLocal
from modules.gamification.models import SessionPenalty
from modules.gamification.services import trust_service
from modules.gamification.repositories.gamification_repository import GamificationRepository
from modules.gamification.schemas.gamification import XPAwardResult

logger = logging.getLogger(__name__)

# ── Tabla de niveles: (nivel, xp_min, xp_max_exclusive) ─────────────────────
LEVEL_THRESHOLDS: list[tuple[int, int, int | None]] = [
    (1,       0,       200),
    (2,     200,       500),
    (3,     500,     1_000),
    (4,   1_000,     2_500),
    (5,   2_500,     5_000),
    (6,   5_000,    10_000),
    (7,  10_000,    20_000),
    (8,  20_000,    35_000),
    (9,  35_000,    60_000),
    (10, 60_000,      None),
]

XP_PER_POMODORO:   int   = 100
STREAK_BONUS_RATE: float = 0.25
STREAK_BONUS_CAP:  float = 1.00

# FocusCoins por evento
FC_SESSION_COMPLETE:   int = 15
FC_MAJESTIC_PLANT:     int = 50
FC_FIRST_SESSION_DAY:  int = 5


# ── Funciones puras ──────────────────────────────────────────────────────────

def xp_for_level(level: int) -> tuple[int, int | None]:
    for lvl, xmin, xmax in LEVEL_THRESHOLDS:
        if lvl == level:
            return xmin, xmax
    return LEVEL_THRESHOLDS[-1][1], None


def resolve_level(xp_total: int) -> int:
    level = 1
    for lvl, xmin, xmax in LEVEL_THRESHOLDS:
        if xmax is None or xp_total < xmax:
            level = lvl
            break
        level = lvl
    return level


def compute_xp_progress(xp_total: int, level: int) -> tuple[int, int, float]:
    xmin, xmax = xp_for_level(level)
    if xmax is None:
        return xp_total - xmin, 0, 1.0
    span          = xmax - xmin
    xp_in_level   = xp_total - xmin
    xp_next_level = span
    pct           = min(1.0, xp_in_level / span) if span > 0 else 1.0
    return xp_in_level, xp_next_level, round(pct, 4)


def compute_streak(
    last_date: date | None,
    current_streak: int,
    today: date,
) -> tuple[int, bool, bool]:
    """Devuelve (nueva_racha, racha_incrementada, racha_rota)."""
    if last_date is None:
        return 1, True, False
    delta = (today - last_date).days
    if delta == 0:
        return current_streak, False, False
    elif delta == 1:
        return current_streak + 1, True, False
    else:
        return 1, True, True


def compute_xp_earned(pomodoros: int, streak: int) -> int:
    bonus      = min(STREAK_BONUS_RATE * (streak - 1), STREAK_BONUS_CAP)
    multiplier = 1.0 + bonus
    return int(XP_PER_POMODORO * pomodoros * multiplier)


def compute_fc_earned(
    is_first_session_today: bool,
    plant_stage: str,
) -> int:
    """Calcula los FocusCoins a otorgar por una sesión completada."""
    fc = FC_SESSION_COMPLETE
    if plant_stage == "majestic":
        fc += FC_MAJESTIC_PLANT
    if is_first_session_today:
        fc += FC_FIRST_SESSION_DAY
    return fc


# ── Servicio ─────────────────────────────────────────────────────────────────

class GamificationService:
    """Singleton — maneja toda la lógica de gamificación."""

    # ── Handler del EventBus ─────────────────────────────────────────────────

    async def on_session_completed(self, payload: dict[str, Any]) -> None:
        """
        Escucha 'session.completed' y actualiza stats de ambos usuarios.
        payload esperado:
          {
            "session_id":       str,
            "user_a_id":        str,
            "user_b_id":        str,
            "rounds_completed": int,
            "reason":           str,   # "timer_completed" | "plant_died" | "user_left"
            "plant_stage":      str,   # etapa final de la planta (opcional)
          }
        Solo se otorga XP/FC si reason == "timer_completed".
        """
        reason = payload.get("reason", "")
        user_ids = [payload["user_a_id"], payload["user_b_id"]]

        if reason != "timer_completed":
            logger.info(
                "GamificationService: sesion %s finalizada por '%s' — sin XP",
                payload.get("session_id"), reason,
            )
            # Quien abandona pierde confianza. No se otorga XP, pero tampoco se
            # ignora el hecho: dejar al companero solo tiene consecuencia.
            if reason == "user_left":
                await self._penalizar_abandono(payload)
            return

        rounds      = int(payload.get("rounds_completed", 1))
        plant_stage = payload.get("plant_stage", "")

        async with AsyncSessionLocal() as db:
            repo = GamificationRepository(db)
            for user_id in user_ids:
                try:
                    await self._award_xp_and_fc(repo, user_id, rounds, plant_stage)
                except Exception as exc:
                    logger.error(
                        "GamificationService: error otorgando recompensas a %s: %s",
                        user_id, exc,
                    )

    async def _penalizar_abandono(self, payload: dict[str, Any]) -> None:
        """
        Baja el puntaje de confianza de quien se fue y lo sube al que se quedo.

        quien_salio llega en el payload. Si no viene, no se penaliza a nadie:
        es preferible dejar pasar un abandono que castigar al inocente.
        """
        quien_salio = payload.get("left_by")
        if not quien_salio:
            return

        severidad = payload.get("penalty_severity", "normal")
        minutos   = int(payload.get("minutes_elapsed", 0) or 0)
        session_id = payload.get("session_id")

        companero = (
            payload["user_b_id"] if quien_salio == payload["user_a_id"]
            else payload["user_a_id"]
        )

        async with AsyncSessionLocal() as db:
            repo = GamificationRepository(db)
            try:
                stats = await repo.get_or_create(quien_salio)
                resultado = trust_service.penalizar_abandono(
                    stats.trust_score, severidad, minutos
                )
                stats.trust_score = resultado.score
                stats.sessions_abandoned += 1

                db.add(SessionPenalty(
                    user_id=quien_salio,
                    session_id=session_id,
                    reason="abandono_de_sesion",
                    severity=severidad,
                    points=resultado.delta,
                    minutes_elapsed=minutos,
                ))

                # Quien se quedo no tiene la culpa: recupera un poco de confianza
                stats_companero = await repo.get_or_create(companero)
                recuperacion = trust_service.recuperar_por_sesion(stats_companero.trust_score)
                stats_companero.trust_score = recuperacion.score

                await db.commit()
                logger.info(
                    "Confianza: %s abandono la sesion %s (%+d puntos, queda en %d)",
                    quien_salio, session_id, resultado.delta, resultado.score,
                )
            except Exception:
                logger.exception("No se pudo aplicar la penalizacion de confianza")

    # ── Lógica de negocio ─────────────────────────────────────────────────────

    async def _award_xp_and_fc(
        self,
        repo: GamificationRepository,
        user_id: str,
        rounds_completed: int,
        plant_stage: str,
    ) -> XPAwardResult:
        today  = date.today()
        stats  = await repo.get_or_create(user_id)

        level_before  = stats.level
        streak_before = stats.streak_current

        # Racha
        new_streak, streak_inc, streak_broken = compute_streak(
            stats.last_session_date, stats.streak_current, today
        )

        # XP
        xp_earned = compute_xp_earned(rounds_completed, new_streak)
        new_xp    = stats.xp_total + xp_earned
        new_level = resolve_level(new_xp)

        # FocusCoins
        is_first_today = (stats.last_session_date != today)
        fc_earned = compute_fc_earned(is_first_today, plant_stage)

        # Persistir
        stats.xp_total            = new_xp
        stats.level               = new_level
        stats.streak_current      = new_streak
        stats.streak_max          = max(stats.streak_max, new_streak)
        stats.sessions_completed  += 1
        stats.pomodoros_completed += rounds_completed
        stats.focus_coins         += fc_earned
        stats.last_session_date   = today

        await repo.save(stats)

        result = XPAwardResult(
            xp_earned        = xp_earned,
            xp_total         = new_xp,
            level_before     = level_before,
            level_after      = new_level,
            leveled_up       = new_level > level_before,
            streak_before    = streak_before,
            streak_after     = new_streak,
            streak_increased = streak_inc,
            streak_broken    = streak_broken,
            fc_earned        = fc_earned,
            focus_coins      = stats.focus_coins,
        )
        logger.info(
            "GamificationService: usuario %s +%d XP +%d FC (racha %d→%d, nivel %d→%d)",
            user_id, xp_earned, fc_earned,
            streak_before, new_streak, level_before, new_level,
        )
        return result

    # ── Consultas públicas ────────────────────────────────────────────────────

    async def get_stats(self, user_id: str, username: str) -> dict:
        """Devuelve el dict con todas las stats para UserStatsResponse."""
        async with AsyncSessionLocal() as db:
            repo  = GamificationRepository(db)
            stats = await repo.get_or_create(user_id)
            await db.commit()

        xp_cl, xp_nl, pct = compute_xp_progress(stats.xp_total, stats.level)
        return {
            "user_id":             stats.user_id,
            "username":            username,
            "xp_total":            stats.xp_total,
            "level":               stats.level,
            "xp_current_level":    xp_cl,
            "xp_next_level":       xp_nl,
            "xp_progress_pct":     pct,
            "streak_current":      stats.streak_current,
            "streak_max":          stats.streak_max,
            "sessions_completed":  stats.sessions_completed,
            "pomodoros_completed": stats.pomodoros_completed,
            "focus_coins":         stats.focus_coins,
            "last_session_date":   stats.last_session_date,
        }


gamification_service = GamificationService()
