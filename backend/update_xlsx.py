import pandas as pd

file_path = 'playerdata.xlsx'
df = pd.read_excel(file_path)

new_data = [
    {"Name": "Soumo Bro", "username": "Soumo Bro", "password": "123", "role": "player"},
    {"Name": "Aniruddha", "username": "Soumya", "password": "123", "role": "player"}
]

for nd in new_data:
    # Append if not already present
    if not (df['username'] == nd['username']).any():
        new_row = pd.DataFrame([nd])
        df = pd.concat([df, new_row], ignore_index=True)

df.to_excel(file_path, index=False)
print("Successfully added new players to playerdata.xlsx")
