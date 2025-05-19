import { Box, Heading } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import './App.css'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'
import { Intro } from './components/Intro'
import { getAccessToken } from './utils/sheets'

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Check localStorage on initial load
    return localStorage.getItem('google_access_token') !== null;
  });

  const handleVerseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogin = async () => {
    try {
      await getAccessToken();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (!isAuthenticated) {
    return <Intro onLogin={handleLogin} />;
  }

  return (
    <Box className="App">
      <Box as="header" className="App-header">
        <Heading as="h1" size="xl">Scripture Memory</Heading>
      </Box>
      <Box as="main">
        <AddVerse onVerseAdded={handleVerseAdded} />
        <VerseList key={refreshTrigger} />
      </Box>
    </Box>
  )
}

export default App 