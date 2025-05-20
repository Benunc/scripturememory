import { getAccessToken } from './sheets';

// Map of authorized users and their allowed tabs
const authorizedUsers: Record<string, string[]> = {
  'benmeredith@gmail.com': ['Verses'],
  'ben.meredith@gmail.com': ['Verses'], // Adding your email with access to the Verses tab
  'ben@benandjacq.com': ['Verses'],
};

// Function to check if a user is authorized
export const isUserAuthorized = (email: string): boolean => {
  return email in authorizedUsers;
};

// Function to get the tabs a user can access
export const getUserTabs = (email: string): string[] => {
  return authorizedUsers[email] || [];
};

// Function to check if a user can access a specific tab
export const canAccessTab = (email: string, tabName: string): boolean => {
  return getUserTabs(email).includes(tabName);
};

// Function to get the user's email from the token
export const getUserEmail = async (): Promise<string | null> => {
  try {
    // Ensure we have a valid token
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
    return data.email;
  } catch (error) {
    console.error('Error getting user email:', error);
    return null;
  }
}; 