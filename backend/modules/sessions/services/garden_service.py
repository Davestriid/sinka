"""
GardenService: motor de la planta cooperativa.

Logica pura (sin IO).  El SessionService la llama cada segundo
desde el game-loop de la sesion.

Estadios (por HP):
  seed      0  – 20
  sprout   20  – 40
  growing  40  – 60
  bloom    60  – 85
  majestic 85  – 100
"""

# ── Constantes ────────────────────────────────────────────────────────────────
INITIAL_HP: float = 50.0          # Empieza en "growing"
HP_GAIN_PER_SECOND: float = 0.25  # Ambos usuarios activos
HP_DECAY_PER_SECOND: float = 0.5  # Alguno inactivo / desconectado

STAGES: list[tuple[str, float, float]] = [
    ("seed",     0.0,  20.0),
    ("sprout",  20.0,  40.0),
    ("growing", 40.0,  60.0),
    ("bloom",   60.0,  85.0),
    ("majestic",85.0, 101.0),   # 101 para capturar hp == 100
]

# Emojis decorativos (frontend puede usarlos o los suyos propios)
STAGE_EMOJI: dict[str, str] = {
    "seed":     "\U0001F330",  # 🌰
    "sprout":   "\U0001F331",  # 🌱
    "growing":  "\U0001F33F",  # 🌿
    "bloom":    "\U0001F338",  # 🌸
    "majestic": "\U0001F333",  # 🌳
}


# ── Servicio ──────────────────────────────────────────────────────────────────

class GardenService:
    """
    Calcula el siguiente estado de la planta dado el estado de actividad
    de cada usuario.  Sin estado interno; trabaja sobre dicts inmutables.
    """

    # -- Publico ---------------------------------------------------------------

    def tick(
        self,
        plant: dict,
        user_a_active: bool,
        user_b_active: bool,
    ) -> dict:
        """
        Avanza el estado de la planta un segundo.

        Args:
            plant:          Dict con al menos {"hp": float, "stage": str, "both_focused": bool}
            user_a_active:  True si user_a tiene actividad reciente
            user_b_active:  True si user_b tiene actividad reciente

        Returns:
            Nuevo dict con hp/stage/both_focused actualizados.
        """
        both_focused = user_a_active and user_b_active
        hp: float = plant["hp"]

        if both_focused:
            hp = min(100.0, hp + HP_GAIN_PER_SECOND)
        else:
            hp = max(0.0, hp - HP_DECAY_PER_SECOND)

        hp = round(hp, 2)
        stage = self._resolve_stage(hp)

        return {
            **plant,
            "hp": hp,
            "stage": stage,
            "emoji": STAGE_EMOJI[stage],
            "both_focused": both_focused,
            "user_a_active": user_a_active,
            "user_b_active": user_b_active,
        }

    def initial_plant(self) -> dict:
        """Estado inicial de la planta al comenzar la sesion."""
        hp = INITIAL_HP
        stage = self._resolve_stage(hp)
        return {
            "hp": hp,
            "stage": stage,
            "emoji": STAGE_EMOJI[stage],
            "both_focused": False,
            "user_a_active": True,
            "user_b_active": True,
        }

    # -- Privado ---------------------------------------------------------------

    @staticmethod
    def _resolve_stage(hp: float) -> str:
        for stage, lo, hi in STAGES:
            if lo <= hp < hi:
                return stage
        return "majestic"


# Instancia compartida (sin estado, pero util para DI o tests)
garden_service = GardenService()
