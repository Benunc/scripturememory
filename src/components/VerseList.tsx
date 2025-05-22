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
  Badge,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { getVerses, updateVerseStatus, deleteVerse } from '../utils/sheets';
import { fetchUserEmail, sanitizeVerseText } from '../utils/auth';
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';
import { db } from '../utils/db';
import { syncService } from '../utils/sync';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { Footer } from './Footer';

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
  const hasUnsavedChanges = useUnsavedChanges();
  const [pendingChanges, setPendingChanges] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const fetchVerses = async () => {
    if (!userEmail || !isAuthenticated) {
      setVerses([]);
      setLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);

      // Initialize database if needed
      await db.init();
      
      // Set user email in sync service
      syncService.setUserEmail(userEmail);

      // Try to get verses from local database first
      let localVerses = await db.getVerses();

      // If no local verses, fetch from server and store locally
      if (localVerses.length === 0) {
        const serverVerses = await getVerses(userEmail);
        for (const verse of serverVerses) {
          await db.addVerse(verse);
        }
        localVerses = serverVerses;
      }

      setVerses(localVerses);
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

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = syncService.onStatusChange((status) => {
      if (status === 'syncing') {
        toast({
          title: 'Syncing changes...',
          description: 'Your changes are being saved to the cloud.',
          duration: 2000,
        });
      } else if (status === 'error') {
        toast({
          title: 'Sync failed',
          description: 'Your changes are saved locally and will sync when possible.',
          variant: 'destructive',
          duration: 4000,
        });
      } else if (status === 'rate_limited') {
        toast({
          title: 'Rate limited',
          description: 'Taking a short break to avoid overwhelming the server. Your changes are safe.',
          duration: 3000,
        });
      }
    });

    return () => unsubscribe();
  }, [toast]);

  // Check for pending changes periodically
  useEffect(() => {
    const checkPendingChanges = async () => {
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);
    };

    const interval = setInterval(checkPendingChanges, 5000);
    return () => clearInterval(interval);
  }, []);

  // Show save toast when there are pending changes
  useEffect(() => {
    const TOAST_ID = 'save-changes-toast';
    
    if (pendingChanges > 0 && !isSaving) {
      // Update existing toast or create new one
      if (toast.isActive(TOAST_ID)) {
        toast.update(TOAST_ID, {
          title: 'Changes Pending',
          description: (
            <Flex alignItems="center" gap={4}>
              <Text>Keep memorizing, and when you're ready, save all the status changes you made above</Text>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                loadingText="Saving..."
                colorScheme="blue"
                size="md"
              >
                Save Changes
              </Button>
            </Flex>
          ),
        });
      } else {
        toast({
          id: TOAST_ID,
          title: 'Changes Pending',
          description: (
            <Flex alignItems="center" gap={4}>
              <Text>Keep memorizing, and when you're ready, save all the status changes you made above</Text>
              <Button
                onClick={handleSave}
                isLoading={isSaving}
                loadingText="Saving..."
                colorScheme="blue"
                size="md"
              >
                Save Changes
              </Button>
            </Flex>
          ),
          status: 'info',
          duration: null, // Make it persistent
          isClosable: false,
          position: 'bottom',
          containerStyle: {
            width: '100%',
            maxWidth: '100%',
            margin: '0',
            padding: '1rem',
          },
        });
      }
    } else if (pendingChanges === 0) {
      // Remove the toast if there are no pending changes
      toast.close(TOAST_ID);
    }
  }, [pendingChanges, isSaving]);

  // Handle manual save
  const handleSave = async () => {
    try {
      setIsSaving(true);
      await syncService.manualSync();
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);
      
      // Close the persistent toast
      toast.close('save-changes-toast');
      
      // Show success toast
      toast({
        title: 'Success',
        description: 'Changes saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
        position: 'bottom',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
        position: 'bottom',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (reference: string, newStatus: ProgressStatus) => {
    if (!userEmail) {
      debug.error('verses', 'Cannot update status: user email is null');
      return;
    }

    try {
      // Update local state immediately
      setVerses(prevVerses =>
        prevVerses.map(verse =>
          verse.reference === reference
            ? { ...verse, status: newStatus }
            : verse
        )
      );

      // Get existing pending changes
      const pendingChanges = await db.getPendingChanges();
      
      // Check if there's already a status update for this verse
      const existingStatusUpdate = pendingChanges.find(
        change => change.type === 'STATUS_UPDATE' && change.verseReference === reference
      );

      if (existingStatusUpdate && existingStatusUpdate.id) {
        // Update the existing status change instead of creating a new one
        await db.updatePendingChange(existingStatusUpdate.id, {
          type: 'STATUS_UPDATE',
          verseReference: reference,
          newStatus,
          timestamp: Date.now(),
          synced: false,
        });
      } else {
        // Add new status change if none exists
        await db.addPendingChange({
          type: 'STATUS_UPDATE',
          verseReference: reference,
          newStatus,
          timestamp: Date.now(),
        });
      }

      // Update pending changes count
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);
    } catch (error) {
      console.error('Error updating verse status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update verse status. Please try again.',
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
      } else if (activeVerseId === reference) {
        // If this is the first time showing the verse after clicking Start Memorizing
        const verse = verses.find(v => v.reference === reference);
        if (verse && verse.status === ProgressStatus.NotStarted) {
          handleStatusChange(reference, ProgressStatus.InProgress);
        }
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

      // Delete from local database first
      await db.deleteVerse(verseToDelete);
      
      // Add to pending changes
      await db.addPendingChange({
        type: 'DELETE_VERSE',
        verseReference: verseToDelete,
        timestamp: Date.now(),
      });

      // Update UI immediately
      setVerses(prev => prev.filter(v => v.reference !== verseToDelete));

      // Update pending changes count
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);

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

  const handleAddVerse = async (verseData: Omit<Verse, 'dateAdded'>) => {
    try {
      // Add to local database first
      const verseWithDate = {
        ...verseData,
        dateAdded: new Date().toISOString(),
      };
      await db.addVerse(verseWithDate);

      // Add to pending changes
      await db.addPendingChange({
        type: 'ADD_VERSE',
        verseReference: verseData.reference,
        timestamp: Date.now(),
      });

      // Update pending changes count
      const count = await syncService.getPendingChangesCount();
      setPendingChanges(count);

      // Refresh verses list
      await fetchVerses();
    } catch (error) {
      console.error('Error adding verse:', error);
      toast({
        title: 'Error',
        description: 'Failed to add verse. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
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
    <Box w="100%">
      <VStack spacing={4} align="stretch" mb={8}>
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
              <Box 
                minH={{ base: "6em", md: "4em" }}
                display="flex" 
                alignItems="center"
                lineHeight="1.5"
              >
                <Text>{renderVerseText(verse)}</Text>
              </Box>
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