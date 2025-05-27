import { Verse } from '../types/Verse';
import { getApiUrl } from './api';

export const getVerses = async (userEmail: string): Promise<Verse[]> => {
  try {
    const response = await fetch(`${getApiUrl()}/verses?email=${encodeURIComponent(userEmail)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch verses');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching verses:', error);
    return [];
  }
};

export const addVerse = async (userEmail: string, verseData: Omit<Verse, 'id'>): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiUrl()}/verses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        ...verseData,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error adding verse:', error);
    return false;
  }
};

export const updateVerse = async (userEmail: string, verseId: string, updates: Partial<Verse>): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiUrl()}/verses/${verseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        ...updates,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error updating verse:', error);
    return false;
  }
};

export const deleteVerse = async (userEmail: string, verseId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiUrl()}/verses/${verseId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting verse:', error);
    return false;
  }
};