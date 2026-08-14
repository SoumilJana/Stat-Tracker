const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function createPlayer(data: any) {
  const response = await fetch(`${API_URL}/api/players/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create player');
  }
  
  return response.json();
}

export async function deletePlayer(userId: string) {
  const response = await fetch(`${API_URL}/api/players/${userId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete player');
  }
  
  return response.json();
}

export async function updatePlayer(userId: string, data: any) {
  const response = await fetch(`${API_URL}/api/players/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update player');
  }
  
  return response.json();
}
