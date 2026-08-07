import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://knnctnedqwexbrfpeunc.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_admin() -> Client:
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Missing SUPABASE_SERVICE_ROLE_KEY in backend environment")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

class CreatePlayerRequest(BaseModel):
    username: str
    password: str
    jersey_number: int | None = None
    role: str = "player"

@router.post("/")
def create_player(request: CreatePlayerRequest):
    supabase = get_supabase_admin()
    
    # 1. Create Auth User
    email = f"{request.username.strip().lower()}@stattracker.local"
    
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": request.password,
            "email_confirm": True
        })
        
        user = auth_response.user
        if not user:
            raise HTTPException(status_code=400, detail="Failed to create user")
            
        # 2. Add to profiles table
        profile_data = {
            "id": user.id,
            "username": request.username,
            "role": request.role,
            "jersey_number": request.jersey_number
        }
        
        supabase.table("profiles").insert(profile_data).execute()
        
        return {"message": "Player created successfully", "user_id": user.id}
        
    except Exception as e:
        # If profile insertion fails, we might want to delete the auth user, but skipping for V1 simplicity
        raise HTTPException(status_code=400, detail=str(e))
