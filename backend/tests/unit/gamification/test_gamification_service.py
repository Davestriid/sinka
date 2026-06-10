"""
Tests unitarios para las funciones puras de GamificationService.
Sin dependencias de BD ni Redis — ciclo TDD RED → GREEN → REFACTOR.
"""
from datetime import date, timedelta

import pytest

from modules.gamification.services.gamification_service import (
    FC_FIRST_SESSION_DAY,
    FC_MAJESTIC_PLANT,
    FC_SESSION_COMPLETE,
    XP_PER_POMODORO,
    compute_fc_earned,
    compute_streak,
    compute_xp_earned,
    compute_xp_progress,
    resolve_level,
    xp_for_level,
)


# ── xp_for_level ──────────────────────────────────────────────────────────────

class TestXpForLevel:
    def test_level_1_starts_at_0(self):
        xmin, xmax = xp_for_level(1)
        assert xmin == 0
        assert xmax == 200

    def test_level_5_range(self):
        xmin, xmax = xp_for_level(5)
        assert xmin == 2_500
        assert xmax == 5_000

    def test_level_10_has_no_upper_bound(self):
        xmin, xmax = xp_for_level(10)
        assert xmin == 60_000
        assert xmax is None

    def test_unknown_level_returns_max_thresholds(self):
        xmin, xmax = xp_for_level(99)
        assert xmin == 60_000
        assert xmax is None


# ── resolve_level ─────────────────────────────────────────────────────────────

class TestResolveLevel:
    def test_zero_xp_is_level_1(self):
        assert resolve_level(0) == 1

    def test_just_below_level_2_is_still_level_1(self):
        assert resolve_level(199) == 1

    def test_exactly_200_xp_is_level_2(self):
        assert resolve_level(200) == 2

    def test_mid_level_3(self):
        assert resolve_level(750) == 3

    def test_exactly_60000_xp_is_level_10(self):
        assert resolve_level(60_000) == 10

    def test_very_high_xp_stays_at_level_10(self):
        assert resolve_level(999_999) == 10

    def test_level_boundaries(self):
        thresholds = [
            (0,       1),
            (200,     2),
            (500,     3),
            (1_000,   4),
            (2_500,   5),
            (5_000,   6),
            (10_000,  7),
            (20_000,  8),
            (35_000,  9),
            (60_000, 10),
        ]
        for xp, expected_level in thresholds:
            assert resolve_level(xp) == expected_level, f"XP={xp} debería ser nivel {expected_level}"


# ── compute_xp_progress ───────────────────────────────────────────────────────

class TestComputeXpProgress:
    def test_start_of_level_is_0_pct(self):
        xp_cl, xp_nl, pct = compute_xp_progress(0, 1)
        assert xp_cl == 0
        assert pct == 0.0

    def test_halfway_through_level(self):
        # Nivel 1: 0–200. Con 100 XP estamos al 50%
        xp_cl, xp_nl, pct = compute_xp_progress(100, 1)
        assert xp_cl == 100
        assert pct == pytest.approx(0.5)

    def test_level_10_is_always_full(self):
        xp_cl, xp_nl, pct = compute_xp_progress(60_000, 10)
        assert pct == 1.0
        assert xp_nl == 0


# ── compute_streak ────────────────────────────────────────────────────────────

class TestComputeStreak:
    TODAY = date.today()
    YESTERDAY = TODAY - timedelta(days=1)
    TWO_DAYS_AGO = TODAY - timedelta(days=2)

    def test_first_session_ever_starts_streak_at_1(self):
        new_streak, inc, broken = compute_streak(None, 0, self.TODAY)
        assert new_streak == 1
        assert inc is True
        assert broken is False

    def test_session_same_day_keeps_streak(self):
        new_streak, inc, broken = compute_streak(self.TODAY, 5, self.TODAY)
        assert new_streak == 5
        assert inc is False
        assert broken is False

    def test_consecutive_day_increments_streak(self):
        new_streak, inc, broken = compute_streak(self.YESTERDAY, 4, self.TODAY)
        assert new_streak == 5
        assert inc is True
        assert broken is False

    def test_two_day_gap_resets_streak_to_1(self):
        new_streak, inc, broken = compute_streak(self.TWO_DAYS_AGO, 10, self.TODAY)
        assert new_streak == 1
        assert inc is True
        assert broken is True

    def test_long_gap_also_resets(self):
        old_date = self.TODAY - timedelta(days=30)
        new_streak, inc, broken = compute_streak(old_date, 30, self.TODAY)
        assert new_streak == 1
        assert broken is True


# ── compute_xp_earned ─────────────────────────────────────────────────────────

class TestComputeXpEarned:
    def test_single_pomodoro_no_streak(self):
        # streak=1 → bonus=0 → 1 * 100 = 100
        assert compute_xp_earned(1, 1) == 100

    def test_multiple_pomodoros_no_streak(self):
        assert compute_xp_earned(4, 1) == 400

    def test_streak_2_gives_25_percent_bonus(self):
        # streak=2 → bonus=0.25 → 1 * 100 * 1.25 = 125
        assert compute_xp_earned(1, 2) == 125

    def test_streak_5_gives_100_percent_bonus_cap(self):
        # streak=5 → bonus=1.0 (cap) → 1 * 100 * 2.0 = 200
        assert compute_xp_earned(1, 5) == 200

    def test_streak_above_5_still_capped_at_100_percent(self):
        assert compute_xp_earned(1, 10) == compute_xp_earned(1, 5)

    def test_zero_pomodoros_gives_zero_xp(self):
        assert compute_xp_earned(0, 3) == 0

    def test_xp_is_integer(self):
        result = compute_xp_earned(3, 3)
        assert isinstance(result, int)


# ── compute_fc_earned ─────────────────────────────────────────────────────────

class TestComputeFcEarned:
    def test_base_fc_always_awarded(self):
        fc = compute_fc_earned(False, "seedling")
        assert fc == FC_SESSION_COMPLETE

    def test_majestic_plant_adds_bonus(self):
        fc = compute_fc_earned(False, "majestic")
        assert fc == FC_SESSION_COMPLETE + FC_MAJESTIC_PLANT

    def test_first_session_of_day_adds_bonus(self):
        fc = compute_fc_earned(True, "seedling")
        assert fc == FC_SESSION_COMPLETE + FC_FIRST_SESSION_DAY

    def test_majestic_and_first_session_stacks(self):
        fc = compute_fc_earned(True, "majestic")
        assert fc == FC_SESSION_COMPLETE + FC_MAJESTIC_PLANT + FC_FIRST_SESSION_DAY

    def test_non_majestic_stages_get_no_plant_bonus(self):
        for stage in ("sprout", "growing", "blooming", "withered", ""):
            fc = compute_fc_earned(False, stage)
            assert fc == FC_SESSION_COMPLETE, f"Etapa '{stage}' no debería dar bonus"

    def test_fc_constants_have_expected_values(self):
        assert FC_SESSION_COMPLETE == 15
        assert FC_MAJESTIC_PLANT == 50
        assert FC_FIRST_SESSION_DAY == 5
