import { Box, Button, Heading, Text, VStack, Link, Flex } from '@chakra-ui/react'
import { useState } from 'react'
import { PrivacyPolicy } from './PrivacyPolicy'

interface IntroProps {
  onLogin: () => void;
}

export const Intro = ({ onLogin }: IntroProps) => {
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
    <Box>
      <Box as="header">
        <Heading as="h1" size="xl">Scripture Memory</Heading>
      </Box>
      <Box as="main" p={8}>
        <VStack spacing={6} align="stretch" maxW="600px" mx="auto">
          <Text fontSize="lg">
            Welcome to Scripture Memory! This app helps you track your scripture memory progress.
          </Text>
          <Text>
            To get started:
          </Text>
          <Box pl={4}>
            <Text>1. Sign in with your Google account</Text>
            <Text>2. Request access from the administrator</Text>
            <Text>3. Once approved, you'll get your own space to track your verses</Text>
          </Box>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={onLogin}
          >
            Sign in with Google
          </Button>
          <Text fontSize="sm" textAlign="center" mt={4}>
            By signing in, you agree to our{' '}
            <Link 
              color="blue.500" 
              textDecoration="underline" 
              onClick={() => setShowPrivacyPolicy(true)}
            >
              Privacy Policy
            </Link>
          </Text>

          <Box mt={8}>
            <Text fontSize="lg" mb={4}>
              Here's how it works:
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
                    isDisabled
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    isDisabled
                  >
                    Mastered
                  </Button>
                </Flex>
              </VStack>
            </Box>
            <Text fontSize="sm" opacity={0.7} textAlign="center" mt={4}>
              Try it out! Click "Start Memorizing" to begin practicing this verse.
            </Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  )
} 