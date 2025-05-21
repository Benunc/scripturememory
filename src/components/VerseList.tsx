import React, { useEffect, useState } from 'react';
import {
  Box,
  Text,
  Button,
  Flex,
  useToast,
  VStack,
  HStack,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { getVerses, updateVerseStatus, deleteVerse } from '../utils/sheets';
import { fetchUserEmail, sanitizeVerseText } from '../utils/auth';
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';

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
  const { userEmail, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [verseToDelete, setVerseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  const fetchVerses = async () => {
    if (!userEmail || !isAuthenticated) {
      setVerses([]);
      setLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const verses = await getVerses(userEmail);
      setVerses(verses);
      setLastRefreshTime(new Date());
    } catch (error) {
      debug.error('verses', 'Error fetching verses:', error);
      toast({
        title: handleError.verses.fetchFailed().title,
        description: handleError.verses.fetchFailed().description,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Fetch verses when user email is available and authenticated
  useEffect(() => {
    fetchVerses();
  }, [userEmail, isAuthenticated]);

  const handleStatusChange = async (reference: string, newStatus: string) => {
    if (!userEmail) {
      debug.error('verses', 'Cannot update status: user email is null');
      return;
    }

    try {
      await updateVerseStatus(userEmail, reference, newStatus);
      await fetchVerses();
    } catch (error) {
      debug.error('verses', 'Error updating verse status:', error);
      toast({
        title: handleError.verses.updateFailed().title,
        description: handleError.verses.updateFailed().description,
        status: 'error',
        duration: 5000,
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

  const handleDeleteClick = (reference: string) => {
    setVerseToDelete(reference);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!verseToDelete || !userEmail || isDeleting) {
      debug.error('verses', 'Cannot delete verse: missing reference, user email, or already deleting');
      return;
    }

    try {
      setIsDeleting(true);
      await deleteVerse(userEmail, verseToDelete);
      await fetchVerses();
      toast({
        title: 'Verse deleted',
        description: 'The verse has been permanently deleted.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      debug.error('verses', 'Error deleting verse:', error);
      toast({
        title: handleError.verses.deleteFailed().title,
        description: handleError.verses.deleteFailed().description,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setVerseToDelete(null);
    }
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
              <Flex justify="space-between" align="center">
                <Text fontWeight="bold">{verse.reference}</Text>
                <Text
                  as="button"
                  color="red.500"
                  fontWeight="bold"
                  onClick={() => handleDeleteClick(verse.reference)}
                  _hover={{ color: 'red.600' }}
                  cursor="pointer"
                >
                  Delete
                </Text>
              </Flex>
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
              </Flex>
            </VStack>
          </Box>
        ))}
      </VStack>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => !isDeleting && setIsDeleteDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Verse
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this verse? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button 
                ref={cancelRef} 
                onClick={() => setIsDeleteDialogOpen(false)}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="red" 
                onClick={handleDeleteConfirm} 
                ml={3}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}; 