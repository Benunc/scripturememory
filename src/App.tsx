import { Box, Button, HStack, Heading, Text, Avatar, useToast, VStack, Flex } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { Intro } from './components/Intro'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { FreeVersion } from './components/FreeVersion'
import { validateEnvVariables } from './utils/auth'
import { useAuth } from './hooks/useAuth'
import { Footer } from './components/Footer'

// Add type for Google client
declare global {
  interface Window {
    google: any;
  }
}

function App() {
  const { isAuthenticated, isAuthorized, userEmail, signOut, signIn } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Validate environment variables first
        validateEnvVariables();
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
    // Refresh verses list
    window.location.reload();
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return <FreeVersion onSignIn={signIn} />;
  }

  if (!isAuthorized) {
    return <FreeVersion userEmail={userEmail || ''} onSignOut={signOut} />;
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={4}>
            <img 
              src="/scripturememory/assets/images/ScriptureMemory.svg" 
              alt="Scripture Memory" 
              style={{ height: '40px' }}
            />
            <Heading size="lg">Scripture Memory</Heading>
          </Flex>
          {isAuthenticated && (
            <Button onClick={signOut} colorScheme="blue" variant="outline">
              Sign Out
            </Button>
          )}
        </Flex>
      </Box>
      <Box as="main" flex="1" w="100%">
        <VStack spacing={8} align="stretch" p={4}>
          <VerseList />
          <AddVerse onVerseAdded={handleVerseAdded} />
        </VStack>
      </Box>
      <Box w="100%">
        <Footer />
      </Box>
    </Box>
  );
}

export default App 