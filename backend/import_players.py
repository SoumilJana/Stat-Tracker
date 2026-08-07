import os
import asyncio
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

async def import_users():
    print("Reading playerdata.xlsx...")
    try:
        df = pd.read_excel('playerdata.xlsx')
        
        # Ensure we don't have NaN values
        df = df.fillna('')
        
        for index, row in df.iterrows():
            # Get data, fallback if columns are named slightly differently
            full_name = str(row.get('Name', '')).strip()
            username = str(row.get('username', '')).strip()
            password = str(row.get('password', '')).strip()
            role = str(row.get('role', 'player')).strip().lower()
            
            if not username or not password:
                print(f"Skipping row {index+2} due to missing username or password.")
                continue
                
            email = f"{username.lower()}@stattracker.local"
            
            # Skip if we already added Soumil manually
            if username.lower() == 'soumil':
                print(f"Skipping {username} (already processed earlier).")
                continue
                
            print(f"Adding user: {username} ({full_name}) as {role}...")
            try:
                # We store 'full_name' in user_metadata even if we don't display it immediately on frontend, 
                # just so it's securely stored for future use.
                response = supabase.auth.admin.create_user({
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "username": username,
                        "full_name": full_name,
                        "role": role
                    }
                })
                print(f"  [SUCCESS]")
            except Exception as e:
                print(f"  [FAILED]: {str(e)}")
                
    except Exception as e:
        print(f"Failed to read file: {e}")

if __name__ == "__main__":
    asyncio.run(import_users())
