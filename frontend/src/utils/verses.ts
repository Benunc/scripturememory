import { Verse } from '../types/Verse';
import { getApiUrl } from './api';
import { debug } from './debug';

export const getVerses = async (userEmail: string): Promise<Verse[]> => {
  try {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
      throw new Error('No session token found');
    }

    const response = await fetch(`${getApiUrl()}/verses`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch verses');
    }
    return await response.json();
  } catch (error) {
    debug.error('verses', 'Error fetching verses', error);
    return [];
  }
};

export const addVerse = async (userEmail: string, verseData: Omit<Verse, 'id'>): Promise<boolean> => {
  try {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
      throw new Error('No session token found');
    }

    const response = await fetch(`${getApiUrl()}/verses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify(verseData),
    });
    return response.ok;
  } catch (error) {
    debug.error('verses', 'Error adding verse', error);
    return false;
  }
};

export const updateVerse = async (userEmail: string, verseId: string, updates: Partial<Verse>): Promise<boolean> => {
  try {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
      throw new Error('No session token found');
    }

    const response = await fetch(`${getApiUrl()}/verses/${verseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify(updates),
    });
    return response.ok;
  } catch (error) {
    debug.error('verses', 'Error updating verse', error);
    return false;
  }
};

export const deleteVerse = async (userEmail: string, verseId: string): Promise<boolean> => {
  try {
    const sessionToken = localStorage.getItem('session_token');
    if (!sessionToken) {
      throw new Error('No session token found');
    }

    const response = await fetch(`${getApiUrl()}/verses/${verseId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    return response.ok;
  } catch (error) {
    debug.error('verses', 'Error deleting verse', error);
    return false;
  }
};