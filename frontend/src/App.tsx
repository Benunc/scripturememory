import React from 'react';
import { Box, Button, HStack, Heading, Text, Avatar, useToast, VStack, Flex } from '@chakra-ui/react'
import { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { VerifyToken } from './components/VerifyToken'
import { validateEnvVariables } from './utils/auth'
import { useAuth } from './hooks/useAuth'
import { Footer } from './components/Footer'
import logo from '/assets/images/ScriptureMemory.svg'
import { useVerses } from './hooks/useVerses'
import { ChakraProvider, ColorModeScript, useColorMode } from '@chakra-ui/react';
import { AuthProvider } from './contexts/AuthContext';
import { PointsProvider } from './contexts/PointsContext';
import { Register } from './pages/Register';
import { Donate } from './pages/Donate';
import { SignIn } from './components/SignIn';
import { MainApp } from './components/App';
import { theme } from './theme';
import { ThankYou } from './pages/ThankYou';
import { About } from './pages/About';
import { Invite } from './pages/Invite';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { runTestSuite } from './utils/testSuite';
import { PointsStats } from './pages/PointsStats';
import { PointsDisplay } from './components/PointsDisplay';
import { AddVerseSet } from './pages/AddVerseSet';
import Groups from './pages/Groups';
import GroupDetails from './pages/GroupDetails';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { News } from './pages/News';
import { BlogList } from './pages/BlogList';
import { BlogPostPage } from './pages/BlogPost';
import { Changelog } from './pages/Changelog';
import { ChangelogEntryPage } from './pages/ChangelogEntry';
import { YouthGroups } from './pages/YouthGroups';
import { ChurchGroups } from './pages/ChurchGroups';


// Add type for Google client
declare global {
  interface Window {
    google: any;
    runTestSuite: typeof runTestSuite;
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

// Initialize test suite
window.runTestSuite = runTestSuite;

export function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <ColorModeManager />
        <Router>
          <AuthProvider>
            <PointsProvider>
              <Routes>
                <Route path="/" element={<MainApp />} />
                <Route path="/register" element={<Register />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/thank-you" element={<ThankYou />} />
                <Route path="/about" element={<About />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/auth/verify" element={<VerifyToken />} />
                <Route path="/points" element={<ProtectedRoute><PointsStats /></ProtectedRoute>} />
                <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
                <Route path="/add-verse-set" element={<ProtectedRoute><AddVerseSet /></ProtectedRoute>} />
                <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
                <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetails /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                
                {/* News and Content Routes */}
                <Route path="/news" element={<News />} />
                <Route path="/news/blog" element={<BlogList />} />
                <Route path="/news/blog/:slug" element={<BlogPostPage />} />
                <Route path="/news/changelog" element={<Changelog />} />
                <Route path="/news/changelog/:version" element={<ChangelogEntryPage />} />
                <Route path="/youth-groups" element={<YouthGroups />} />
                <Route path="/church-groups" element={<ChurchGroups />} />
              </Routes>
            </PointsProvider>
          </AuthProvider>
        </Router>
      </ChakraProvider>
    </>
  );
}

export default App 