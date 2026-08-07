import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

async def seed_user():
    username = "Soumil"
    password = "12345"
    role = "admin"
    
    email = f"{username.lower()}@stattracker.local"
    
    try:
        response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {
                "username": username,
                "role": role
            }
        })
        print(f"Successfully created user: {username}")
    except Exception as e:
        print(f"Failed to create user {username}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(seed_user())
