"""0018 — session_started_at en appointments

Guarda cuando se creo la sala real (primer "Unirse") detras de una cita, para
que el service pueda vencerla si pasan mas de 15 minutos sin que la segunda
persona se una (ver VENTANA_SALA_ESPERA en scheduling_service.py).

Revision ID: 0018
Revises: 0017
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("session_started_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "session_started_at")
