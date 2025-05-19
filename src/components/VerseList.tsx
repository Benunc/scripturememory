import React, { useEffect, useState } from 'react';
import {
  Box,
  Text,
  Button,
  Flex,
  useToast,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { testSheetsConnection, updateVerseStatus } from '../utils/sheets';

interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  dateAdded: string;
}

const DEFAULT_VERSE: Verse = {
  reference: 'John 3:16',
  text: 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
  status: ProgressStatus.NotStarted,
  dateAdded: new Date().toISOString(),
};

export const VerseList: React.FC = () => {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVerseId, setActiveVerseId] = useState<string | null>(null);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const fetchVerses = async () => {
    try {
      const values = await testSheetsConnection();
      console.log('Google Sheets response:', values);

      if (!values || values.length === 0) {
        setVerses([DEFAULT_VERSE]);
        setError(null);
        return;
      }

      const formattedVerses = values.map((row: any[]) => ({
        reference: row[0] || '',
        text: row[1] || '',
        status: (row[2] as ProgressStatus) || ProgressStatus.NotStarted,
        dateAdded: row[3] || new Date().toISOString(),
      }));
      setVerses(formattedVerses);
      setError(null);
    } catch (err) {
      console.error('Error fetching verses:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch verses');
      toast({
        title: 'Error',
        description: 'Failed to fetch verses. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerses();
  }, []);

  const handleStatusChange = async (reference: string, newStatus: ProgressStatus) => {
    try {
      const rowIndex = verses.findIndex(v => v.reference === reference) + 2;
      await updateVerseStatus(rowIndex, newStatus);

      setVerses(prevVerses =>
        prevVerses.map(verse =>
          verse.reference === reference
            ? { ...verse, status: newStatus }
            : verse
        )
      );

      toast({
        title: 'Status updated',
        description: 'Verse status has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleStart = (reference: string) => {
    setActiveVerseId(reference);
    setRevealedWords([]);
    setShowFullVerse({});
  };

  const handleShowHint = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
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
      
      // If we're hiding the verse, reset the revealed words
      if (newState[reference] === false) {
        setRevealedWords([]);
      }
      
      return newState;
    });
  };

  const renderVerseText = (verse: Verse) => {
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

  if (loading) {
    return <Text>Loading verses...</Text>;
  }

  if (error) {
    return <Text color="red.500">Error: {error}</Text>;
  }

  return (
    <Box>
      {verses.map((verse) => (
        <Box
          key={verse.reference}
          p={4}
          borderWidth={1}
          borderRadius="lg"
          mb={4}
        >
          <Text fontWeight="bold" mb={2}>
            {verse.reference}
          </Text>
          <Text mb={4}>{renderVerseText(verse)}</Text>
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
                  <>
                    <Button
                      size="sm"
                      colorScheme="purple"
                      onClick={() => handleShowHint(verse.reference)}
                    >
                      Show Hint
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="teal"
                      onClick={() => handleShowVerse(verse.reference)}
                    >
                      {showFullVerse[verse.reference] ? 'Hide Verse' : 'Show Verse'}
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              size="sm"
              colorScheme={verse.status === ProgressStatus.InProgress ? 'blue' : 'gray'}
              onClick={() => handleStatusChange(verse.reference, ProgressStatus.InProgress)}
            >
              In Progress
            </Button>
            <Button
              size="sm"
              colorScheme={verse.status === ProgressStatus.Mastered ? 'green' : 'gray'}
              onClick={() => handleStatusChange(verse.reference, ProgressStatus.Mastered)}
            >
              Mastered
            </Button>
          </Flex>
        </Box>
      ))}
    </Box>
  );
}; 