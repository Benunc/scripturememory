const SPREADSHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Token management for user authentication
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let isAuthenticating = false;
let currentUserEmail: string | null = null;

// Load token from localStorage on initialization
const loadStoredToken = () => {
  const storedToken = localStorage.getItem('google_access_token');
  const storedExpiry = localStorage.getItem('google_token_expiry');
  const storedEmail = localStorage.getItem('user_email');
  if (storedToken && storedExpiry) {
    accessToken = storedToken;
    tokenExpiry = parseInt(storedExpiry);
    currentUserEmail = storedEmail;
  }
};

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

// Get user's email from Google API
export const getUserEmail = async (): Promise<string> => {
  if (currentUserEmail) return currentUserEmail;

  const token = await getAccessToken();
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  const data = await response.json();
  currentUserEmail = data.email;
  localStorage.setItem('user_email', data.email);
  return data.email;
};

// Get an access token using Google Identity Services
export const getAccessToken = async () => {
  // Load stored token on first call
  if (!accessToken) {
    loadStoredToken();
  }

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
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email',
        callback: (response) => {
          isAuthenticating = false;
          if (response.error) {
            console.error('OAuth error:', response.error);
            reject(new Error(response.error));
          } else if (response.access_token) {
            // Cache the token and set expiry (default 1 hour)
            accessToken = response.access_token;
            tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;
            // Store in localStorage
            localStorage.setItem('google_access_token', response.access_token);
            localStorage.setItem('google_token_expiry', tokenExpiry.toString());
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        },
        error_callback: (error) => {
          isAuthenticating = false;
          console.error('OAuth error callback:', error);
          reject(new Error(error.message || 'Authentication failed'));
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

// Get the user's tab name
const getUserTabName = async (): Promise<string> => {
  const email = await getUserEmail();
  // Remove special characters and spaces from email for tab name
  return email.replace(/[^a-zA-Z0-9]/g, '_');
};

// Ensure user's tab exists
const ensureUserTab = async () => {
  const tabName = await getUserTabName();
  const token = await getAccessToken();

  // First, check if the tab exists
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to check spreadsheet');
  }

  const data = await response.json();
  const tabExists = data.sheets.some((sheet: any) => sheet.properties.title === tabName);

  if (!tabExists) {
    // Create the tab
    const createResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          }],
        }),
      }
    );

    if (!createResponse.ok) {
      throw new Error('Failed to create user tab');
    }

    // Add headers to the new tab
    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A1:D1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['Reference', 'Text', 'Status', 'Date Added']],
        }),
      }
    );

    if (!headerResponse.ok) {
      throw new Error('Failed to add headers to user tab');
    }
  }

  return tabName;
};

// Function to test the connection to Google Sheets
export const testSheetsConnection = async () => {
  try {
    const tabName = await ensureUserTab();
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A2:D`,
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
    const tabName = await ensureUserTab();
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!C${rowIndex}?valueInputOption=USER_ENTERED`,
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
    const tabName = await ensureUserTab();
    const token = await getAccessToken();
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${tabName}!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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

// Reset client state
export const resetClientState = () => {
  accessToken = null;
  tokenExpiry = null;
  isAuthenticating = false;
  currentUserEmail = null;
  clientInitialized = false;
}; 