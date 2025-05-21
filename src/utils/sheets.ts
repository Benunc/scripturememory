import { getAccessToken, resetClientState } from './token';
import { canAccessTab, getUserTabs, rateLimiter, getAuthorizedUsers } from './auth';
import { ProgressStatus } from './progress';

const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;

interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  dateAdded: string;
}

interface SheetProperties {
  title: string;
}

interface Sheet {
  properties: SheetProperties;
}

interface SpreadsheetResponse {
  sheets: Sheet[];
}

interface ValuesResponse {
  values: string[][];
}

// Ensure user's tab exists in the spreadsheet
export const ensureUserTab = async (email: string): Promise<void> => {
  try {
    const token = await getAccessToken();
    const tabName = email.replace(/[^a-zA-Z0-9]/g, '_');

    // First check if user is authorized at all
    const authorizedUsers = getAuthorizedUsers();
    const user = authorizedUsers.find(u => u.email === email);
    if (!user) {
      throw new Error('User is not authorized');
    }

    // Check if tab exists
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch spreadsheet');
    }

    const data = await response.json() as SpreadsheetResponse;
    const sheets = data.sheets || [];
    const tabExists = sheets.some((sheet) => sheet.properties.title === tabName);

    if (!tabExists) {
      // Create new tab
      const createResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: tabName,
                  },
                },
              },
            ],
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error('Failed to create user tab');
      }

      // Initialize tab with headers
      const initResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A1:D1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            values: [['Reference', 'Text', 'Status', 'Last Reviewed']],
          }),
        }
      );

      if (!initResponse.ok) {
        throw new Error('Failed to initialize user tab');
      }
    }
  } catch (error) {
    console.error('Error ensuring user tab:', error);
    throw error;
  }
};

// Get verses from user's tab
export const getVerses = async (userEmail: string): Promise<Verse[]> => {
  if (!rateLimiter.canMakeRequest(userEmail)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  try {
    rateLimiter.recordRequest(userEmail);
    const token = await getAccessToken();
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Check if user has permission to access this tab
    if (!canAccessTab(userEmail, sanitizedEmail)) {
      throw new Error('User does not have permission to access this tab');
    }

    // First try to fetch from the user's own tab
    let response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sanitizedEmail}!A2:D`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // If user's tab doesn't exist and they're an admin, try the "verses" tab
    if (!response.ok && getUserTabs(userEmail).includes('*')) {
      response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/verses!A2:D`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    }

    if (!response.ok) {
      throw new Error('Failed to fetch verses');
    }

    const data = await response.json() as ValuesResponse;
    return (data.values || []).map((row) => ({
      reference: row[0] || '',
      text: row[1] || '',
      status: (row[2] || 'Not Started') as ProgressStatus,
      dateAdded: row[3] || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching verses:', error);
    throw error;
  }
};

// Add a new verse to user's tab
export const addVerse = async (userEmail: string, verseData: Omit<Verse, 'dateAdded'>): Promise<void> => {
  if (!rateLimiter.canMakeRequest(userEmail)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  try {
    rateLimiter.recordRequest(userEmail);
    const token = await getAccessToken();
    const tabName = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Ensure user's tab exists first
    await ensureUserTab(userEmail);

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:D:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          values: [[verseData.reference, verseData.text, 'New', new Date().toISOString()]],
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to add verse');
    }
  } catch (error) {
    console.error('Error adding verse:', error);
    throw error;
  }
};

// Update verse status
export const updateVerseStatus = async (userEmail: string, verseRef: string, newStatus: string): Promise<void> => {
  if (!rateLimiter.canMakeRequest(userEmail)) {
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  try {
    rateLimiter.recordRequest(userEmail);
    const token = await getAccessToken();
    const tabName = userEmail.replace(/[^a-zA-Z0-9]/g, '_');

    // Check if user has permission to access this tab
    if (!canAccessTab(userEmail, tabName)) {
      throw new Error('User does not have permission to access this tab');
    }

    // First, find the row number for this verse
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:A`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getResponse.ok) {
      throw new Error('Failed to fetch verses');
    }

    const data = await getResponse.json() as ValuesResponse;
    const values = data.values || [];
    const rowIndex = values.findIndex((row) => row[0] === verseRef);

    if (rowIndex === -1) {
      throw new Error('Verse not found');
    }

    // Update the status and last reviewed date
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!C${rowIndex + 1}:D${rowIndex + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          values: [[newStatus, new Date().toISOString()]],
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error('Failed to update verse status');
    }
  } catch (error) {
    console.error('Error updating verse status:', error);
    throw error;
  }
}; 