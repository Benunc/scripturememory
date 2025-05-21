import React, { useEffect, useState } from 'react';
import {
  Box,
  Text,
  Button,
  Flex,
  useToast,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { getVerses, updateVerseStatus } from '../utils/sheets';
import { fetchUserEmail, sanitizeVerseText } from '../utils/auth';

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

  useEffect(() => {
    const fetchVerses = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const email = await fetchUserEmail();
        
        const verses = await getVerses(email);
        
        setVerses(verses);
      } catch (error) {
        console.error('Error fetching verses:', error);
        setError(error instanceof Error ? error.message : 'Failed to fetch verses');
      } finally {
        setLoading(false);
      }
    };

    fetchVerses();
  }, []);

  const handleStatusChange = async (reference: string, newStatus: ProgressStatus) => {
    try {
      const email = await fetchUserEmail();
      await updateVerseStatus(email, reference, newStatus);

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

  const renderVerse = (verse: Verse) => {
    const sanitizedText = sanitizeVerseText(verse.text);
    return (
      <div key={verse.reference} className="verse-item">
        <div className="verse-reference">{verse.reference}</div>
        <div className="verse-text">{sanitizedText}</div>
        <div className="verse-status">
          <select
            value={verse.status}
            onChange={(e) => handleStatusChange(verse.reference, e.target.value as ProgressStatus)}
          >
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Memorized">Memorized</option>
          </select>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Box p={4}>
        <Text>Loading verses...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color="red.500">Error: {error}</Text>
      </Box>
    );
  }

  if (verses.length === 0) {
    return (
      <Box p={4}>
        <Text>No verses added yet. Add your first verse above!</Text>
      </Box>
    );
  }

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        {verses.map((verse) => (
          <Box
            key={verse.reference}
            p={4}
            borderWidth="1px"
            borderRadius="md"
            borderColor="gray.200"
            _hover={{ borderColor: 'blue.500' }}
          >
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="bold">{verse.reference}</Text>
              <Text>{renderVerseText(verse)}</Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  colorScheme={verse.status === ProgressStatus.NotStarted ? 'blue' : 'gray'}
                  onClick={() => handleStatusChange(verse.reference, ProgressStatus.NotStarted)}
                >
                  Not Started
                </Button>
                <Button
                  size="sm"
                  colorScheme={verse.status === ProgressStatus.InProgress ? 'orange' : 'gray'}
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
              </HStack>
            </VStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}; 