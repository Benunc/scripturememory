import { Box, Button, Heading, Text, VStack, useToast, Card, CardBody, Badge, HStack, Flex } from '@chakra-ui/react';
import { useState } from 'react';

const DEFAULT_VERSES = [
  {
    reference: 'John 3:16',
    text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    status: 'not_started' as const
  },
  {
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ who strengthens me.',
    status: 'not_started' as const
  },
  {
    reference: 'Jeremiah 29:11',
    text: 'For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future.',
    status: 'not_started' as const
  },
  {
    reference: 'Romans 8:28',
    text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',
    status: 'not_started' as const
  }
];

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
    <Box>
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <HStack justify="space-between" align="center">
          <Heading as="h1" size="xl">Scripture Memory</Heading>
          {onSignOut ? (
            <Button onClick={onSignOut} colorScheme="red" size="sm">
              Sign Out
            </Button>
          ) : (
            <Button onClick={onSignIn} colorScheme="blue" size="sm">
              Sign In
            </Button>
          )}
        </HStack>
      </Box>
      <Box as="main" p={8}>
        <VStack spacing={8} align="stretch">
          <VStack spacing={4} align="center">
            <Heading as="h2" size="lg">Welcome to Scripture Memory!</Heading>
            <Text fontSize="lg" textAlign="center">
              Start your journey of memorizing God's Word with these sample verses.
            </Text>
            <Text fontSize="md" textAlign="center" color="gray.600">
              Upgrade to a paid plan to save your progress and track your memorization journey!
            </Text>
          </VStack>

          <VStack spacing={4} align="stretch">
            {DEFAULT_VERSES.map((verse) => (
              <Card 
                key={verse.reference}
                cursor="pointer"
                _hover={{ transform: 'translateY(-2px)', shadow: 'md' }}
                transition="all 0.2s"
              >
                <CardBody>
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Heading size="md">{verse.reference}</Heading>
                      <Badge colorScheme="blue">Sample Verse</Badge>
                    </HStack>
                    <Text>{renderVerseText(verse)}</Text>
                    <Flex gap={2} wrap="wrap">
                      {activeVerseId !== verse.reference ? (
                        <Button
                          size="sm"
                          colorScheme="blue"
                          onClick={() => handleStart(verse.reference)}
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
                            >
                              Reset
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              colorScheme="green"
                              onClick={() => handleShowHint(verse.reference)}
                            >
                              Show Next Word
                            </Button>
                          )}
                          <Button
                            size="sm"
                            colorScheme="purple"
                            onClick={() => handleShowVerse(verse.reference)}
                          >
                            {showFullVerse[verse.reference] ? 'Hide Verse' : 'Show Verse'}
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="teal"
                            isDisabled
                            onClick={() => {
                              toast({
                                title: "Premium Feature",
                                description: "Upgrade to save your progress and track your memorization journey!",
                                status: "info",
                                duration: 5000,
                                isClosable: true,
                              });
                            }}
                          >
                            Save Progress
                          </Button>
                        </>
                      )}
                    </Flex>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </VStack>

          <VStack spacing={4} align="center" pt={4}>
            <Button 
              colorScheme="blue" 
              size="lg"
              onClick={() => {
                toast({
                  title: "Upgrade to Premium",
                  description: "Contact ben@benandjacq.com to get started with your premium plan!",
                  status: "info",
                  duration: 5000,
                  isClosable: true,
                });
              }}
            >
              Upgrade to Premium
            </Button>
            {userEmail && (
              <Text fontSize="sm" color="gray.500">
                Your email: {userEmail}
              </Text>
            )}
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
} 