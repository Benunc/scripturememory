import { Verse } from '../types';

// Use relative URLs by default, which will automatically use the same host/port as the frontend
// This makes it work seamlessly in development without port configuration
const API_URL = import.meta.env.VITE_API_URL || '';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  console.log('Handling response:', response);
  if (!response.ok) {
    const error = await response.text();
    console.error('Response not OK:', error);
    return { error };
  }
  
  if (response.status === 204) {
    console.log('Response is 204 No Content');
    return { data: undefined as unknown as T };
  }
  
  const data = await response.json();
  console.log('Response data:', data);
  return { data: data as T };
}

export async function getMagicLink(email: string): Promise<ApiResponse<{ token: string }>> {
  const response = await fetch(`${API_URL}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  return handleResponse<{ token: string }>(response);
}

export async function verifyMagicLink(token: string): Promise<ApiResponse<{ token: string; email: string }>> {
  console.log('Making verification request to:', `${API_URL}/auth/verify?token=${token}`);
  const response = await fetch(`${API_URL}/auth/verify?token=${token}`);
  console.log('Verification response:', response);
  const result = await handleResponse<{ token: string; email: string }>(response);
  console.log('Verification result:', result);
  return result;
}

export async function getVerses(token: string): Promise<ApiResponse<Verse[]>> {
  const response = await fetch(`${API_URL}/verses`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return handleResponse<Verse[]>(response);
}

export async function addVerse(token: string, verse: Omit<Verse, 'lastReviewed'>): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_URL}/verses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(verse)
  });
  return handleResponse<void>(response);
}

export async function updateVerse(token: string, reference: string, updates: Partial<Verse>): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_URL}/verses/${encodeURIComponent(reference)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(updates)
  });
  return handleResponse<void>(response);
}

export async function deleteVerse(token: string, reference: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_URL}/verses/${encodeURIComponent(reference)}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return handleResponse<void>(response);
} 