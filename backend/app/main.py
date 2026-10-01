"""FastAPI entrypoint voor het MiGuide admin CRUD-systeem."""
from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import parse_qsl, urlencode

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import REPO_ROOT, get_settings, is_serverless
from .db import SessionLocal, get_db, init_db
from .models import (
    AuditLog,
    ContractRule,
    Facturatiestroom,
    User,
    Zorggroep,
    Zorgverzekeraar,
)
from .routers import (
    admin_contracten,
    admin_facturatiestromen,
    admin_places,
    admin_postcodes,
    admin_users,
    admin_zorggroepen,
    admin_zorgverzekeraars,
    audit,
    auth,
    public,
    publish,
)
from .security import require_editor
from .services.import_seed import ensure_seed_admin, import_seed

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lokaal: database automatisch klaarzetten en synchroniseren met zg-data.
    # Online (Vercel, serverless) niet bij elke koude start - dat zou elke eerste
    # aanvraag vertragen; daarvoor draai je bewust backend/scripts/sync_database.py.
    if not is_serverless():
        init_db()
        db = SessionLocal()
        try:
            import_seed(db)
            ensure_seed_admin(db)
        finally:
            db.close()
    yield


app = FastAPI(title="MiGuide Zorgtools Admin", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RestoreVercelRewritePath:
    """Vercel stuurt /api/auth|public|admin/* via een rewrite naar de functie
    api/admin_api.py (zie vercel.json), met het originele pad in ?__zg_path=.
    Komt alleen het functiepad binnen, dan zetten we het originele pad terug; de
    hulpparameter verdwijnt altijd. Routes doen zelf hun autorisatie, dus dit geeft
    geen extra toegang."""

    _PREFIXES = ("/api/auth/", "/api/public/", "/api/admin/")

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
            original = next((value for key, value in query if key == "__zg_path"), None)
            if original is not None:
                scope = dict(scope)
                rest = [(key, value) for key, value in query if key != "__zg_path"]
                scope["query_string"] = urlencode(rest).encode("latin-1")
                if (
                    not scope.get("path", "").startswith(self._PREFIXES)
                    and original.startswith(self._PREFIXES)
                    and ".." not in original
                ):
                    scope["path"] = original
                    scope["raw_path"] = original.encode("utf-8")
        await self.app(scope, receive, send)


app.add_middleware(RestoreVercelRewritePath)


# ---- API routers ----
app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin_zorggroepen.router)
app.include_router(admin_zorgverzekeraars.router)
app.include_router(admin_facturatiestromen.router)
app.include_router(admin_contracten.router)
app.include_router(admin_postcodes.router)
app.include_router(admin_places.router)
app.include_router(admin_users.router)
app.include_router(audit.router)
app.include_router(publish.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/admin/stats", tags=["admin:dashboard"])
def admin_stats(db: Session = Depends(get_db), user: User = Depends(require_editor)) -> dict:
    def count(model, *conditions) -> int:
        query = select(func.count()).select_from(model)
        for c in conditions:
            query = query.where(c)
        return db.scalar(query) or 0

    recent = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(5)
    ).all()
    return {
        "zorggroepen_total": count(Zorggroep),
        "zorggroepen_active": count(Zorggroep, Zorggroep.is_active == True),  # noqa: E712
        "zorgverzekeraars_active": count(Zorgverzekeraar, Zorgverzekeraar.is_active == True),  # noqa: E712
        "facturatiestromen_active": count(Facturatiestroom, Facturatiestroom.is_active == True),  # noqa: E712
        "contract_rules_total": count(ContractRule),
        "users_total": count(User),
        "recent_changes": [
            {
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "actor_name": log.actor_name,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in recent
        ],
    }


# ---- Statische bestanden (zodat alles same-origin op :8000 bereikbaar is) ----
# Same-origin is nodig zodat de HttpOnly sessie-cookie meegestuurd wordt.
def _mount_if_exists(url_path: str, dir_name: str, html: bool = False) -> None:
    directory = REPO_ROOT / dir_name
    if directory.exists():
        app.mount(url_path, StaticFiles(directory=directory, html=html), name=dir_name)


@app.get("/", include_in_schema=False, response_model=None)
def root_index() -> FileResponse | JSONResponse:
    index = REPO_ROOT / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"detail": "MiGuide admin API draait. Open /admin/ voor de adminomgeving."})


@app.get("/{page_name}.html", include_in_schema=False, response_model=None)
def root_html(page_name: str) -> FileResponse | JSONResponse:
    candidate = REPO_ROOT / f"{page_name}.html"
    # Voorkom path traversal: alleen losse bestandsnamen toestaan.
    if "/" in page_name or "\\" in page_name or ".." in page_name:
        return JSONResponse({"detail": "Niet gevonden."}, status_code=404)
    if candidate.exists():
        return FileResponse(candidate)
    return JSONResponse({"detail": "Niet gevonden."}, status_code=404)


# Mount admin UI en bijbehorende assets. Backend/ en .git worden NIET geserveerd.
_mount_if_exists("/admin", "admin", html=True)
_mount_if_exists("/shared", "shared")
_mount_if_exists("/css", "css")
_mount_if_exists("/script", "script")
_mount_if_exists("/zg-data", "zg-data")
_mount_if_exists("/losse-verwijzing-tool", "losse-verwijzing-tool", html=True)
