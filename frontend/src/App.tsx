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
import { ChakraProvider, ColorModeScript, useColorMode } from '@chakra-ui/react';
import { AuthProvider } from './contexts/AuthContext';
import { Register } from './pages/Register';
import { Donate } from './pages/Donate';
import { SignIn } from './components/SignIn';
import { MainApp } from './components/App';
import { theme } from './theme';
import { ThankYou } from './pages/ThankYou';

// Add type for Google client
declare global {
  interface Window {
    google: any;
  }
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
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Only show the toast if we're not authenticated and the URL contains a token
    if (!isAuthenticated && window.location.pathname.includes('/auth/verify')) {
      toast({
        title: "Invalid Magic Link",
        description: "This magic link is no longer valid. Please sign in again to continue.",
        status: "warning",
        duration: 8000,
        isClosable: true,
        position: "top",
      });
    }
  }, [isAuthenticated, toast]);

  return <FreeVersion />;
}

function ColorModeManager() {
  const { setColorMode } = useColorMode();

  useEffect(() => {
    // Check if user prefers dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial color mode
    setColorMode(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setColorMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [setColorMode]);

  return null;
}

export function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <ColorModeManager />
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<MainApp />} />
              <Route path="/register" element={<Register />} />
              <Route path="/donate" element={<Donate />} />
              <Route path="/thank-you" element={<ThankYou />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}

export default App 