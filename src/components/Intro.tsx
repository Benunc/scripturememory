import { Box, Button, Heading, Text, VStack, Link, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { PrivacyPolicy } from './PrivacyPolicy'

interface IntroProps {
  onSignIn: () => Promise<void>;
}

export function Intro({ onSignIn }: IntroProps) {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [isExampleActive, setIsExampleActive] = useState(false);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState(false);

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

  if (showPrivacyPolicy) {
    return <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />;
  }

  return (
    <Box className="App">
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <Heading as="h1" size="xl">Scripture Memory</Heading>
      </Box>
      <Box as="main" p={8}>
        <VStack spacing={6} align="center">
          <Text fontSize="lg" textAlign="center">
            Welcome to Scripture Memory!
          </Text>
          <Text>
            This app helps you track your scripture memory progress. Each user gets their own space to add and track verses they're memorizing.
          </Text>
          <Box 
            p={4} 
            borderWidth="1px" 
            borderRadius="md" 
            borderColor="chakra-border-color"
            bg="chakra-body-bg"
            color="chakra-body-text"
            width="100%"
            maxW="600px"
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
              </Flex>
            </VStack>
          </Box>
          <Button onClick={onSignIn} colorScheme="blue">
            Sign in with Google
          </Button>
          <Text fontSize="sm" opacity={0.7} textAlign="center">
            By signing in, you agree to our{' '}
            <Link color="blue.500" onClick={() => setShowPrivacyPolicy(true)}>
              Privacy Policy
            </Link>
          </Text>
        </VStack>
      </Box>
    </Box>
  )
} 