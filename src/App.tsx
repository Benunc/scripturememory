import { Box, Button, HStack, Heading, Text, Avatar, useToast } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { Intro } from './components/Intro'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { getAccessToken, resetClientState } from './utils/token'
import { fetchUserEmail, isUserAuthorized, validateEnvVariables } from './utils/auth'

// Add type for Google client
declare global {
  interface Window {
    google: any;
  }
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const toast = useToast();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Validate environment variables first
        validateEnvVariables();
        
        // Only check for existing token without triggering sign-in
        const existingToken = localStorage.getItem('google_access_token');
        if (existingToken) {
          const email = await fetchUserEmail();
          // console.log('Initialization - Got email:', email);
          setUserEmail(email);
          setIsAuthenticated(true);
          const authorized = isUserAuthorized(email);
          // console.log('Initialization - Authorization check:', authorized);
          setIsAuthorized(authorized);
        }
      } catch (error) {
        console.error('Initialization error:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : 'Failed to initialize app',
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [toast]);

  const handleVerseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogin = async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        const email = await fetchUserEmail();
        setUserEmail(email);
        setIsAuthenticated(true);
        setIsAuthorized(isUserAuthorized(email));
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Error",
        description: error instanceof Error ? error.message : 'Failed to login',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await resetClientState();
      setIsAuthenticated(false);
      setIsAuthorized(false);
      setUserEmail(null);
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: error instanceof Error ? error.message : 'Failed to sign out',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    // console.log('App: Loading state');
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    // console.log('App: Not authenticated');
    return <Intro onLogin={handleLogin} />;
  }

  if (!isAuthorized) {
    // console.log('App: Not authorized', { isAuthenticated, isAuthorized, userEmail });
    return (
      <Box className="App">
        <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Heading as="h1" size="xl">Scripture Memory</Heading>
            <Button onClick={handleSignOut} colorScheme="red" size="sm">
              Sign Out
            </Button>
          </HStack>
        </Box>
        <Box p={4}>
          <Text>You are not authorized to access this application.</Text>
          <Text mt={2}>Please contact the administrator if you believe this is an error.</Text>
        </Box>
      </Box>
    );
  }

  // console.log('App: Rendering main view', { isAuthenticated, isAuthorized, userEmail });
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
  );
}

export default App 