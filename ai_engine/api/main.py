"""
FastAPI Server Entry Point for SmartClassroom AI Attendance System.
"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai_engine.api.routes import router

app = FastAPI(
    title="SmartClassroom AI Attendance Backend API",
    description="Local AI face recognition, camera abstraction, and attendance processing service",
    version="1.0.0"
)

# Enable CORS for Electron desktop app and Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints at both root and /api/v1
app.include_router(router)
app.include_router(router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "service": "SmartClassroom AI Attendance System",
        "status": "online",
        "docs": "/docs",
        "api_version": "1.0.0"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("AI_API_PORT", 8000)))
    host = os.getenv("AI_API_HOST", "0.0.0.0" if os.getenv("RENDER") or os.getenv("PORT") else "127.0.0.1")
    print(f"Starting SmartClassroom AI Backend on http://{host}:{port}...")
    uvicorn.run("ai_engine.api.main:app", host=host, port=port, log_level="info")

