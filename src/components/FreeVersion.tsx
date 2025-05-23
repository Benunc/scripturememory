import { Box, Button, Heading, Text, VStack, useToast, Card, CardBody, Badge, HStack, Flex } from '@chakra-ui/react';
import { useState } from 'react';
import { sampleVerses } from '../utils/sampleVerses';
import { Footer } from './Footer';
import logo from '/assets/images/ScriptureMemory.svg';
import { createMailtoLink } from '../utils/auth';

const DEFAULT_VERSES = sampleVerses;

interface FreeVersionProps {
  userEmail?: string;
  onSignOut?: () => void;
  onSignIn?: () => void;
}

export function FreeVersion({ userEmail, onSignOut, onSignIn }: FreeVersionProps) {
  const [activeVerseId, setActiveVerseId] = useState<string | null>(null);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const handleStart = (reference: string) => {
    setActiveVerseId(reference);
    setRevealedWords([]);
    setShowFullVerse({});
  };

  const handleShowHint = (reference: string) => {
    const verse = DEFAULT_VERSES.find(v => v.reference === reference);
    if (!verse) return;

    const words = verse.text.split(' ');
    const nextWordIndex = revealedWords.length;
    if (nextWordIndex < words.length) {
      setRevealedWords(prev => [...prev, nextWordIndex]);
    }
  };

  const handleReset = (reference: string) => {
    setRevealedWords([]);
    setShowFullVerse(prev => ({
      ...prev,
      [reference]: false,
    }));
  };

  const handleShowVerse = (reference: string) => {
    setShowFullVerse(prev => {
      const newState = {
        ...prev,
        [reference]: !prev[reference],
      };
      
      if (newState[reference] === false) {
        setRevealedWords([]);
      }
      
      return newState;
    });
  };

  const renderVerseText = (verse: typeof DEFAULT_VERSES[0]) => {
    if (showFullVerse[verse.reference]) {
      return verse.text;
    }

    if (activeVerseId !== verse.reference) {
      return verse.text.split(' ').map(() => '_____').join(' ');
    }

    return verse.text.split(' ').map((word, index) => {
      if (revealedWords.includes(index)) {
        return word;
      }
      return '_____';
    }).join(' ');
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <Flex justify="space-between" align="center">
          <Flex align="center" gap={4}>
            <img 
              src={logo}
              alt="Scripture Memory" 
              style={{ height: '40px' }}
            />
            <Heading size="lg">Scripture Memory</Heading>
          </Flex>
          {onSignOut ? (
            <Button onClick={onSignOut} colorScheme="red" size="sm">
              Sign Out
            </Button>
          ) : (
            <Button onClick={onSignIn} colorScheme="blue" size="sm">
              Sign In
            </Button>
          )}
        </Flex>
      </Box>
      <Box as="main" flex="1" w="100%">
        <VStack spacing={8} align="stretch" p={4}>
          <VStack spacing={4} align="center" bg="chakra-subtle-bg" p={8} borderRadius="lg" shadow="md">
            <Heading as="h2" size="lg" color="chakra-body-text">Welcome to Scripture Memory!</Heading>
            <Text fontSize="lg" textAlign="center" color="chakra-body-text" opacity={0.8}>
              Start your journey of memorizing God's Word with these sample verses.
            </Text>
            {userEmail ? (
              <VStack spacing={2}>
                <Text fontSize="md" textAlign="center" color="chakra-body-text" opacity={0.6}>
                  You're signed in as {userEmail}
                </Text>
                <Text fontSize="md" textAlign="center" color="orange.500">
                  Your account is pending approval. You can still practice with these sample verses while you wait.
                </Text>
                <Text fontSize="sm" textAlign="center" color="chakra-body-text" opacity={0.6}>
                  Once approved, you'll be able to add your own verses and track your progress.
                </Text>
                <Text fontSize="sm" textAlign="center" color="chakra-body-text" opacity={0.6}>
                  Contact {createMailtoLink('ben@benandjacq.com')} to request approval.
                </Text>
              </VStack>
            ) : (
              <Text fontSize="md" textAlign="center" color="chakra-body-text" opacity={0.6}>
                Sign in to save your progress, add your own verses, and track your memorization journey!
              </Text>
            )}
          </VStack>

          <VStack spacing={4} align="stretch">
            {DEFAULT_VERSES.map((verse) => (
              <Box
                key={verse.reference}
                p={4}
                borderWidth="1px"
                borderRadius="md"
                borderColor="gray.200"
                _hover={{ borderColor: 'blue.500' }}
                role="article"
                aria-labelledby={`free-verse-${verse.reference}`}
              >
                <VStack align="stretch" spacing={2}>
                  <Flex justify="space-between" align="center">
                    <Text fontWeight="bold" id={`free-verse-${verse.reference}`}>{verse.reference}</Text>
                    <Badge colorScheme="blue">Sample Verse</Badge>
                  </Flex>
                  <Box 
                    minH={{ base: "6em", md: "4em" }}
                    display="flex" 
                    alignItems="center"
                    lineHeight="1.5"
                    role="region"
                    aria-label={`Verse text for ${verse.reference}`}
                  >
                    <Text>{renderVerseText(verse)}</Text>
                  </Box>
                  <Flex gap={2} wrap="wrap" role="toolbar" aria-label={`Controls for ${verse.reference}`}>
                    {activeVerseId !== verse.reference ? (
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={() => handleStart(verse.reference)}
                        aria-label={`Start memorizing ${verse.reference}`}
                      >
                        Start Memorizing
                      </Button>
                    ) : (
                      <>
                        {revealedWords.length >= verse.text.split(' ').length ? (
                          <Button
                            size="sm"
                            colorScheme="orange"
                            onClick={() => handleReset(verse.reference)}
                            aria-label={`Reset memorization for ${verse.reference}`}
                          >
                            Reset
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              colorScheme="purple"
                              onClick={() => handleShowHint(verse.reference)}
                              aria-label={`Show next word for ${verse.reference}`}
                            >
                              Show Hint
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="teal"
                              onClick={() => handleShowVerse(verse.reference)}
                              aria-label={`${showFullVerse[verse.reference] ? 'Hide' : 'Show'} full verse for ${verse.reference}`}
                            >
                              {showFullVerse[verse.reference] ? 'Hide Verse' : 'Show Verse'}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </Flex>
                </VStack>
              </Box>
            ))}
          </VStack>

          <VStack spacing={4} align="center" pt={4}>
            {userEmail ? (
              <Button 
                colorScheme="red" 
                size="lg"
                onClick={onSignOut}
              >
                Sign Out
              </Button>
            ) : (
              <Button 
                colorScheme="blue" 
                size="lg"
                onClick={() => {
                  toast({
                    title: "Sign In",
                    description: "Sign in to save your progress, add your own verses, and track your memorization journey!",
                    status: "info",
                    duration: 5000,
                    isClosable: true,
                  });
                  onSignIn?.();
                }}
              >
                Sign In
              </Button>
            )}
          </VStack>
        </VStack>
      </Box>
      <Box w="100%">
        <Footer />
      </Box>
    </Box>
  );
} 