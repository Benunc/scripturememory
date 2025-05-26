import React from 'react';
import { Box, Button, HStack, Heading, Text, Avatar, useToast, VStack, Flex } from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { FreeVersion } from './components/FreeVersion'
import { VerifyToken } from './components/VerifyToken'
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

function MainApp() {
  const { isAuthenticated, userEmail, signOut, token } = useAuth();
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
    return <FreeVersion />;
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

function TestRoute() {
  console.log('Test route rendered');
  return <div>Test Route</div>;
}

function SimpleVerify() {
  console.log('Simple verify route rendered');
  return <div>Simple Verify Route</div>;
}

function CatchAll() {
  console.log('Catch-all route rendered');
  return <div>Catch-all route</div>;
}

function App() {
  console.log('App component rendered');
  return (
    <Router>
      <Routes>
        <Route 
          path="/test" 
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <TestRoute />
            </React.Suspense>
          } 
        />
        <Route 
          path="/auth/verify" 
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <VerifyToken />
            </React.Suspense>
          } 
        />
        <Route 
          path="/" 
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <MainApp />
            </React.Suspense>
          } 
        />
        <Route 
          path="*" 
          element={
            <React.Suspense fallback={<div>Loading...</div>}>
              <CatchAll />
            </React.Suspense>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App 