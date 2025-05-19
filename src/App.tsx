import React, { useState } from 'react'
import { ChakraProvider, Container, Heading, Flex, Box } from '@chakra-ui/react'
import { VerseList } from './components/VerseList'
import { AddVerse } from './components/AddVerse'

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleVerseAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <ChakraProvider>
      <Container maxW="container.md" py={8}>
        <Flex direction="column" gap={8}>
          <Heading as="h1" size="xl" textAlign="center">
            Scripture Memory
          </Heading>
          <Box>
            <AddVerse onVerseAdded={handleVerseAdded} />
          </Box>
          <VerseList key={refreshTrigger} />
        </Flex>
      </Container>
    </ChakraProvider>
  )
}

export default App 