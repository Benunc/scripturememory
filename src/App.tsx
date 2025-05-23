import { Box, Button, HStack, Heading, Text, Avatar, useToast, VStack, Flex } from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { FreeVersion } from './components/FreeVersion'
import { validateEnvVariables } from './utils/auth'
import { useAuth } from './hooks/useAuth'
import { Footer } from './components/Footer'
import logo from '/assets/images/ScriptureMemory.svg'
import { useVerses } from './hooks/useVerses'

// Add type for Google client
declare global {
  interface Window {
    google: any;
  }
}

function App() {
  const { isAuthenticated, isAuthorized, userEmail, signOut, signIn } = useAuth();
  const { verses, loading, error, updateVerse, deleteVerse, addVerse } = useVerses();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const verseListRef = useRef<{ scrollToVerse: (reference: string) => void }>(null);

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

  const handleVerseAdded = (reference: string) => {
    // Scroll to the newly added verse
    verseListRef.current?.scrollToVerse(reference);
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
    <Box p={4}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center">
          <HStack spacing={4}>
            <img src={logo} alt="Scripture Memory Logo" style={{ height: '40px' }} />
            <Heading size="lg">Scripture Memory</Heading>
          </HStack>
          <HStack spacing={4}>
            <Text>{userEmail}</Text>
            <Avatar size="sm" name={userEmail || undefined} />
            <Button onClick={signOut}>Sign Out</Button>
          </HStack>
        </Flex>

        <VerseList
          ref={verseListRef}
          verses={verses}
          loading={loading}
          error={error}
          onStatusChange={(ref, status) => updateVerse(ref, { status })}
          onDelete={deleteVerse}
        />
        <AddVerse onVerseAdded={handleVerseAdded} addVerse={addVerse} />
      </VStack>
      <Footer />
    </Box>
  );
}

export default App 