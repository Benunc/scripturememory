import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  Badge,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';
import { useVerses } from '../hooks/useVerses';
import { Footer } from './Footer';

interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  lastReviewed: string;
}

export interface VerseListRef {
  scrollToVerse: (reference: string) => void;
}

interface VerseListProps {
  verses: Verse[];
  loading: boolean;
  error: Error | string | null;
  onStatusChange: (reference: string, newStatus: ProgressStatus) => Promise<void>;
  onDelete: (reference: string) => Promise<void>;
}

export const VerseList = forwardRef<VerseListRef, VerseListProps>((props, ref) => {
  const { verses, loading, error, onStatusChange, onDelete } = props;
  const [activeVerseId, setActiveVerseId] = useState<string | null>(null);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const { userEmail, isAuthenticated } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [verseToDelete, setVerseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Expose scrollToVerse through ref
  useImperativeHandle(ref, () => ({
    scrollToVerse: (reference: string) => {
      const verseElement = verseRefs.current[reference];
      if (verseElement) {
        verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the verse briefly
        verseElement.style.transition = 'background-color 0.5s';
        verseElement.style.backgroundColor = 'rgba(66, 153, 225, 0.1)';
        setTimeout(() => {
          verseElement.style.backgroundColor = '';
        }, 2000);
      }
    }
  }));

  const handleStatusChange = async (reference: string, newStatus: ProgressStatus, showToast = true) => {
    if (!userEmail) {
      debug.error('verses', 'Cannot update status: user email is null');
      return;
    }

    try {
      await onStatusChange(reference, newStatus);
      if (showToast) {
        toast({
          title: "Success",
          description: "Verse status updated",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error updating verse status:', error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to update verse status",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
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
      
      // Update status to In Progress on first word reveal if Not Started
      if (nextWordIndex === 0 && verse.status === ProgressStatus.NotStarted) {
        void handleStatusChange(reference, ProgressStatus.InProgress, false);
      }
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
      } else if (activeVerseId === reference) {
        // If this is the first time showing the verse after clicking Start Memorizing
        const verse = verses.find(v => v.reference === reference);
        if (verse && verse.status === ProgressStatus.NotStarted) {
          void handleStatusChange(reference, ProgressStatus.InProgress, false);
        }
      }
      
      return newState;
    });
  };

  const handleManualStatusChange = (reference: string, newStatus: ProgressStatus) => {
    void handleStatusChange(reference, newStatus, true);
  };

  const handleDeleteClick = (reference: string) => {
    setVerseToDelete(reference);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!verseToDelete) return;

    try {
      setIsDeleting(true);
      await onDelete(verseToDelete);
    } catch (error) {
      debug.error('verses', 'Error deleting verse:', error);
      toast({
        title: "Error",
        description: "Failed to delete verse",
        status: "error",
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
        <Text color="red.500">Error: {error instanceof Error ? error.message : String(error)}</Text>
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
    <Box w="100%">
      <VStack spacing={4} align="stretch" mb={8}>
        {verses.map((verse) => (
          <Box
            key={`${verse.reference}-${verse.lastReviewed}`}
            ref={el => verseRefs.current[verse.reference] = el}
            p={4}
            borderWidth="1px"
            borderRadius="lg"
            position="relative"
          >
            <VStack align="stretch" spacing={2}>
              <Flex justify="space-between" align="center">
                <Text fontWeight="bold" id={`verse-${verse.reference}`}>{verse.reference}</Text>
                <Text
                  as="button"
                  color="red.500"
                  fontWeight="bold"
                  onClick={() => handleDeleteClick(verse.reference)}
                  _hover={{ color: 'red.600' }}
                  cursor="pointer"
                  aria-label={`Delete verse ${verse.reference}`}
                >
                  Delete
                </Text>
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
              <Flex gap={2} wrap="wrap" role="toolbar" aria-label={`Controls for ${verse.reference}`} justify="space-between">
                <Flex gap={2} wrap="wrap">
                  {activeVerseId !== verse.reference ? (
                    <Button
                      size="sm"
                      variant="solid"
                      onClick={() => handleStart(verse.reference)}
                      aria-label={`Start memorizing ${verse.reference}`}
                    >
                      Start Memorizing
                    </Button>
                  ) : (
                    <>
                      {!showFullVerse[verse.reference] && revealedWords.length < verse.text.split(' ').length && (
                        <Button
                          size="sm"
                          variant="solid"
                          onClick={() => handleShowHint(verse.reference)}
                          aria-label={`Show next word for ${verse.reference}`}
                        >
                          Show Next Word
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          handleReset(verse.reference);
                          setActiveVerseId(null);
                        }}
                        aria-label={`Reset ${verse.reference}`}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleShowVerse(verse.reference)}
                        aria-label={`Show full verse for ${verse.reference}`}
                      >
                        {showFullVerse[verse.reference] ? 'Hide Verse' : 'Show Full Verse'}
                      </Button>
                    </>
                  )}
                </Flex>
                <Flex gap={2} wrap="wrap">
                  <Button
                    size="sm"
                    variant="not-started"
                    onClick={() => handleManualStatusChange(verse.reference, ProgressStatus.NotStarted)}
                    aria-label={`Mark ${verse.reference} as not started`}
                    aria-pressed={verse.status === ProgressStatus.NotStarted}
                  >
                    Not Started
                  </Button>
                  <Button
                    size="sm"
                    variant="in-progress"
                    onClick={() => handleManualStatusChange(verse.reference, ProgressStatus.InProgress)}
                    aria-label={`Mark ${verse.reference} as in progress`}
                    aria-pressed={verse.status === ProgressStatus.InProgress}
                  >
                    In Progress
                  </Button>
                  <Button
                    size="sm"
                    variant="mastered"
                    onClick={() => handleManualStatusChange(verse.reference, ProgressStatus.Mastered)}
                    aria-label={`Mark ${verse.reference} as mastered`}
                    aria-pressed={verse.status === ProgressStatus.Mastered}
                  >
                    Mastered
                  </Button>
                </Flex>
              </Flex>
            </VStack>
          </Box>
        ))}
      </VStack>

      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setVerseToDelete(null);
        }}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Verse
            </AlertDialogHeader>

            <AlertDialogBody>
              {verseToDelete && (
                <>
                  <Text>Are you sure you want to delete this verse? This action cannot be undone.</Text>
                  <Box mt={4} p={3} bg="gray.50" borderRadius="md">
                    <Text fontWeight="bold">Reference:</Text>
                    <Text>{verseToDelete}</Text>
                    <Text fontWeight="bold" mt={2}>Text:</Text>
                    <Text>{verses.find(v => v.reference === verseToDelete)?.text}</Text>
                  </Box>
                </>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => {
                setIsDeleteDialogOpen(false);
                setVerseToDelete(null);
              }}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDeleteConfirm}
                ml={3}
                isLoading={isDeleting}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}); 