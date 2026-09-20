"""Esquemas de entrada y salida del modulo social."""
from datetime import date, datetime

from pydantic import BaseModel, field_validator


class UserBrief(BaseModel):
    """Datos minimos de una persona para mostrarla en listas."""

    id:         str
    username:   str
    alias:      str | None = None
    avatar_url: str | None = None


class PlantBrief(BaseModel):
    """Resumen de la planta que se muestra junto a cada amigo."""

    phase:             int
    phase_name:        str
    emoji:             str
    sessions_together: int


class FriendResponse(BaseModel):
    friendship_id: str
    user:          UserBrief
    since:         datetime | None = None
    plant:         PlantBrief | None = None


class RequestResponse(BaseModel):
    friendship_id: str
    user:          UserBrief
    direction:     str          # "incoming" | "outgoing"
    created_at:    datetime | None = None


class RequestsResponse(BaseModel):
    incoming:    list[RequestResponse]
    outgoing:    list[RequestResponse]
    remaining:   int            # solicitudes que le quedan hoy
    daily_limit: int


class PlantResponse(BaseModel):
    friendship_id:     str
    friend:            UserBrief
    name:              str | None = None
    phase:             int
    phase_name:        str
    phase_label:       str
    emoji:             str
    nourishment:       float
    next_phase_cost:   int
    progress_pct:      float
    is_max_phase:      bool
    sessions_together: int
    minutes_together:  int
    hours_together:    float
    last_watered_on:   date | None = None
    since:             datetime | None = None


class GardenResponse(BaseModel):
    plants: list[PlantResponse]
    total:  int


class RenamePlantRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def nombre_valido(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 60:
            raise ValueError("El nombre no puede superar los 60 caracteres.")
        return v
