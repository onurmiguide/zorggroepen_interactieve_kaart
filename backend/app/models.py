"""SQLAlchemy ORM-modellen voor het admin CRUD-systeem."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# Rollen, oplopend in rechten.
ROLE_VIEWER = "viewer"
ROLE_EDITOR = "editor"
ROLE_ADMIN = "admin"
ROLE_SUPER_ADMIN = "super_admin"
VALID_ROLES = (ROLE_VIEWER, ROLE_EDITOR, ROLE_ADMIN, ROLE_SUPER_ADMIN)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), default=ROLE_EDITOR, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Zorggroep(Base, TimestampMixin):
    __tablename__ = "zorggroepen"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    regio: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    website: Mapped[str] = mapped_column(String(400), default="", nullable=False)
    # Optionele handmatige kleur (#rrggbb). Leeg = automatische kleur uit de naam.
    color: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    locations: Mapped[list["ZorggroepLocation"]] = relationship(
        back_populates="zorggroep",
        cascade="all, delete-orphan",
        order_by="ZorggroepLocation.city_name",
    )


class ZorggroepLocation(Base):
    __tablename__ = "zorggroep_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zorggroep_id: Mapped[int] = mapped_column(
        ForeignKey("zorggroepen.id", ondelete="CASCADE"), index=True, nullable=False
    )
    city_name: Mapped[str] = mapped_column(String(200), nullable=False)
    gemeente_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    zorggroep: Mapped[Zorggroep] = relationship(back_populates="locations")


class Zorgverzekeraar(Base, TimestampMixin):
    __tablename__ = "zorgverzekeraars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    concern_key: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    # Aliases als JSON-array opgeslagen in TEXT.
    aliases: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Facturatiestroom(Base, TimestampMixin):
    __tablename__ = "facturatiestromen"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    # 'stroom' = Stroom 1-5, 'module' = facturatiemodule template.
    kind: Mapped[str] = mapped_column(String(20), default="stroom", nullable=False)
    module_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    prestatiecode: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ContractRule(Base, TimestampMixin):
    __tablename__ = "contract_rules"
    __table_args__ = (
        UniqueConstraint(
            "zorggroep_id",
            "zorgverzekeraar_id",
            "facturatiestroom_id",
            name="uq_contract_combo",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zorggroep_id: Mapped[int] = mapped_column(
        ForeignKey("zorggroepen.id"), index=True, nullable=False
    )
    zorgverzekeraar_id: Mapped[int | None] = mapped_column(
        ForeignKey("zorgverzekeraars.id"), index=True, nullable=True
    )
    facturatiestroom_id: Mapped[int | None] = mapped_column(
        ForeignKey("facturatiestromen.id"), index=True, nullable=True
    )
    contract_status: Mapped[str] = mapped_column(String(60), default="gecontracteerd", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    valid_from: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    valid_to: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    zorggroep: Mapped["Zorggroep"] = relationship()
    zorgverzekeraar: Mapped["Zorgverzekeraar | None"] = relationship()
    facturatiestroom: Mapped["Facturatiestroom | None"] = relationship()


class RoutingRule(Base, TimestampMixin):
    __tablename__ = "routing_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zorggroep_id: Mapped[int | None] = mapped_column(
        ForeignKey("zorggroepen.id"), index=True, nullable=True
    )
    # Genormaliseerde zorggroep-sleutel (zoals in BESLISBOOM_ROUTE_BY_ZORGGROEP_2026).
    zorggroep_key: Mapped[str] = mapped_column(String(200), default="", index=True, nullable=False)
    insurer_concern_key: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    route_type: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    module_name: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PostcodeOverride(Base, TimestampMixin):
    """Exacte PC6-uitzondering (exact_postcode6_overrides)."""

    __tablename__ = "postcode_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    postcode6: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    zorggroep: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    source_sheet: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    insurer_concerns: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class LocationPostcodeOverride(Base, TimestampMixin):
    """Locatie/woonplaats PC6-uitzondering (location_postcode6_overrides)."""

    __tablename__ = "location_postcode_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    postcode6: Mapped[str] = mapped_column(String(8), unique=True, index=True, nullable=False)
    woonplaats: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    gemeente: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    zorggroep: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    source: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PostcodeRangeOverride(Base, TimestampMixin):
    """PC4-range-uitzondering (postcode4_range_overrides)."""

    __tablename__ = "postcode_range_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_pc4: Mapped[str] = mapped_column(String(4), index=True, nullable=False)
    end_pc4: Mapped[str] = mapped_column(String(4), index=True, nullable=False)
    zorggroep: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    source_sheet: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    insurer_concerns: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    actor_email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    actor_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    action: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    entity_id: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    old_value_json: Mapped[str] = mapped_column(Text, default="", nullable=False)
    new_value_json: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class AppMeta(Base):
    """Eenvoudige key/value tabel, o.a. voor data_version van de publieke kaart."""

    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
