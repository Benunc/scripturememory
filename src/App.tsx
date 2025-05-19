import { Box, Heading } from '@chakra-ui/react'
import { useState } from 'react'
import './App.css'
import { AddVerse } from './components/AddVerse'
import { VerseList } from './components/VerseList'

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleVerseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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