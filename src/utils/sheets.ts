const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Token management
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let isAuthenticating = false;

// Initialize the Google Identity Services client
const initClient = () => {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

// Ensure the client is initialized
let clientInitialized = false;
const ensureClientInitialized = async () => {
  if (!clientInitialized) {
    await initClient();
    clientInitialized = true;
  }
};

// Check if the current token is still valid
const isTokenValid = () => {
  if (!accessToken || !tokenExpiry) return false;
  // Add a 5-minute buffer to prevent edge cases
  return Date.now() < tokenExpiry - 5 * 60 * 1000;
};

// Get an access token using Google Identity Services
const getAccessToken = async () => {
  // Return cached token if it's still valid
  if (isTokenValid()) {
    return accessToken;
  }

  // Prevent multiple simultaneous authentication attempts
  if (isAuthenticating) {
    throw new Error('Authentication already in progress. Please wait...');
  }

  isAuthenticating = true;
  try {
    await ensureClientInitialized();
    return new Promise<string>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: (response) => {
          isAuthenticating = false;
          if (response.error) {
            console.error('OAuth error:', response.error);
            reject(new Error(response.error));
          } else if (response.access_token) {
            // Cache the token and set expiry (default 1 hour)
            accessToken = response.access_token;
            tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        },
        error_callback: (error) => {
          isAuthenticating = false;
          console.error('OAuth error callback:', error);
          // If the popup was closed, we'll try to use the cached token if available
          if (error.message?.includes('Popup window closed') && accessToken) {
            console.log('Popup closed, attempting to use cached token');
            resolve(accessToken);
          } else {
            reject(new Error(error.message || 'Authentication failed'));
          }
        },
      });

      try {
        client.requestAccessToken();
      } catch (error) {
        isAuthenticating = false;
        console.error('Error requesting access token:', error);
        reject(error);
      }
    });
  } catch (error) {
    isAuthenticating = false;
    throw error;
  }
};

// Function to test the connection to Google Sheets
export const testSheetsConnection = async () => {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Verses!A2:D`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch verses: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('Successfully connected to Google Sheets!');
    return data.values || [];
  } catch (error) {
    console.error('Error connecting to Google Sheets:', error);
    throw error;
  }
};

// Function to update a verse's status
export const updateVerseStatus = async (rowIndex: number, status: string) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Verses!C${rowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[status]],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to update status: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating verse status:', error);
    throw error;
  }
};

// Function to add a new verse
export const addVerse = async (reference: string, text: string) => {
  try {
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Verses!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[reference, text, 'not_started', new Date().toISOString()]],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to append verse: ${JSON.stringify(errorData)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding verse:', error);
    throw error;
  }
}; 