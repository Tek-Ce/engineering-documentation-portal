# ============================================
# FILE: app/main.py # Serves both API and React SPA frontend
# ============================================

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.core.config import settings
from app.api.v1 import router as api_v1_router
import os

# Create upload directories
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "documents"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "temp"), exist_ok=True)

# Static files directory (for production frontend)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
HAS_FRONTEND = os.path.exists(STATIC_DIR) and os.path.exists(os.path.join(STATIC_DIR, "index.html"))

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Engineering Documentation Portal API",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.DEBUG else "/api/docs",
    redoc_url="/redoc" if settings.DEBUG else "/api/redoc",
    redirect_slashes=False
)

# CORS middleware - needed for development with separate frontend server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API router
app.include_router(api_v1_router, prefix="/api/v1")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "engineering-portal-api",
        "version": settings.APP_VERSION,
        "frontend": "embedded" if HAS_FRONTEND else "separate"
    }

# API info endpoint
@app.get("/api")
async def api_info():
    return {
        "message": "Engineering Documentation Portal API",
        "version": settings.APP_VERSION,
        "docs": "/api/docs" if not settings.DEBUG else "/docs",
        "endpoints": {
            "auth": "/api/v1/auth",
            "projects": "/api/v1/projects",
            "documents": "/api/v1/documents",
            "comments": "/api/v1/comments",
            "notifications": "/api/v1/notifications",
            "users": "/api/v1/users",
            "tags": "/api/v1/tags"
        }
    }

# Serve frontend static files in production
if HAS_FRONTEND:
    # Mount static assets (JS, CSS, images)
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    # Serve favicon and other root static files
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = os.path.join(STATIC_DIR, "favicon.ico")
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path)
        return JSONResponse({"error": "Not found"}, status_code=404)
    
    @app.get("/vite.svg")
    async def vite_svg():
        svg_path = os.path.join(STATIC_DIR, "vite.svg")
        if os.path.exists(svg_path):
            return FileResponse(svg_path, media_type="image/svg+xml")
        return JSONResponse({"error": "Not found"}, status_code=404)
    
    # SPA catch-all route - serves index.html for client-side routing
    # This MUST be the last route defined
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Don't intercept API or upload routes
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path.startswith("docs") or full_path.startswith("redoc"):
            return JSONResponse({"error": "Not found"}, status_code=404)
        
        # Serve index.html for all frontend routes
        index_path = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index_path)

else:
    # No frontend - show API info at root
    @app.get("/")
    async def root():
        return {
            "message": "Engineering Documentation Portal API",
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "redoc": "/redoc",
            "note": "Frontend not found. Place built frontend files in 'static/' directory."
        }

# Startup event
@app.on_event("startup")
async def startup_event():
    print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    print(f"📝 API Documentation: http://localhost:8000/docs")
    print(f"🔧 Debug mode: {settings.DEBUG}")
    if HAS_FRONTEND:
        print(f"🌐 Frontend: Embedded (serving from /static)")
    else:
        print(f"🌐 Frontend: Not found (API-only mode)")
        print(f"   Place frontend build in: {STATIC_DIR}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    print(f"👋 {settings.APP_NAME} shutting down...")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
