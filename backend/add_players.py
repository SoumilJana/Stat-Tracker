import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

async def add_players():
    players = [
        {"full_name": "Soumo Bro", "username": "Soumo Bro", "password": "123"},
        {"full_name": "Aniruddha", "username": "Soumya", "password": "123"}
    ]
    
    for player in players:
        try:
            email = f"{player['username'].replace(' ', '').lower()}@stattracker.local"
            
            # Create in auth
            response = supabase.auth.admin.create_user({
                "email": email,
                "password": player["password"],
                "email_confirm": True,
                "user_metadata": {
                    "username": player["username"],
                    "full_name": player["full_name"],
                    "role": "player"
                }
            })
            
            user_id = response.user.id
            
            # Insert into profiles
            profile_data = {
                "id": user_id,
                "username": player["username"],
                "role": "player"
            }
            supabase.table("profiles").insert(profile_data).execute()
            
            print(f"Successfully created user: {player['username']}")
        except Exception as e:
            print(f"Failed to create user {player['username']}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(add_players())
