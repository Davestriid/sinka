"""Esquemas de entrada y salida del modulo de grupos."""
from datetime import datetime

from pydantic import BaseModel, field_validator

from modules.groups.models import PRIVATE, PUBLIC


class MemberBrief(BaseModel):
    id:         str
    username:   str
    alias:      str | None = None
    avatar_url: str | None = None
    role:       str
    joined_at:  datetime | None = None


class GroupResponse(BaseModel):
    id:                    str
    name:                  str
    description:           str | None = None
    topic:                 str
    visibility:            str
    default_task:          str | None = None
    member_count:          int
    max_members:           int
    is_full:               bool
    open_to_strangers:     bool
    requires_screen_share: bool
    is_member:             bool
    is_owner:              bool
    my_role:               str | None = None
    created_at:            datetime | None = None
    invite_code:           str | None = None
    members:               list[MemberBrief] | None = None


class CreateGroupRequest(BaseModel):
    name:              str
    topic:             str
    visibility:        str = PUBLIC
    description:       str | None = None
    default_task:      str | None = None
    open_to_strangers: bool = False

    @field_validator("name")
    @classmethod
    def nombre_valido(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 60:
            raise ValueError("El nombre debe tener entre 3 y 60 caracteres.")
        return v

    @field_validator("visibility")
    @classmethod
    def visibilidad_valida(cls, v: str) -> str:
        if v not in (PUBLIC, PRIVATE):
            raise ValueError("La visibilidad debe ser 'public' o 'private'.")
        return v


class UpdateGroupRequest(BaseModel):
    name:              str | None = None
    description:       str | None = None
    topic:             str | None = None
    visibility:        str | None = None
    default_task:      str | None = None
    open_to_strangers: bool | None = None

    @field_validator("visibility")
    @classmethod
    def visibilidad_valida(cls, v: str | None) -> str | None:
        if v is not None and v not in (PUBLIC, PRIVATE):
            raise ValueError("La visibilidad debe ser 'public' o 'private'.")
        return v


class JoinByCodeRequest(BaseModel):
    code: str

    @field_validator("code")
    @classmethod
    def codigo_valido(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("El codigo no puede estar vacio.")
        return v


class InviteCodeResponse(BaseModel):
    invite_code: str
