"""main.py — CalcCabos FastAPI application entry point.

Production hardening applied:
- CORS origins read from CORS_ORIGINS env var (comma-separated).
- Structured JSON logging via Python stdlib logging.
- Request timing middleware (X-Process-Time header on every response).
- Global exception handler with structured error body.
- /api/health and /api/ready endpoints for load-balancer probes.
"""
import json
import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.routers import agente, auth, calculadora, circuitos, modulos_projeto, projetos, relatorios
from app.database import engine, Base
import app.models  # load all models

# Initialize DB tables on startup
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

# ── Structured logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "msg": %(message)s}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("calccabos")


# ── App factory ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="CalcCabos API Stateless Motor",
    version="2.0.0",
    description="Motor de cálculo em Python para engenharia elétrica. Acessado via Node.js.",
    redirect_slashes=False,
    # Disable docs in production via DOCS_ENABLED=false
    docs_url="/docs" if os.environ.get("DOCS_ENABLED", "true").lower() != "false" else None,
    redoc_url="/redoc" if os.environ.get("DOCS_ENABLED", "true").lower() != "false" else None,
)

# ── CORS — read from environment (no hardcoded origins) ─────────────────────
_raw_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:3000,http://127.0.0.1:8000,https://calccabos.onrender.com",
)
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Request-ID"],
)


# ── Request timing middleware ────────────────────────────────────────────────
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.4f}"
    if elapsed > 2.0:
        logger.warning(json.dumps({
            "event": "slow_request",
            "method": request.method,
            "path": request.url.path,
            "duration_s": round(elapsed, 3),
        }))
    return response


# ── Global exception handler ─────────────────────────────────────────────────
def _json_safe(value):
    if isinstance(value, bytes):
        return f"[bytes: {len(value)} bytes]"
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value if isinstance(value, (str, int, float, bool)) or value is None else str(value)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    _errors = exc.errors()
    safe_errors = _json_safe(_errors)

    logger.error(json.dumps({
        "event": "request_validation_error",
        "path": request.url.path,
        "type": type(exc).__name__,
        "errors": safe_errors,
    }))

    content = {
        "error": "validation_error",
        "detail": safe_errors,
        "path": request.url.path,
    }
    return JSONResponse(status_code=422, content=_json_safe(content))


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback as _tb
    logger.error(json.dumps({
        "event": "unhandled_exception",
        "path": request.url.path,
        "error": str(exc),
        "type": type(exc).__name__,
        "traceback": _tb.format_exc(),
    }))
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "detail": "Um erro inesperado ocorreu no motor de cálculo.",
            "path": request.url.path,
        },
    )


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(calculadora.router, tags=["calculadora"])

# DEPRECATED legacy prefix kept for backward compatibility (POST /relatorio/pdf|excel)
app.include_router(relatorios.router,  prefix="/relatorio", tags=["relatorios-deprecated"])

app.include_router(agente.router,      prefix="/agente",    tags=["agente"])
app.include_router(auth.router,        prefix="/api/auth",  tags=["auth"])
app.include_router(projetos.router,    prefix="/api/projetos", tags=["projetos"])
app.include_router(modulos_projeto.router, prefix="/api/projetos", tags=["modulos-projeto"])
app.include_router(circuitos.router,   prefix="/api/circuitos", tags=["circuitos"])
app.include_router(relatorios.compat_router, prefix="/api/relatorios", tags=["relatorios-compat"])

# FASE 4: novos endpoints REST GET /api/projetos/:id/relatorio/pdf|excel
# O router é registrado em /api/projetos para que os paths /{id}/relatorio/* fiquem
# disponíveis em /api/projetos/{id}/relatorio/pdf e /api/projetos/{id}/relatorio/excel.
app.include_router(relatorios.router,  prefix="/api/projetos", tags=["relatorios"])


# ── Health / readiness probes ────────────────────────────────────────────────
@app.get("/api/health", tags=["ops"], summary="Liveness probe")
def health():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/api/ready", tags=["ops"], summary="Readiness probe")
def ready():
    return {"status": "ready", "db": "stateless"}


# ── Static SPA Serving (when built frontend/dist exists) ────────────────────
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # ── FASE 1: Dedicated 404 handler for unknown /api/* routes ─────────────
    # Must be registered BEFORE the SPA catch-all so that inexistent API routes
    # return a structured JSON 404 instead of index.html with status 200.
    @app.api_route(
        "/api/{full_path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        tags=["ops"],
        include_in_schema=False,
    )
    async def api_not_found(request: Request, full_path: str):
        return JSONResponse(
            status_code=404,
            content={
                "error": "Route not found",
                "path": request.url.path,
            },
        )

    @app.get("/{full_path:path}", tags=["spa"])
    async def serve_spa(request: Request, full_path: str):
        # Guard: /api/* routes that reach here are unknown — return 404 JSON.
        # This is a safety net; the handler above should catch them first.
        if full_path.startswith("api/") or full_path == "api":
            return JSONResponse(
                status_code=404,
                content={
                    "error": "Route not found",
                    "path": request.url.path,
                },
            )
        possible_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.exists(possible_path) and os.path.isfile(possible_path):
            return FileResponse(possible_path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"status": "CalcCabos Python Engine v2.0.0"}
else:
    # ── FASE 1: Dedicated 404 handler for unknown /api/* routes (no-SPA mode) ─
    @app.api_route(
        "/api/{full_path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        tags=["ops"],
        include_in_schema=False,
    )
    async def api_not_found_nospa(request: Request, full_path: str):
        return JSONResponse(
            status_code=404,
            content={
                "error": "Route not found",
                "path": request.url.path,
            },
        )

    @app.get("/", tags=["ops"])
    def root():
        return {"status": "CalcCabos Python Engine v2.0.0"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
