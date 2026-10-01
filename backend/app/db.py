"""SQLAlchemy engine, session factory en Base."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

if settings.is_sqlite:
    # check_same_thread is alleen voor SQLite; PostgreSQL accepteert dit niet.
    _engine_kwargs = {"connect_args": {"check_same_thread": False}}
else:
    # PostgreSQL (Neon): verbindingen controleren/vernieuwen (Neon slaapt na 5 min) en
    # geen server-side prepared statements, want die verstoren de connection pooler.
    _engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": {"prepare_threshold": None},
    }

engine = create_engine(settings.database_url, future=True, **_engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency die een DB-sessie levert en netjes sluit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _run_light_migrations() -> None:
    """Voeg ontbrekende kolommen toe aan bestaande tabellen (SQLite, geen Alembic).

    create_all() maakt geen nieuwe kolommen aan op tabellen die al bestaan, dus
    nieuwe velden worden hier idempotent toegevoegd.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "zorggroepen" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("zorggroepen")}
    if "color" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE zorggroepen ADD COLUMN color VARCHAR(20) NOT NULL DEFAULT ''"))
    if "has_contract" not in columns:
        from .services.seed_constants import BESLISBOOM_ROUTE_BY_ZORGGROEP_2026
        from .services.validation_service import route_key

        default = "1" if settings.is_sqlite else "TRUE"
        no_contract = {key for key, route in BESLISBOOM_ROUTE_BY_ZORGGROEP_2026 if route == "no_contract"}
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE zorggroepen ADD COLUMN has_contract BOOLEAN NOT NULL DEFAULT {default}"))
            # Eenmalig (alleen bij het aanmaken van de kolom): zorggroepen die in de
            # beslisboom als 'geen contract' staan op nee zetten. Latere admin-keuzes blijven.
            for row_id, name in conn.execute(text("SELECT id, name FROM zorggroepen")).all():
                if route_key(name) in no_contract:
                    conn.execute(text("UPDATE zorggroepen SET has_contract = :v WHERE id = :id"), {"v": False, "id": row_id})


def init_db() -> None:
    """Maak tabellen aan als ze nog niet bestaan en draai lichte migraties."""
    from . import models  # noqa: F401  (zorgt dat modellen geregistreerd zijn)

    Base.metadata.create_all(bind=engine)
    _run_light_migrations()
