"""SQLAlchemy engine, session factory en Base."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    # check_same_thread is alleen voor SQLite; PostgreSQL accepteert dit niet.
    connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    pool_pre_ping=not settings.is_sqlite,
    future=True,
)

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


def init_db() -> None:
    """Maak tabellen aan als ze nog niet bestaan en draai lichte migraties."""
    from . import models  # noqa: F401  (zorgt dat modellen geregistreerd zijn)

    Base.metadata.create_all(bind=engine)
    _run_light_migrations()
