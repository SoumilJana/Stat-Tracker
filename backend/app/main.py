from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import players

app = FastAPI(
    title="Weekly Football Stats Tracker API",
    description="Backend API for the Stat Tracker application",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api/players", tags=["players"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Weekly Football Stats Tracker API"}
