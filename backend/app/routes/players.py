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

@router.delete("/{user_id}")
def delete_player(user_id: str):
    supabase = get_supabase_admin()
    
    try:
        # Delete user from auth.users via admin API
        try:
            supabase.auth.admin.delete_user(user_id)
        except Exception as auth_e:
            print(f"Could not delete auth user (maybe it doesn't exist): {auth_e}")
        
        # Also ensure profile is deleted in case cascade isn't configured
        supabase.table("profiles").delete().eq("id", user_id).execute()
        
        return {"message": "Player deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class UpdatePlayerRequest(BaseModel):
    username: str
    full_name: str | None = None
    photo_url: str | None = None
    photo_base64: str | None = None

@router.put("/{user_id}")
def update_player(user_id: str, request: UpdatePlayerRequest):
    supabase = get_supabase_admin()
    
    try:
        final_photo_url = request.photo_url
        
        if request.photo_base64:
            import base64
            import time
            b64_data = request.photo_base64
            if "," in b64_data:
                b64_data = b64_data.split(",")[1]
                
            file_data = base64.b64decode(b64_data)
            file_name = f"{user_id}-{int(time.time() * 1000)}.jpg"
            
            supabase.storage.from_("avatars").upload(
                path=file_name,
                file=file_data,
                file_options={"content-type": "image/jpeg", "upsert": "true"}
            )
            
            public_url = supabase.storage.from_("avatars").get_public_url(file_name)
            final_photo_url = public_url
            
        profile_data = {
            "username": request.username,
            "full_name": request.full_name,
            "photo_url": final_photo_url
        }
            
        supabase.table("profiles").update(profile_data).eq("id", user_id).execute()
        
        return {"message": "Player updated successfully", "photo_url": final_photo_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
