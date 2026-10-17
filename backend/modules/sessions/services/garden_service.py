"""
GardenService: motor de la planta cooperativa.

Logica pura (sin IO).  El SessionService la llama cada segundo
desde el game-loop de la sesion.

Antes la planta perdia HP cuando el detector de actividad del navegador
(mousemove/keydown/tab visible) marcaba a alguien como "inactivo" — bastaba
cambiar de pestaña un rato para que la planta se marchitara y la sesion
terminara con menos XP/FocusCoins, aunque el Pomodoro siguiera corriendo
normal. Eso penalizaba a quien de verdad estaba trabajando (leyendo
documentacion en otra pestaña, por ejemplo) solo por no mover el mouse.
Ahora la planta crece sola con el solo hecho de completar la sesion juntos,
sin vigilar actividad.

Estadios (por HP):
  seed      0  – 20
  sprout   20  – 40
  growing  40  – 60
  bloom    60  – 85
  majestic 85  – 100
"""

# ── Constantes ────────────────────────────────────────────────────────────────
INITIAL_HP: float = 50.0          # Empieza en "growing"
HP_GAIN_PER_SECOND: float = 0.25  # Crece mientras la sesion sigue en curso

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

    def tick(self, plant: dict) -> dict:
        """
        Avanza el estado de la planta un segundo. Crece mientras la sesion
        sigue corriendo — ya no depende de si cada usuario "esta activo".

        Args:
            plant: Dict con al menos {"hp": float, "stage": str}

        Returns:
            Nuevo dict con hp/stage actualizados.
        """
        hp: float = min(100.0, round(plant["hp"] + HP_GAIN_PER_SECOND, 2))
        stage = self._resolve_stage(hp)

        return {
            **plant,
            "hp": hp,
            "stage": stage,
            "emoji": STAGE_EMOJI[stage],
            "both_focused": True,
        }

    def initial_plant(self) -> dict:
        """Estado inicial de la planta al comenzar la sesion."""
        hp = INITIAL_HP
        stage = self._resolve_stage(hp)
        return {
            "hp": hp,
            "stage": stage,
            "emoji": STAGE_EMOJI[stage],
            "both_focused": True,
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
