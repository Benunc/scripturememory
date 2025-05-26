import { Verse } from '../types';

// Use worker URL in production, relative URL in development
const API_URL = import.meta.env.PROD 
  ? 'https://scripture-memory.ben-2e6.workers.dev'
  : import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

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
  
  // For 204 No Content or empty 201 Created responses
  if (response.status === 204 || (response.status === 201 && response.headers.get('content-length') === '0')) {
    console.log('Response is empty success');
    return { data: undefined as unknown as T };
  }
  
  // Try to parse as JSON for all other successful responses
  try {
    const data = await response.json();
    console.log('Response data:', data);
    return { data: data as T };
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return { error: 'Invalid response format' };
  }
}

export async function getMagicLink(email: string, isRegistration: boolean): Promise<ApiResponse<{ token: string }>> {
  const response = await fetch(`${API_URL}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, isRegistration })
  });
  
  const result = await handleResponse<{ success: boolean; message: string }>(response);
  if (result.error) {
    return { error: result.error };
  }
  
  // Extract token from the magic link URL in the response
  if (result.data?.message) {
    const tokenMatch = result.data.message.match(/token=([^&]+)/);
    if (tokenMatch) {
      return { data: { token: tokenMatch[1] } };
    }
  }
  
  return { error: 'No token found in response' };
}

export async function verifyMagicLink(token: string): Promise<ApiResponse<{ token: string; email: string }>> {
  console.log('Making verification request to:', `${API_URL}/auth/verify?token=${token}`);
  try {
    const response = await fetch(`${API_URL}/auth/verify?token=${token}`);
    console.log('Verification response status:', response.status);
    console.log('Verification response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Verification failed:', error);
      return { error };
    }
    
    const data = await response.json();
    console.log('Verification response data:', data);
    
    if (!data.success || !data.token || !data.email) {
      console.error('Invalid verification response:', data);
      return { error: 'Invalid verification response' };
    }
    
    return { 
      data: {
        token: data.token,
        email: data.email
      }
    };
  } catch (error) {
    console.error('Error making verification request:', error);
    throw error;
  }
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