import { Verse } from '../types';
import { getAccessToken } from './token';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export async function fetchVerses(): Promise<Verse[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const response = await fetch(`${API_BASE}/${SHEET_ID}/values/Verses!A2:E`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch verses');
  }

  const data = await response.json();
  return data.values.map((row: any[]) => ({
    reference: row[0],
    text: row[1],
    status: row[2],
    lastReviewed: row[3],
    reviewCount: parseInt(row[4], 10),
  }));
}

export async function addVerse(verse: Omit<Verse, 'lastReviewed' | 'reviewCount'>): Promise<Verse> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  const now = new Date().toISOString();
  const newVerse = {
    ...verse,
    lastReviewed: now,
    reviewCount: 0,
  };

  const response = await fetch(`${API_BASE}/${SHEET_ID}/values/Verses!A:E:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[
        newVerse.reference,
        newVerse.text,
        newVerse.status,
        newVerse.lastReviewed,
        newVerse.reviewCount,
      ]],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add verse');
  }

  return newVerse;
}

export async function updateVerse(reference: string, updates: Partial<Verse>): Promise<Verse> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  // First, find the row number for this verse
  const response = await fetch(`${API_BASE}/${SHEET_ID}/values/Verses!A:A`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to find verse');
  }

  const data = await response.json();
  const rowIndex = data.values.findIndex((row: any[]) => row[0] === reference);
  if (rowIndex === -1) {
    throw new Error('Verse not found');
  }

  // Now update the specific cells
  const row = rowIndex + 1; // Convert to 1-based index
  const range = `Verses!A${row}:E${row}`;
  
  const updateResponse = await fetch(`${API_BASE}/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [[
        reference,
        updates.text,
        updates.status,
        updates.lastReviewed,
        updates.reviewCount,
      ]],
    }),
  });

  if (!updateResponse.ok) {
    throw new Error('Failed to update verse');
  }

  return {
    reference,
    text: updates.text || '',
    status: updates.status || 'not_started',
    lastReviewed: updates.lastReviewed || new Date().toISOString(),
    reviewCount: updates.reviewCount || 0,
  };
}

export async function deleteVerse(reference: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('No access token available');

  // First, find the row number for this verse
  const response = await fetch(`${API_BASE}/${SHEET_ID}/values/Verses!A:A`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to find verse');
  }

  const data = await response.json();
  const rowIndex = data.values.findIndex((row: any[]) => row[0] === reference);
  if (rowIndex === -1) {
    throw new Error('Verse not found');
  }

  // Now delete the row
  const row = rowIndex + 1; // Convert to 1-based index
  const range = `Verses!A${row}:E${row}`;
  
  const deleteResponse = await fetch(`${API_BASE}/${SHEET_ID}/values/${range}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!deleteResponse.ok) {
    throw new Error('Failed to delete verse');
  }
} 