"""
PomodoroTimer: temporizador Pomodoro cooperativo del lado del servidor.

Un timer por sesion, sin IO.  El SessionService lo crea y llama tick()
cada segundo desde su game-loop.

Ciclo: 25 min enfoque → 5 min descanso (hasta MAX_ROUNDS rondas de enfoque).
"""

# ── Constantes ────────────────────────────────────────────────────────────────
FOCUS_SECONDS: int = 25 * 60   # 1500 s
BREAK_SECONDS: int  =  5 * 60  # 300 s
MAX_ROUNDS:    int  = 4        # 4 ciclos = ~2 h de sesion maxima


# ── Clase ─────────────────────────────────────────────────────────────────────

class PomodoroTimer:
    """
    Temporizador de Pomodoro con estado interno.
    Se crea una instancia por sesion activa.
    """

    def __init__(self) -> None:
        self.phase:     str  = "focus"  # "focus" | "break"
        self.elapsed:   int  = 0        # segundos transcurridos en la fase actual
        self.round:     int  = 1        # numero de ronda de enfoque
        self.completed: bool = False    # True cuando se terminan todos los rounds

    # -- Publico ---------------------------------------------------------------

    def tick(self) -> dict:
        """
        Avanza el timer un segundo.

        Returns:
            Estado actualizado del timer (misma estructura siempre).
        """
        if self.completed:
            return self._snapshot(phase_completed=False)

        self.elapsed += 1
        duration = FOCUS_SECONDS if self.phase == "focus" else BREAK_SECONDS
        phase_completed = self.elapsed >= duration

        if phase_completed:
            self.elapsed = 0
            if self.phase == "focus":
                self.phase = "break"
            else:
                self.round += 1
                self.phase = "focus"
                if self.round > MAX_ROUNDS:
                    self.completed = True

        return self._snapshot(phase_completed=phase_completed)

    def snapshot(self) -> dict:
        """Estado actual sin avanzar."""
        return self._snapshot(phase_completed=False)

    # -- Privado ---------------------------------------------------------------

    def _snapshot(self, *, phase_completed: bool) -> dict:
        duration = FOCUS_SECONDS if self.phase == "focus" else BREAK_SECONDS
        remaining = max(0, duration - self.elapsed)
        return {
            "phase":         self.phase,
            "elapsed":       self.elapsed,
            "remaining":     remaining,
            "round":         self.round,
            "max_rounds":    MAX_ROUNDS,
            "phase_completed": phase_completed,
            "all_completed":   self.completed,
        }
