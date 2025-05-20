import { Box, Heading, Text, HStack, Avatar, Button, useToast, VStack, UnorderedList, ListItem } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { Intro } from './components/Intro'
import { getAccessToken, getUserEmail, resetClientState } from './utils/sheets'
import { getUserEmail as getAuthUserEmail, isUserAuthorized } from './utils/auth'

// Add type for Google client
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: any;
      };
    };
  }
}

// Reset Google client state
const resetGoogleClient = () => {
  // Remove the Google client script
  const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
  if (script) {
    script.remove();
  }
  // Clear any Google client state by reloading the script
  const newScript = document.createElement('script');
  newScript.src = 'https://accounts.google.com/gsi/client';
  newScript.async = true;
  newScript.defer = true;
  document.body.appendChild(newScript);
};

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check localStorage on initial load
    return localStorage.getItem('google_access_token') !== null;
  });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const checkAuthorization = async () => {
      if (isAuthenticated) {
        try {
          const email = await getAuthUserEmail();
          if (email) {
            setIsAuthorized(isUserAuthorized(email));
            setUserEmail(email);
          } else {
            // If we couldn't get the email, the token might be invalid
            setIsAuthenticated(false);
            setIsAuthorized(false);
            setUserEmail(null);
            localStorage.removeItem('google_access_token');
            localStorage.removeItem('google_token_expiry');
            localStorage.removeItem('is_authorized');
            localStorage.removeItem('user_email');
          }
        } catch (error) {
          console.error('Authorization check failed:', error);
          setIsAuthenticated(false);
          setIsAuthorized(false);
          setUserEmail(null);
          localStorage.removeItem('google_access_token');
          localStorage.removeItem('google_token_expiry');
          localStorage.removeItem('is_authorized');
          localStorage.removeItem('user_email');
        }
      }
      setIsLoading(false);
    };
    checkAuthorization();
  }, [isAuthenticated]);

  const handleVerseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const token = await getAccessToken();
      if (token) {
        setIsAuthenticated(true);
        // Authorization will be checked in the useEffect
      }
    } catch (error) {
      console.error('Login failed:', error);
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setUserEmail(null);
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_token_expiry');
      localStorage.removeItem('is_authorized');
      localStorage.removeItem('user_email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      // Revoke the token with Google
      const token = localStorage.getItem('google_access_token');
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
    } finally {
      // Clear all state and storage regardless of revoke success
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setUserEmail(null);
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_token_expiry');
      localStorage.removeItem('is_authorized');
      localStorage.removeItem('user_email');
      
      // Reset Google client state
      resetGoogleClient();
      resetClientState();
      
      toast({
        title: 'Signed out',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return <Intro onLogin={handleLogin} />;
  }

  if (!isAuthorized) {
    return (
      <Box className="App">
        <Box as="header">
          <Heading as="h1" size="xl">Scripture Memory</Heading>
        </Box>
        <Box as="main" p={8}>
          <VStack spacing={6} align="stretch" maxW="600px" mx="auto">
            <Text fontSize="lg" textAlign="center">
              Welcome to Scripture Memory!
            </Text>
            <Text>
              This app helps you track your scripture memory progress. Each user gets their own space to add and track verses they're memorizing.
            </Text>
            <Text>
              To get started, please contact the administrator (benmeredith@gmail.com) to request access. Once approved, you'll be able to:
            </Text>
            <Box pl={4}>
              <UnorderedList>
                <ListItem>Create your own verse list</ListItem>
                <ListItem>Track your memorization progress</ListItem>
                <ListItem>Add new verses to memorize</ListItem>
              </UnorderedList>
            </Box>
            <Text>
              In the meantime, you can see how it works with our sample verse: John 3:16
            </Text>
            <Box p={4} bg="gray.50" borderRadius="md">
              <Text fontWeight="bold">John 3:16</Text>
              <Text mt={2}>
                "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life."
              </Text>
            </Box>
          </VStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <HStack justify="space-between" align="center">
          <Heading as="h1" size="xl">Scripture Memory</Heading>
          <HStack spacing={4}>
            <HStack spacing={2}>
              <Avatar size="sm" name={userEmail || undefined} />
              <Text>{userEmail}</Text>
            </HStack>
            <Button onClick={handleSignOut} colorScheme="red" size="sm">
              Sign Out
            </Button>
          </HStack>
        </HStack>
      </Box>
      <Box as="main">
        <AddVerse onVerseAdded={handleVerseAdded} />
        <VerseList key={refreshTrigger} />
      </Box>
    </Box>
  )
}

export default App 