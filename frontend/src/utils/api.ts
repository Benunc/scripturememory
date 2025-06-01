import { Verse } from '../types';
import { debug } from './debug';

// Use worker URL in production, relative URL in development
const API_URL = import.meta.env.MODE === 'production'
  ? 'https://scripture-memory.ben-2e6.workers.dev'
  : '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  debug.log('api', 'Handling response:', response);
  if (!response.ok) {
    const error = await response.text();
    debug.error('api', 'Response not OK:', error);
    return { error };
  }
  
  // For 204 No Content or empty 201 Created responses
  if (response.status === 204 || (response.status === 201 && response.headers.get('content-length') === '0')) {
    debug.log('api', 'Response is empty success');
    return { data: undefined as unknown as T };
  }
  
  // Try to parse as JSON for all other successful responses
  try {
    const data = await response.json();
    debug.log('api', 'Response data:', data);
    return { data: data as T };
  } catch (error) {
    debug.error('api', 'Failed to parse JSON response:', error);
    return { error: 'Invalid response format' };
  }
}

export const getMagicLink = async (email: string, isRegistration: boolean, turnstileToken: string): Promise<ApiResponse<{ token: string }>> => {
  try {
    debug.log('api', 'Sending magic link request', { email, isRegistration });
    const response = await fetch(`${API_URL}/auth/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        isRegistration,
        turnstileToken,
      }),
    });

    const result = await handleResponse<{ success: boolean; message: string; email: string }>(response);
    if (result.error) {
      return { error: result.error };
    }
    
    // Always return success, even if we have a token
    if (result.data?.success) {
      return { data: { token: '' } };
    }
    
    return { error: 'No token found in response' };
  } catch (error) {
    debug.error('api', 'Error sending magic link request', error);
    return { error: 'Failed to send magic link' };
  }
};

export const verifyMagicLink = async (token: string): Promise<ApiResponse<{ token: string; email: string }>> => {
  try {
    debug.log('api', 'Making verification request');
    const response = await fetch(`${API_URL}/auth/verify?token=${token}`);
    
    debug.log('api', 'Verification response received', { 
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const error = await response.text();
      debug.error('api', 'Verification failed:', error);
      return { error };
    }
    
    const data = await response.json();
    debug.log('api', 'Verification response data:', data);
    
    if (!data.success || !data.token || !data.email) {
      debug.error('api', 'Invalid verification response:', data);
      return { error: 'Invalid verification response' };
    }
    
    return { 
      data: {
        token: data.token,
        email: data.email
      }
    };
  } catch (error) {
    debug.error('api', 'Error making verification request', error);
    return { error: 'Failed to verify magic link' };
  }
};

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

export const getApiUrl = () => {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? import.meta.env.VITE_WORKER_URL || 'http://localhost:8787'
    : 'https://scripture-memory.ben-2e6.workers.dev';
}; 