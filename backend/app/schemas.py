"""Pydantic schemas voor request/response validatie."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import VALID_ROLES


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    role: str = "editor"
    is_active: bool = True

    def normalized_role(self) -> str:
        return self.role if self.role in VALID_ROLES else "editor"


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=200)
    role: str | None = None
    is_active: bool | None = None


# ---------- Zorggroep ----------
class LocationIn(BaseModel):
    city_name: str = Field(min_length=1, max_length=200)
    gemeente_name: str = ""
    notes: str = ""


class LocationOut(LocationIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ZorggroepBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    regio: str = ""
    website: str = ""
    color: str = ""
    is_active: bool = True


class ZorggroepCreate(ZorggroepBase):
    locations: list[LocationIn] = []


class ZorggroepUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    regio: str | None = None
    website: str | None = None
    color: str | None = None
    is_active: bool | None = None
    locations: list[LocationIn] | None = None


class ZorggroepOut(ZorggroepBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    locations: list[LocationOut] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Zorgverzekeraar ----------
class ZorgverzekeraarBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    concern_key: str = ""
    aliases: list[str] = []
    is_active: bool = True


class ZorgverzekeraarCreate(ZorgverzekeraarBase):
    pass


class ZorgverzekeraarUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    concern_key: str | None = None
    aliases: list[str] | None = None
    is_active: bool | None = None


class ZorgverzekeraarOut(ZorgverzekeraarBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Facturatiestroom / module ----------
class FacturatiestroomBase(BaseModel):
    code: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=300)
    kind: str = "stroom"
    module_name: str = ""
    prestatiecode: str = ""
    description: str = ""
    is_active: bool = True


class FacturatiestroomCreate(FacturatiestroomBase):
    pass


class FacturatiestroomUpdate(BaseModel):
    code: str | None = Field(default=None, max_length=120)
    label: str | None = Field(default=None, max_length=300)
    kind: str | None = None
    module_name: str | None = None
    prestatiecode: str | None = None
    description: str | None = None
    is_active: bool | None = None


class FacturatiestroomOut(FacturatiestroomBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Contractregels ----------
class ContractRuleBase(BaseModel):
    zorggroep_id: int
    zorgverzekeraar_id: int | None = None
    facturatiestroom_id: int | None = None
    contract_status: str = "gecontracteerd"
    notes: str = ""
    valid_from: str = ""
    valid_to: str = ""
    is_active: bool = True


class ContractRuleCreate(ContractRuleBase):
    pass


class ContractRuleUpdate(BaseModel):
    zorggroep_id: int | None = None
    zorgverzekeraar_id: int | None = None
    facturatiestroom_id: int | None = None
    contract_status: str | None = None
    notes: str | None = None
    valid_from: str | None = None
    valid_to: str | None = None
    is_active: bool | None = None


class ContractRuleOut(ContractRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    zorggroep_name: str | None = None
    zorgverzekeraar_name: str | None = None
    facturatiestroom_label: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Audit ----------
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actor_user_id: int | None = None
    actor_email: str
    actor_name: str
    action: str
    entity_type: str
    entity_id: str
    old_value_json: str
    new_value_json: str
    created_at: datetime


# ---------- Postcode overrides (exact PC6) ----------
class PostcodeOverrideBase(BaseModel):
    postcode6: str = Field(min_length=6, max_length=8)
    zorggroep: str = Field(min_length=1, max_length=200)
    source_sheet: str = ""
    note: str = ""
    insurer_concerns: list[str] = []
    is_active: bool = True


class PostcodeOverrideCreate(PostcodeOverrideBase):
    pass


class PostcodeOverrideUpdate(BaseModel):
    postcode6: str | None = Field(default=None, max_length=8)
    zorggroep: str | None = Field(default=None, max_length=200)
    source_sheet: str | None = None
    note: str | None = None
    insurer_concerns: list[str] | None = None
    is_active: bool | None = None


class PostcodeOverrideOut(PostcodeOverrideBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Location PC6 overrides ----------
class LocationOverrideBase(BaseModel):
    postcode6: str = Field(min_length=6, max_length=8)
    woonplaats: str = ""
    gemeente: str = ""
    zorggroep: str = Field(min_length=1, max_length=200)
    source: str = ""
    is_active: bool = True


class LocationOverrideCreate(LocationOverrideBase):
    pass


class LocationOverrideUpdate(BaseModel):
    postcode6: str | None = Field(default=None, max_length=8)
    woonplaats: str | None = None
    gemeente: str | None = None
    zorggroep: str | None = Field(default=None, max_length=200)
    source: str | None = None
    is_active: bool | None = None


class LocationOverrideOut(LocationOverrideBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- PC4 range overrides ----------
class RangeOverrideBase(BaseModel):
    start_pc4: str = Field(min_length=4, max_length=4)
    end_pc4: str = Field(min_length=4, max_length=4)
    zorggroep: str = Field(min_length=1, max_length=200)
    source_sheet: str = ""
    insurer_concerns: list[str] = []
    is_active: bool = True


class RangeOverrideCreate(RangeOverrideBase):
    pass


class RangeOverrideUpdate(BaseModel):
    start_pc4: str | None = Field(default=None, min_length=4, max_length=4)
    end_pc4: str | None = Field(default=None, min_length=4, max_length=4)
    zorggroep: str | None = Field(default=None, max_length=200)
    source_sheet: str | None = None
    insurer_concerns: list[str] | None = None
    is_active: bool | None = None


class RangeOverrideOut(RangeOverrideBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Generiek ----------
class MessageOut(BaseModel):
    detail: str
