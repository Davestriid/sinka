"""Esquemas de entrada y salida de citas programadas."""
from datetime import datetime

from pydantic import BaseModel, field_validator

from modules.scheduling.services.scheduling_service import DURACIONES_VALIDAS


class PersonBrief(BaseModel):
    id:         str
    username:   str
    alias:      str | None = None
    avatar_url: str | None = None


class GroupBrief(BaseModel):
    id:    str
    name:  str
    topic: str


class AppointmentResponse(BaseModel):
    id:               str
    title:            str | None = None
    topic:            str
    scheduled_for:    datetime
    duration_minutes: int
    status:           str
    is_group:         bool
    is_creator:       bool
    creator:          PersonBrief | None = None
    invitee:          PersonBrief | None = None
    other_party:      PersonBrief | None = None
    group:            GroupBrief | None = None
    session_id:       str | None = None
    created_at:       datetime | None = None


class AgendaResponse(BaseModel):
    appointments: list[AppointmentResponse]
    today:        list[AppointmentResponse]
    remaining:    int
    daily_limit:  int


class CreateAppointmentRequest(BaseModel):
    scheduled_for:    datetime
    topic:            str
    duration_minutes: int = 25
    invitee_id:       str | None = None
    group_id:         str | None = None
    title:            str | None = None

    @field_validator("duration_minutes")
    @classmethod
    def duracion_valida(cls, v: int) -> int:
        if v not in DURACIONES_VALIDAS:
            raise ValueError(f"La duracion debe ser una de {DURACIONES_VALIDAS} minutos.")
        return v

    @field_validator("title")
    @classmethod
    def titulo_corto(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v[:80] or None
