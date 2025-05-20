import { Box, Heading, Text, HStack, Avatar, Button, useToast, VStack, UnorderedList, ListItem, Flex } from '@chakra-ui/react'
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
  const [isExampleActive, setIsExampleActive] = useState(false);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState(false);
  const toast = useToast();

  const exampleVerse = {
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
  };

  const handleStartExample = () => {
    setIsExampleActive(true);
    setRevealedWords([]);
    setShowFullVerse(false);
  };

  const handleShowHint = () => {
    const words = exampleVerse.text.split(' ');
    const nextWordIndex = revealedWords.length;
    if (nextWordIndex < words.length) {
      setRevealedWords(prev => [...prev, nextWordIndex]);
    }
  };

  const handleReset = () => {
    setRevealedWords([]);
    setShowFullVerse(false);
  };

  const handleShowVerse = () => {
    setShowFullVerse(prev => !prev);
    if (!showFullVerse) {
      setRevealedWords([]);
    }
  };

  const renderVerseText = () => {
    if (showFullVerse) {
      return exampleVerse.text;
    }

    if (!isExampleActive) {
      return exampleVerse.text.split(' ').map(() => '_____').join(' ');
    }

    return exampleVerse.text.split(' ').map((word, index) => {
      if (revealedWords.includes(index)) {
        return word;
      }
      return '_____';
    }).join(' ');
  };

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
        <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Heading as="h1" size="xl">Scripture Memory</Heading>
            <Button onClick={handleSignOut} colorScheme="red" size="sm">
              Sign Out
            </Button>
          </HStack>
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
              To get started, please contact the administrator (ben@benandjacq.com) to request access. Once approved, you'll be able to:
            </Text>
            <Box pl={4} display="flex" justifyContent="center">
              <UnorderedList listStylePos="inside" textAlign="left">
                <ListItem>Create your own verse list</ListItem>
                <ListItem>Track your memorization progress</ListItem>
                <ListItem>Add new verses to memorize</ListItem>
              </UnorderedList>
            </Box>
            <Text>
              Here's an example of how it works:
            </Text>
            <Box 
              p={4} 
              borderWidth="1px" 
              borderRadius="md" 
              borderColor="chakra-border-color"
              bg="chakra-body-bg"
              color="chakra-body-text"
            >
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="bold">{exampleVerse.reference}</Text>
                  <Text mt={2}>{renderVerseText()}</Text>
                </Box>
                <Flex gap={2} wrap="wrap">
                  {!isExampleActive ? (
                    <Button
                      size="sm"
                      colorScheme="blue"
                      onClick={handleStartExample}
                    >
                      Start Memorizing
                    </Button>
                  ) : (
                    <>
                      {revealedWords.length >= exampleVerse.text.split(' ').length ? (
                        <Button
                          size="sm"
                          colorScheme="orange"
                          onClick={handleReset}
                        >
                          Reset
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={handleShowHint}
                          >
                            Show Hint
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="teal"
                            onClick={handleShowVerse}
                          >
                            {showFullVerse ? 'Hide Verse' : 'Show Verse'}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  <Button
                    size="sm"
                    colorScheme="blue"
                    variant="outline"
                    onClick={() => toast({
                      title: "Status updated",
                      description: "This is just a demo - you'll be able to update statuses once you have access",
                      status: "info",
                      duration: 3000,
                      isClosable: true,
                    })}
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    onClick={() => toast({
                      title: "Status updated",
                      description: "This is just a demo - you'll be able to update statuses once you have access",
                      status: "info",
                      duration: 3000,
                      isClosable: true,
                    })}
                  >
                    Mastered
                  </Button>
                </Flex>
              </VStack>
            </Box>
            <Text fontSize="sm" opacity={0.7} textAlign="center">
              Once you have access, you'll be able to update the status of your verses, add new ones to memorize, and test your memory by showing/hiding verses.
            </Text>
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