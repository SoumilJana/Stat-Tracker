from fastapi import FastAPI

app = FastAPI(
    title="Weekly Football Stats Tracker API",
    description="Backend API for the Stat Tracker application",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Weekly Football Stats Tracker API"}
