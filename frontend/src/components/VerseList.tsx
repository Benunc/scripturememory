import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
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
  useColorModeValue,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Kbd,
  Input,
  Textarea,
  Collapse,
} from '@chakra-ui/react';
import { ProgressStatus } from '../utils/progress';
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';
import { useVerses } from '../hooks/useVerses';
import { Footer } from './Footer';
import { getApiUrl } from '../utils/api';

interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  lastReviewed: string;
}

// Add interface for tracking recorded words
interface RecordedWord {
  verse_reference: string;
  word_index: number;
  timestamp: number;
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
  showStatusButtons?: boolean;
}

// Add WordProgress interface
interface WordProgress {
  verse_reference: string;
  word_index: number;
  word: string;
  is_correct: boolean;
  timestamp: number;
}

// Add mastery progress interface
interface MasteryProgress {
  total_attempts: number;
  overall_accuracy: number;
  consecutive_perfect: number;
  is_mastered: boolean;
  mastery_date?: number;
}

// Update MasteryState interface
interface MasteryState {
  activeVerse: string | null;
  attempt: string;
  isSubmitting: boolean;
  feedback: {
    isCorrect: boolean;
    message: string;
  } | null;
  progress: MasteryProgress | null;
}

export const VerseList = forwardRef<VerseListRef, VerseListProps>((props, ref): JSX.Element => {
  const { verses, loading, error, onStatusChange, onDelete, showStatusButtons = true } = props;
  const [activeVerseId, setActiveVerseId] = useState<string | null>(null);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState<Record<string, boolean>>({});
  const [announcedWord, setAnnouncedWord] = useState<string>('');
  const toast = useToast();
  const { userEmail, isAuthenticated } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [verseToDelete, setVerseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [focusedVerseIndex, setFocusedVerseIndex] = useState<number>(-1);

  // Add word progress state
  const [wordProgressQueue, setWordProgressQueue] = useState<WordProgress[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Add state for tracking recorded words (only from correct guesses)
  const [recordedWords, setRecordedWords] = useState<RecordedWord[]>(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('recordedWords');
    return saved ? JSON.parse(saved) : [];
  });

  // Add function to check if word has been recorded
  const isWordRecorded = useCallback((reference: string, wordIndex: number): boolean => {
    return recordedWords.some(
      word => word.verse_reference === reference && word.word_index === wordIndex
    );
  }, [recordedWords]);

  // Add function to record a word
  const recordWord = useCallback((reference: string, wordIndex: number) => {
    setRecordedWords(prev => {
      const newRecordedWords = [
        ...prev,
        { verse_reference: reference, word_index: wordIndex, timestamp: Date.now() }
      ];
      // Save to localStorage
      localStorage.setItem('recordedWords', JSON.stringify(newRecordedWords));
      return newRecordedWords;
    });
  }, []);

  // Update syncProgress to use simple timeout-based debounce
  const syncProgress = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      if (!isAuthenticated || wordProgressQueue.length === 0 || isSyncing) return;

      setIsSyncing(true);
      try {
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken) {
          throw new Error('No session token found');
        }

        // Send word progress in batches
        const batchSize = 10;
        for (let i = 0; i < wordProgressQueue.length; i += batchSize) {
          const batch = wordProgressQueue.slice(i, i + batchSize);
          await Promise.all(
            batch.map(progress =>
              fetch('/api/progress/word', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify(progress)
              })
            )
          );
        }

        // Clear the queue after successful sync
        setWordProgressQueue([]);
        debug.log('verses', 'Word progress synced successfully');
      } catch (error) {
        debug.error('verses', 'Error syncing word progress:', error);
        toast({
          title: 'Error',
          description: 'Failed to save progress. Your progress will be saved when you try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsSyncing(false);
      }
    }, 1000);
  }, [wordProgressQueue, isAuthenticated, isSyncing, toast]);

  // Add cleanup for timeout
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Add modal state management
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'delete' | 'shortcuts' | null;
    previousFocus: HTMLElement | null;
  }>({
    isOpen: false,
    type: null,
    previousFocus: null
  });

  // Add status button state management
  const [statusButtonStates, setStatusButtonStates] = useState<Record<string, {
    isLoading: boolean;
    error: string | null;
    lastUpdated: number;
  }>>({});

  // Add delete dialog state management
  const [deleteDialogState, setDeleteDialogState] = useState<{
    isDeleting: boolean;
    error: string | null;
    lastUpdated: number;
  }>({
    isDeleting: false,
    error: null,
    lastUpdated: 0
  });

  // Add timeout and session management
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const TIMEOUT_DURATION = 3 * 60 * 60 * 1000; // 3 hours
  const WARNING_DURATION = 2 * 60 * 1000; // 2 minutes

  // Add user guess state management
  const [userGuess, setUserGuess] = useState<string>('');
  const [guessFeedback, setGuessFeedback] = useState<{
    isCorrect: boolean;
    message: string;
  } | null>(null);

  // Add input ref for focus management
  const inputRef = useRef<HTMLInputElement>(null);

  // Add mastery state
  const [masteryState, setMasteryState] = useState<MasteryState>({
    activeVerse: null,
    attempt: '',
    isSubmitting: false,
    feedback: null,
    progress: null
  });

  // Add function to get mastery progress message
  const getMasteryProgressMessage = (progress: MasteryProgress): string => {
    if (progress.is_mastered) {
      return "Congratulations! You've mastered this verse!";
    }

    const messages: string[] = [];
    
    if (progress.total_attempts < 5) {
      messages.push(`You need ${5 - progress.total_attempts} more attempts to qualify for mastery`);
    }
    
    if (progress.overall_accuracy < 0.95) {
      const accuracyPercent = Math.round(progress.overall_accuracy * 100);
      messages.push(`Your overall accuracy is ${accuracyPercent}% (need 95%)`);
    }
    
    if (progress.consecutive_perfect < 3) {
      messages.push(`You have ${progress.consecutive_perfect} consecutive perfect attempts (need 3)`);
    }

    return messages.join('. ') + '.';
  };

  // Add function to fetch mastery progress
  const fetchMasteryProgress = async (reference: string): Promise<MasteryProgress> => {
    // Check localStorage first
    const cached = localStorage.getItem(`mastery_progress_${reference}`);
    if (cached) {
      const { progress, timestamp } = JSON.parse(cached);
      // Cache for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return progress;
      }
    }

    try {
      const response = await fetch(`/api/progress/mastery/${reference}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch mastery progress');

      const progress = await response.json();
      
      // Cache the progress
      localStorage.setItem(`mastery_progress_${reference}`, JSON.stringify({
        progress,
        timestamp: Date.now()
      }));

      return progress;
    } catch (error) {
      console.error('Error fetching mastery progress:', error);
      return {
        total_attempts: 0,
        overall_accuracy: 0,
        consecutive_perfect: 0,
        is_mastered: false
      };
    }
  };

  // Update handleMasteryToggle to fetch progress
  const handleMasteryToggle = async (reference: string): Promise<void> => {
    if (masteryState.activeVerse === reference) {
      setMasteryState(prev => ({
        ...prev,
        activeVerse: null,
        attempt: '',
        feedback: null,
        progress: null
      }));
    } else {
      const progress = await fetchMasteryProgress(reference);
      setMasteryState(prev => ({
        ...prev,
        activeVerse: reference,
        attempt: '',
        feedback: null,
        progress
      }));
    }
  };

  // Update handleMasteryAttempt to update progress
  const handleMasteryAttempt = async (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    setMasteryState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const response = await fetch('/api/progress/verse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          verse_reference: reference,
          words_correct: masteryState.attempt.split(' ').filter(word => 
            verse.text.toLowerCase().includes(word.toLowerCase())
          ).length,
          total_words: verse.text.split(' ').length
        })
      });

      if (!response.ok) throw new Error('Failed to record attempt');

      const result = await response.json();
      
      // Fetch updated progress
      const progress = await fetchMasteryProgress(reference);
      
      setMasteryState(prev => ({
        ...prev,
        feedback: {
          isCorrect: result.isCorrect,
          message: result.message
        },
        attempt: '',
        progress
      }));

      if (progress.is_mastered) {
        await onStatusChange(reference, ProgressStatus.Mastered);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record attempt. Please try again.';
      setMasteryState(prev => ({
        ...prev,
        feedback: {
          isCorrect: false,
          message: errorMessage
        }
      }));
    } finally {
      setMasteryState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Update handleMasteryInput to be smarter about paste detection
  const handleMasteryInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Only block paste events that contain multiple words
    if (e.nativeEvent instanceof ClipboardEvent && 
        e.nativeEvent.clipboardData && 
        e.nativeEvent.clipboardData.getData('text').trim().split(/\s+/).length > 1) {
      e.preventDefault();
      toast({
        title: "No copy/paste allowed here!",
        description: "Gotta use your brain!",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setMasteryState(prev => ({
      ...prev,
      attempt: e.target.value,
      feedback: null
    }));
  };

  // Add mastery key handler
  const handleMasteryKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, reference: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleMasteryAttempt(reference);
    }
  };

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

  // Handle keyboard navigation between verses
  useEffect(() => {
    const handleVerseNavigation = (e: KeyboardEvent) => {
      if (isDeleteDialogOpen || isShortcutsModalOpen || document.activeElement?.tagName === 'INPUT') return;

      const verseElements = document.querySelectorAll('[role="article"]');
      if (!verseElements.length) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedVerseIndex(prev => {
            const newIndex = Math.max(0, prev - 1);
            const verseElement = verseElements[newIndex] as HTMLElement;
            verseElement.focus();
            return newIndex;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedVerseIndex(prev => {
            const newIndex = Math.min(verseElements.length - 1, prev + 1);
            const verseElement = verseElements[newIndex] as HTMLElement;
            verseElement.focus();
            return newIndex;
          });
          break;
        case 'Home':
          e.preventDefault();
          setFocusedVerseIndex(0);
          (verseElements[0] as HTMLElement).focus();
          break;
        case 'End':
          e.preventDefault();
          setFocusedVerseIndex(verseElements.length - 1);
          (verseElements[verseElements.length - 1] as HTMLElement).focus();
          break;
      }
    };

    window.addEventListener('keydown', handleVerseNavigation);
    return () => window.removeEventListener('keydown', handleVerseNavigation);
  }, [isDeleteDialogOpen, isShortcutsModalOpen, verses.length]);

  // Update keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show shortcuts help modal
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleModalOpen('shortcuts');
        return;
      }

      // Only handle shortcuts if no modal is open, no input is focused, and mastery mode is not active
      if (modalState.isOpen || document.activeElement?.tagName === 'INPUT' || masteryState.activeVerse) return;

      // Get the currently focused verse element
      const focusedVerse = document.activeElement?.closest('[role="article"]');
      if (!focusedVerse) return;

      const verseReference = focusedVerse.getAttribute('aria-labelledby')?.replace('verse-', '');
      if (!verseReference) return;

      switch (e.key) {
        case 's':
          // Start memorizing or show next word
          if (activeVerseId !== verseReference) {
            e.preventDefault();
            handleStart(verseReference);
            setAnnouncedWord('Started memorizing. Type the next word.');
          } else if (!showFullVerse[verseReference]) {
            e.preventDefault();
            const verse = verses.find(v => v.reference === verseReference);
            if (verse && revealedWords.length < verse.text.split(' ').length) {
              handleShowHint(verseReference);
            } else {
              setAnnouncedWord("All words have been revealed");
            }
          }
          break;
        case 'r':
          // Reset
          if (activeVerseId === verseReference) {
            e.preventDefault();
            handleReset(verseReference);
            setAnnouncedWord('Reset. Press S to start memorizing.');
          }
          break;
        case 'f':
          // Toggle full verse
          e.preventDefault();
          handleShowVerse(verseReference);
          setAnnouncedWord(showFullVerse[verseReference] ? 'Full verse hidden' : 'Full verse shown');
          break;
        case '1':
        case '2':
        case '3':
          // Change status (1=Not Started, 2=In Progress, 3=Mastered)
          e.preventDefault();
          const statusMap = {
            '1': ProgressStatus.NotStarted,
            '2': ProgressStatus.InProgress,
            '3': ProgressStatus.Mastered
          };
          const newStatus = statusMap[e.key as keyof typeof statusMap];
          const currentVerse = verses.find(v => v.reference === verseReference);
          if (currentVerse?.status !== newStatus) {
            handleManualStatusChange(verseReference, newStatus);
            setAnnouncedWord(`Status changed to ${newStatus}`);
          } else {
            setAnnouncedWord(`Status is already ${newStatus}`);
          }
          break;
        case 'Escape':
          // Reset current verse if active
          if (activeVerseId === verseReference) {
            e.preventDefault();
            handleReset(verseReference);
            setAnnouncedWord('Memorization reset.');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVerseId, showFullVerse, modalState.isOpen, verses, revealedWords, masteryState.activeVerse]);

  // Add keyboard shortcut hints to buttons
  const renderKeyboardShortcut = (shortcut: string) => (
    <Text as="span" fontSize="xs" ml={1} opacity={0.8}>
      ({shortcut})
    </Text>
  );

  // Add loading states for individual verse actions
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Add error state management
  const [errorStates, setErrorStates] = useState<Record<string, string>>({});

  // Update activity tracking
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  // Handle session expiration
  const handleSessionExpiration = async () => {
    try {
      // Save any pending changes
      await Promise.all(
        verses.map(async (verse) => {
          const buttonState = statusButtonStates[verse.reference];
          if (buttonState?.isLoading) {
            await onStatusChange(verse.reference, verse.status);
          }
        })
      );

      // Clear session data
      localStorage.removeItem('userEmail');
      localStorage.removeItem('token');

      // Redirect to root route with message
      const params = new URLSearchParams({
        message: 'Your session has expired. Please sign in again to continue.'
      });
      window.location.href = `/?${params.toString()}`;
    } catch (error) {
      debug.error('auth', 'Error handling session expiration:', error);
      // If saving fails, still redirect to root
      window.location.href = '/?message=Your session has expired. Please sign in again to continue.';
    }
  };

  // Add timeout warning
  useEffect(() => {
    let warningToastId: string | number | undefined;
    let countdownInterval: NodeJS.Timeout;

    const checkTimeout = () => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      const timeUntilTimeout = TIMEOUT_DURATION - timeSinceLastActivity;
      
      if (timeUntilTimeout <= WARNING_DURATION && timeUntilTimeout > 0) {
        // Only show toast if one isn't already showing
        if (!warningToastId) {
          const updateCountdown = () => {
            const remainingTime = Math.ceil((TIMEOUT_DURATION - (Date.now() - lastActivity)) / 1000);
            if (remainingTime <= 0) {
              clearInterval(countdownInterval);
              return;
            }
            
            const minutes = Math.floor(remainingTime / 60);
            const seconds = remainingTime % 60;
            
            toast.update(warningToastId!, {
              description: `Your session will expire in ${minutes}:${seconds.toString().padStart(2, '0')}. Would you like to continue?`,
            });
          };

          warningToastId = toast({
            title: "Session Timeout Warning",
            description: "Your session will expire in 2:00. Would you like to continue?",
            status: "warning",
            duration: null,
            isClosable: true,
            position: "top",
            render: () => (
              <Box
                p={3}
                bg="orange.100"
                color="orange.800"
                borderRadius="md"
                role="alert"
                aria-live="assertive"
              >
                <Text fontWeight="bold">Session Timeout Warning</Text>
                <Text>Your session will expire in 2:00. Would you like to continue?</Text>
                <Flex mt={2} gap={2}>
                  <Button
                    size="sm"
                    colorScheme="orange"
                    onClick={() => {
                      setLastActivity(Date.now());
                      toast.close(warningToastId!);
                      warningToastId = undefined;
                      clearInterval(countdownInterval);
                    }}
                  >
                    Continue Session
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleSessionExpiration();
                    }}
                  >
                    Sign Out
                  </Button>
                </Flex>
              </Box>
            ),
          });

          // Start countdown
          countdownInterval = setInterval(updateCountdown, 1000);
        }
      } else if (timeUntilTimeout <= 0) {
        // Session expired
        handleSessionExpiration();
      }
    };

    const interval = setInterval(checkTimeout, 1000); // Check every second
    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
      if (warningToastId) {
        toast.close(warningToastId);
      }
    };
  }, [lastActivity, toast, verses, statusButtonStates, onStatusChange]);

  // Update status button handler
  const handleStatusChange = async (reference: string, newStatus: ProgressStatus, showToast = true) => {
    // Skip if the status hasn't changed
    const currentVerse = verses.find(v => v.reference === reference);
    if (currentVerse?.status === newStatus) {
      return;
    }

    if (!userEmail) {
      const errorMsg = 'Cannot update status: user email is null';
      debug.error('verses', errorMsg);
      setStatusButtonStates(prev => ({
        ...prev,
        [reference]: {
          ...prev[reference],
          error: errorMsg,
          lastUpdated: Date.now()
        }
      }));
      setAnnouncedWord(errorMsg);
      return;
    }

    try {
      setStatusButtonStates(prev => ({
        ...prev,
        [reference]: {
          ...prev[reference],
          isLoading: true,
          error: null,
          lastUpdated: Date.now()
        }
      }));
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
      const errorMsg = error instanceof Error ? error.message : 'Failed to update verse status';
      debug.error('verses', 'Error updating verse status:', error);
      setStatusButtonStates(prev => ({
        ...prev,
        [reference]: {
          ...prev[reference],
          error: errorMsg,
          lastUpdated: Date.now()
        }
      }));
      setAnnouncedWord(`Error: ${errorMsg}`);
      if (showToast) {
        toast({
          title: "Error",
          description: errorMsg,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setStatusButtonStates(prev => ({
        ...prev,
        [reference]: {
          ...prev[reference],
          isLoading: false,
          lastUpdated: Date.now()
        }
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  // Update handleStart to use number[] for revealedWords
  const handleStart = (reference: string) => {
    setActiveVerseId(reference);
    setShowFullVerse({});
    
    // Get all recorded words for this verse
    const verseRecordedWords = recordedWords
      .filter(word => word.verse_reference === reference)
      .sort((a, b) => a.word_index - b.word_index);

    // Set revealed words based on recorded progress
    setRevealedWords(verseRecordedWords.map(word => word.word_index));
    
    // Focus the input field after a short delay
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Add function to find the first unrevealed word index
  const findFirstUnrevealedWordIndex = useCallback((words: string[]): number => {
    for (let i = 0; i < words.length; i++) {
      if (!revealedWords.includes(i)) {
        return i;
      }
    }
    return words.length;
  }, [revealedWords]);

  // Update handleShowHint to reveal the word
  const handleShowHint = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    const words = verse.text.split(' ');
    const nextWordIndex = findFirstUnrevealedWordIndex(words);
    
    // Ensure we don't try to reveal beyond the verse length
    if (nextWordIndex >= words.length) {
      setAnnouncedWord("All words have been revealed");
      return;
    }

    const word = words[nextWordIndex];
    const isLastWord = nextWordIndex === words.length - 1;
    const isSecondToLastWord = nextWordIndex === words.length - 2;
    
    // Different announcements based on word position
    if (nextWordIndex === 0) {
      setAnnouncedWord(`I'll reveal the next word of the verse every time you select the button. The first word is "${word}"`);
    } else if (isSecondToLastWord) {
      setAnnouncedWord(`Next word: "${word}". One more word to go!`);
    } else if (isLastWord) {
      setAnnouncedWord(`Final word: "${word}". Would you like to start over?`);
    } else {
      setAnnouncedWord(`Next word: "${word}"`);
    }
    
    // Update status to In Progress on first word reveal if Not Started
    if (nextWordIndex === 0 && verse.status === ProgressStatus.NotStarted) {
      void handleStatusChange(reference, ProgressStatus.InProgress, false);
    }

    // Add the word to revealedWords
    setRevealedWords(prev => [...prev, nextWordIndex]);

    // Keep the input focusable but don't force focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Update handleReset to use number[] for revealedWords
  const handleReset = (reference: string, clearProgress: boolean = false) => {
    setRevealedWords([]);
    setShowFullVerse(prev => ({
      ...prev,
      [reference]: false,
    }));
    setActiveVerseId(null);
    setUserGuess('');
    setGuessFeedback(null);
    
    if (clearProgress) {
      // Only clear recorded words if explicitly requested
      setRecordedWords(prev => {
        const newRecordedWords = prev.filter(word => word.verse_reference !== reference);
        localStorage.setItem('recordedWords', JSON.stringify(newRecordedWords));
        return newRecordedWords;
      });
    }
    
    // Maintain focus on the verse element
    const verseElement = verseRefs.current[reference];
    if (verseElement) {
      verseElement.focus();
    }
  };

  // Update handleGuessSubmit to use first unrevealed word
  const handleGuessSubmit = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    const words = verse.text.split(' ');
    const nextWordIndex = findFirstUnrevealedWordIndex(words);
    
    if (nextWordIndex >= words.length) {
      setGuessFeedback({
        isCorrect: false,
        message: "You've completed this verse!"
      });
      return;
    }

    const correctWord = words[nextWordIndex].toLowerCase().replace(/[.,;:!?'"-]/g, '');
    const isCorrect = userGuess.toLowerCase().replace(/[.,;:!?'"-]/g, '') === correctWord;

    // Only add to queue if word hasn't been recorded yet
    if (!isWordRecorded(reference, nextWordIndex)) {
      const wordProgress: WordProgress = {
        verse_reference: reference,
        word_index: nextWordIndex,
        word: userGuess.toLowerCase(),
        is_correct: isCorrect,
        timestamp: Date.now()
      };
      setWordProgressQueue(prev => [...prev, wordProgress]);
      recordWord(reference, nextWordIndex);
      syncProgress();
    }

    if (isCorrect) {
      const newRevealedWords = [...revealedWords, nextWordIndex];
      setRevealedWords(newRevealedWords);
      setUserGuess('');
      setGuessFeedback({
        isCorrect: true,
        message: "Correct! Keep going!"
      });

      // Update status to In Progress on first word if Not Started
      if (nextWordIndex === 0 && verse.status === ProgressStatus.NotStarted) {
        void handleStatusChange(reference, ProgressStatus.InProgress, false);
      }

      // Find the next unrevealed word for the announcement
      const nextUnrevealedIndex = findFirstUnrevealedWordIndex(words);
      if (nextUnrevealedIndex < words.length) {
        setAnnouncedWord(`Correct! The next word starts with "${words[nextUnrevealedIndex][0]}"`);
        // Keep focus on input for next word
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        setAnnouncedWord("Congratulations! You've completed the verse!");
        // Keep focus on input even when complete
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
    } else {
      setGuessFeedback({
        isCorrect: false,
        message: "Not quite right. Try again or use the hint button."
      });
      setUserGuess(''); // Clear the input after incorrect guess
      // Keep focus on input for retry
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
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
    // Maintain focus on the verse element
    const verseElement = verseRefs.current[reference];
    if (verseElement) {
      verseElement.focus();
    }
  };

  const handleManualStatusChange = (reference: string, newStatus: ProgressStatus) => {
    void handleStatusChange(reference, newStatus, true);
  };

  // Update modal handlers
  const handleModalOpen = (type: 'delete' | 'shortcuts', reference?: string) => {
    setModalState({
      isOpen: true,
      type,
      previousFocus: document.activeElement as HTMLElement
    });
    if (type === 'delete' && reference) {
      setVerseToDelete(reference);
    }
  };

  const handleModalClose = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false,
      type: null
    }));
    setVerseToDelete(null);
    // Return focus to the element that opened the modal
    if (modalState.previousFocus) {
      modalState.previousFocus.focus();
    }
  };

  // Update delete handlers
  const handleDeleteClick = (reference: string) => {
    setDeleteDialogState({
      isDeleting: false,
      error: null,
      lastUpdated: Date.now()
    });
    handleModalOpen('delete', reference);
  };

  const handleDeleteConfirm = async () => {
    if (!verseToDelete) return;

    try {
      setDeleteDialogState(prev => ({
        ...prev,
        isDeleting: true,
        error: null,
        lastUpdated: Date.now()
      }));
      setAnnouncedWord(`Deleting verse ${verseToDelete}...`);
      await onDelete(verseToDelete);
      setAnnouncedWord(`Verse ${verseToDelete} has been deleted.`);
      // After successful deletion, focus the first verse in the list
      setTimeout(() => {
        const firstVerse = document.querySelector('[role="article"]') as HTMLElement;
        if (firstVerse) {
          firstVerse.focus();
        }
      }, 100);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete verse';
      debug.error('verses', 'Error deleting verse:', error);
      setDeleteDialogState(prev => ({
        ...prev,
        error: errorMsg,
        lastUpdated: Date.now()
      }));
      setAnnouncedWord(`Error: ${errorMsg}. Please try again.`);
      toast({
        title: "Error",
        description: errorMsg,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setDeleteDialogState(prev => ({
        ...prev,
        isDeleting: false,
        lastUpdated: Date.now()
      }));
      handleModalClose();
    }
  };

  // Update renderVerseText to highlight the first unrevealed word
  const renderVerseText = (verse: Verse) => {
    const textColor = useColorModeValue('gray.700', 'gray.200');

    if (showFullVerse[verse.reference]) {
      return (
        <Text fontSize="lg" color={textColor}>
          {verse.text}
        </Text>
      );
    }

    if (activeVerseId === verse.reference) {
      const words = verse.text.split(' ');
      const nextWordIndex = findFirstUnrevealedWordIndex(words);

      return (
        <VStack align="stretch" spacing={3}>
          <Text fontSize="lg" color={textColor}>
            {words.map((word, index) => {
              const isRevealed = revealedWords.includes(index);
              const isNextWord = index === nextWordIndex;
              return (
                <React.Fragment key={index}>
                  <span 
                    style={{
                      backgroundColor: isNextWord ? 'rgba(66, 153, 225, 0.2)' : 'transparent',
                      padding: isNextWord ? '2px 4px' : '0',
                      borderRadius: isNextWord ? '4px' : '0',
                      transition: 'background-color 0.2s',
                      display: 'inline-block'
                    }}
                  >
                    {isRevealed ? word : '_____'}
                  </span>
                  {index < words.length - 1 ? ' ' : ''}
                </React.Fragment>
              );
            })}
          </Text>
          <Flex direction="column" align="center" gap={2}>
            <Flex gap={2} align="center" justify="center" width="100%">
              <Input
                ref={inputRef}
                value={userGuess}
                onChange={(e) => {
                  // Only allow letters, numbers, and basic punctuation
                  const sanitizedValue = e.target.value.replace(/[^a-zA-Z0-9.,;:!?'"-]/g, '');
                  setUserGuess(sanitizedValue);
                  // Only clear feedback after second letter is typed
                  if (sanitizedValue.length > 1) {
                    setGuessFeedback(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleGuessSubmit(verse.reference);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onBlur={() => {
                  setGuessFeedback(null);
                }}
                placeholder="Guess the highlighted blank"
                size="sm"
                aria-label="Type your guess for the next word"
                autoFocus
                tabIndex={0}
                maxWidth="250px"
                textAlign="center"
                _focus={{
                  outline: 'none',
                  boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                }}
                _focusVisible={{
                  outline: 'none',
                  boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                }}
              />
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGuessSubmit(verse.reference);
                }}
                aria-label="Submit your guess"
              >
                Submit
              </Button>
            </Flex>
            <Box height="24px" display="flex" alignItems="center" justifyContent="center">
              {guessFeedback && (
                <Text
                  color={guessFeedback.isCorrect ? 'green.500' : 'red.500'}
                  fontSize="sm"
                  role="alert"
                  aria-live="polite"
                  textAlign="center"
                >
                  {guessFeedback.message}
                </Text>
              )}
            </Box>
          </Flex>
        </VStack>
      );
    }

    return (
      <Text fontSize="lg" color={textColor}>
        {verse.text.split(' ').map((_, index) => '_____').join(' ')}
      </Text>
    );
  };

  // Update the status buttons with improved accessibility and states
  const renderStatusButton = (reference: string, status: ProgressStatus, label: string, shortcut: string) => {
    const buttonState = statusButtonStates[reference] || { isLoading: false, error: null, lastUpdated: 0 };
    const isCurrentStatus = verses.find(v => v.reference === reference)?.status === status;

    // Map status to color scheme with improved contrast
    const getColorScheme = (status: ProgressStatus) => {
      switch (status) {
        case ProgressStatus.NotStarted:
          return 'gray';
        case ProgressStatus.InProgress:
          return 'blue';
        case ProgressStatus.Mastered:
          return 'green';
        default:
          return 'gray';
      }
    };

    const colorScheme = getColorScheme(status);

    return (
      <Box position="relative">
        <Button
          size="sm"
          colorScheme={colorScheme}
          variant={isCurrentStatus ? 'solid' : 'outline'}
          role="status"
          aria-label={`Current status: ${label}`}
          tabIndex={-1}
          isDisabled={true}
          opacity={1}
          _disabled={{
            opacity: 1,
            bg: isCurrentStatus ? `${colorScheme}.500` : 'transparent',
            color: isCurrentStatus ? 'white' : `${colorScheme}.500`,
            borderColor: `${colorScheme}.500`,
            cursor: 'default'
          }}
          _hover={{
            bg: isCurrentStatus ? `${colorScheme}.500` : 'transparent',
            color: isCurrentStatus ? 'white' : `${colorScheme}.500`,
            borderColor: `${colorScheme}.500`,
            cursor: 'default'
          }}
          _active={{
            bg: isCurrentStatus ? `${colorScheme}.500` : 'transparent',
            color: isCurrentStatus ? 'white' : `${colorScheme}.500`,
            borderColor: `${colorScheme}.500`,
            transform: 'none'
          }}
          _focus={{
            boxShadow: 'none',
            outline: 'none'
          }}
          _focusVisible={{
            boxShadow: 'none',
            outline: 'none'
          }}
          transition="all 0.2s"
          position="relative"
          overflow="hidden"
        >
          {label}
          {isCurrentStatus && (
            <Box
              position="absolute"
              bottom="0"
              left="0"
              right="0"
              height="3px"
              bg={`${colorScheme}.600`}
              animation="pulse 2s infinite"
              sx={{
                '@keyframes pulse': {
                  '0%': { opacity: 0.7 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.7 }
                }
              }}
            />
          )}
        </Button>
        <Text
          id={`status-description-${reference}`}
          srOnly
        >
          Current status: {label}. Status is automatically updated based on your progress.
        </Text>
      </Box>
    );
  };

  // Update the status buttons section
  const renderStatusButtons = (verse: Verse) => (
    <Flex 
      gap={2} 
      wrap="wrap" 
      role="status" 
      aria-label={`Progress status for ${verse.reference}`}
      aria-describedby={`status-description-${verse.reference}`}
    >
      {renderStatusButton(verse.reference, ProgressStatus.NotStarted, "Not Started", "1")}
      {renderStatusButton(verse.reference, ProgressStatus.InProgress, "In Progress", "2")}
      {renderStatusButton(verse.reference, ProgressStatus.Mastered, "Mastered", "3")}
      <Text
        id={`status-description-${verse.reference}`}
        srOnly
      >
        Current progress status for memorizing this verse. Status is automatically updated based on your progress.
      </Text>
    </Flex>
  );

  // Focus trap for modals
  useEffect(() => {
    if (!isDeleteDialogOpen && !isShortcutsModalOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    // Store the element that had focus before opening the modal
    setLastFocusedElement(document.activeElement as HTMLElement);

    // Focus the first element in the modal
    firstFocusable?.focus();

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      // Restore focus when modal closes
      lastFocusedElement?.focus();
    };
  }, [isDeleteDialogOpen, isShortcutsModalOpen]);

  // Update the verse card rendering
  const renderVerseCard = (verse: Verse): JSX.Element => {
    const isInMasteryMode = masteryState.activeVerse === verse.reference;
    
    return (
      <Box
        ref={el => verseRefs.current[verse.reference] = el}
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        position="relative"
        role="article"
        aria-labelledby={`verse-${verse.reference}`}
        tabIndex={activeVerseId === verse.reference ? -1 : 0}
      >
        <VStack align="stretch" spacing={2}>
          <Flex justify="space-between" align="center">
            <Text fontWeight="bold" id={`verse-${verse.reference}`}>
              {verse.reference}
            </Text>
            <Text
              as="button"
              color="red.600"
              fontWeight="bold"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteClick(verse.reference);
              }}
              onKeyPress={(e) => {
                e.stopPropagation();
                handleDeleteClick(verse.reference);
              }}
              _hover={{ 
                color: 'red.700',
                textDecoration: 'underline'
              }}
              cursor="pointer"
              aria-label={`Delete verse ${verse.reference}`}
              role="button"
              tabIndex={0}
              aria-describedby={`delete-description-${verse.reference}`}
              _focus={{
                outline: 'none',
                boxShadow: '0 0 0 2px var(--chakra-colors-red-300)',
                borderRadius: 'md'
              }}
              _focusVisible={{
                outline: 'none',
                boxShadow: '0 0 0 2px var(--chakra-colors-red-300)',
                borderRadius: 'md'
              }}
            >
              Delete
            </Text>
          </Flex>

          <Collapse in={!isInMasteryMode}>
            <Box>
              {renderVerseText(verse)}
              <Flex gap={2} wrap="wrap" justify="space-between" mt={4}>
                <Flex gap={2} wrap="wrap">
                  {activeVerseId !== verse.reference ? (
                    <Button
                      size="sm"
                      variant="solid"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStart(verse.reference);
                      }}
                      onKeyPress={(e) => {
                        e.stopPropagation();
                        handleStart(verse.reference);
                      }}
                      role="button"
                      aria-label={`Start memorizing ${verse.reference}`}
                      _focus={{
                        outline: 'none',
                        boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                      }}
                      _focusVisible={{
                        outline: 'none',
                        boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                      }}
                    >
                      Start Memorizing {renderKeyboardShortcut('S')}
                    </Button>
                  ) : (
                    <>
                      {!showFullVerse[verse.reference] && revealedWords.length < verse.text.split(' ').length && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowHint(verse.reference);
                          }}
                          onKeyPress={(e) => {
                            e.stopPropagation();
                            handleShowHint(verse.reference);
                          }}
                          role="button"
                          aria-label={`Show hint for next word of ${verse.reference}`}
                          _focus={{
                            outline: 'none',
                            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                          }}
                          _focusVisible={{
                            outline: 'none',
                            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                          }}
                        >
                          Show Hint {renderKeyboardShortcut('S')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset(verse.reference);
                        }}
                        onKeyPress={(e) => {
                          e.stopPropagation();
                          handleReset(verse.reference);
                        }}
                        role="button"
                        aria-label={`Reset memorization of ${verse.reference}`}
                        _focus={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                        _focusVisible={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                      >
                        Reset {renderKeyboardShortcut('R')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowVerse(verse.reference);
                        }}
                        onKeyPress={(e) => {
                          e.stopPropagation();
                          handleShowVerse(verse.reference);
                        }}
                        role="button"
                        aria-label={showFullVerse[verse.reference] ? `Hide full text of ${verse.reference}` : `Show full text of ${verse.reference}`}
                        _focus={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                        _focusVisible={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                      >
                        {showFullVerse[verse.reference] ? 'Hide Verse' : 'Show Full Verse'} {renderKeyboardShortcut('F')}
                      </Button>
                    </>
                  )}
                </Flex>
                {showStatusButtons && renderStatusButtons(verse)}
              </Flex>
            </Box>
          </Collapse>

          <Collapse in={isInMasteryMode}>
            {renderMasteryMode(verse)}
          </Collapse>

          {verse.status === ProgressStatus.InProgress && !isInMasteryMode && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="green"
              onClick={() => handleMasteryToggle(verse.reference)}
              mt={2}
            >
              Enter Mastery Mode
            </Button>
          )}
        </VStack>
      </Box>
    );
  };

  // Update the mastery mode UI in renderVerseCard
  const renderMasteryMode = (verse: Verse): JSX.Element => (
    <Box
      bg={useColorModeValue('green.50', 'green.900')}
      p={4}
      borderRadius="md"
      borderWidth="1px"
      borderColor={useColorModeValue('green.200', 'green.700')}
    >
      <VStack align="stretch" spacing={4}>
        <Text fontSize="lg" color={useColorModeValue('gray.700', 'gray.200')}>
          Think you know {verse.reference} by heart? Enter it exactly right below, and you're one step closer to mastery.
        </Text>
        
        {masteryState.progress && (
          <Box 
            p={3} 
            bg={useColorModeValue('white', 'gray.800')} 
            borderRadius="md"
            borderWidth="1px"
            borderColor={useColorModeValue('gray.200', 'gray.600')}
          >
            <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
              {getMasteryProgressMessage(masteryState.progress)}
            </Text>
          </Box>
        )}

        <Box position="relative">
          <Textarea
            value={masteryState.attempt}
            onChange={handleMasteryInput}
            onKeyDown={(e) => handleMasteryKeyDown(e, verse.reference)}
            onPaste={(e) => {
              e.preventDefault();
              toast({
                title: "No copy/paste allowed here!",
                description: "Gotta use your brain!",
                status: "warning",
                duration: 3000,
                isClosable: true,
                position: "top",
              });
            }}
            onFocus={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.setAttribute('autocomplete', 'off');
              target.setAttribute('autocorrect', 'off');
              target.setAttribute('autoCapitalize', 'off');
              target.setAttribute('spellcheck', 'false');
            }}
            placeholder="Type the verse from memory..."
            size="lg"
            rows={4}
            isDisabled={masteryState.isSubmitting}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            autoFocus
            _focus={{
              outline: 'none',
              boxShadow: '0 0 0 3px var(--chakra-colors-green-300)',
            }}
            _focusVisible={{
              outline: 'none',
              boxShadow: '0 0 0 3px var(--chakra-colors-green-300)',
            }}
          />
        </Box>
        {masteryState.feedback && (
          <Text
            color={masteryState.feedback.isCorrect ? 'green.500' : 'red.500'}
            fontSize="sm"
            role="alert"
            aria-live="polite"
          >
            {masteryState.feedback.message}
          </Text>
        )}
        <Flex gap={2} justify="space-between">
          <Button
            colorScheme="green"
            onClick={() => handleMasteryAttempt(verse.reference)}
            isLoading={masteryState.isSubmitting}
            isDisabled={!masteryState.attempt.trim()}
          >
            Submit Attempt
          </Button>
          <Button
            variant="outline"
            onClick={() => handleMasteryToggle(verse.reference)}
            isDisabled={masteryState.isSubmitting}
          >
            Exit Mastery Mode
          </Button>
        </Flex>
      </VStack>
    </Box>
  );

  // Add back the renderDeleteDialog function
  const renderDeleteDialog = () => (
    <AlertDialog
      isOpen={modalState.isOpen && modalState.type === 'delete'}
      leastDestructiveRef={cancelRef}
      onClose={handleModalClose}
      motionPreset="slideInBottom"
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={true}
    >
      <AlertDialogOverlay
        bg="blackAlpha.300"
        backdropFilter="blur(10px)"
        animation="fadeIn 0.2s ease-out"
        sx={{
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 }
          }
        }}
      >
        <AlertDialogContent
          ref={modalRef}
          bg={useColorModeValue('white', 'gray.800')}
          color={useColorModeValue('gray.800', 'white')}
          animation="slideIn 0.2s ease-out"
          sx={{
            '@keyframes slideIn': {
              from: { transform: 'translateY(20px)', opacity: 0 },
              to: { transform: 'translateY(0)', opacity: 1 }
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <AlertDialogHeader id="delete-dialog-title" fontSize="lg" fontWeight="bold">
            Delete Verse
          </AlertDialogHeader>

          <AlertDialogBody id="delete-dialog-description">
            {verseToDelete && (
              <>
                <Text>Are you sure you want to delete this verse? This action cannot be undone.</Text>
                <Box 
                  mt={4} 
                  p={3} 
                  bg={useColorModeValue('gray.50', 'gray.700')} 
                  borderRadius="md"
                  role="region"
                  aria-label="Verse details"
                >
                  <Text fontWeight="bold">Reference:</Text>
                  <Text>{verseToDelete}</Text>
                  <Text fontWeight="bold" mt={2}>Text:</Text>
                  <Text>{verses.find(v => v.reference === verseToDelete)?.text}</Text>
                </Box>
                {deleteDialogState.error && (
                  <Text
                    color="red.500"
                    mt={3}
                    role="alert"
                    aria-live="assertive"
                  >
                    {deleteDialogState.error}
                  </Text>
                )}
              </>
            )}
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button 
              ref={cancelRef} 
              onClick={handleModalClose}
              aria-label="Cancel deletion"
              onKeyPress={(e) => handleKeyPress(e, handleModalClose)}
              variant="ghost"
              isDisabled={deleteDialogState.isDeleting}
            >
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleDeleteConfirm}
              ml={3}
              isLoading={deleteDialogState.isDeleting}
              aria-label="Confirm deletion"
              onKeyPress={(e) => handleKeyPress(e, handleDeleteConfirm)}
              loadingText="Deleting..."
              isDisabled={deleteDialogState.isDeleting}
              _hover={{
                transform: 'translateY(-1px)',
                boxShadow: 'sm'
              }}
              _active={{
                transform: 'translateY(0)',
                boxShadow: 'none'
              }}
              transition="all 0.2s"
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );

  // Add back the renderShortcutsModal function
  const renderShortcutsModal = () => (
    <Modal 
      isOpen={modalState.isOpen && modalState.type === 'shortcuts'} 
      onClose={handleModalClose} 
      size="xl"
      closeOnOverlayClick={false}
      closeOnEsc={true}
      motionPreset="slideInBottom"
      isCentered
    >
      <ModalOverlay
        backdropFilter="blur(10px)"
        animation="fadeIn 0.2s ease-out"
        sx={{
          '@keyframes fadeIn': {
            from: { opacity: 0 },
            to: { opacity: 1 }
          }
        }}
      />
      <ModalContent
        ref={modalRef}
        bg={useColorModeValue('white', 'gray.800')}
        color={useColorModeValue('gray.800', 'white')}
        animation="slideIn 0.2s ease-out"
        sx={{
          '@keyframes slideIn': {
            from: { transform: 'translateY(20px)', opacity: 0 },
            to: { transform: 'translateY(0)', opacity: 1 }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        aria-describedby="shortcuts-dialog-description"
      >
        <ModalHeader id="shortcuts-dialog-title">Keyboard Shortcuts</ModalHeader>
        <ModalCloseButton aria-label="Close shortcuts" />
        <ModalBody pb={6} id="shortcuts-dialog-description">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Action</Th>
                <Th>Shortcut</Th>
                <Th>Description</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>Show Shortcuts</Td>
                <Td><Kbd>?</Kbd></Td>
                <Td>Show this help modal</Td>
              </Tr>
              <Tr>
                <Td>Navigate Up</Td>
                <Td><Kbd>↑</Kbd></Td>
                <Td>Move focus to previous verse</Td>
              </Tr>
              <Tr>
                <Td>Navigate Down</Td>
                <Td><Kbd>↓</Kbd></Td>
                <Td>Move focus to next verse</Td>
              </Tr>
              <Tr>
                <Td>Go to First</Td>
                <Td><Kbd>Home</Kbd></Td>
                <Td>Move focus to first verse</Td>
              </Tr>
              <Tr>
                <Td>Go to Last</Td>
                <Td><Kbd>End</Kbd></Td>
                <Td>Move focus to last verse</Td>
              </Tr>
              <Tr>
                <Td>Start/Show Next</Td>
                <Td><Kbd>S</Kbd></Td>
                <Td>Start memorizing or show next word</Td>
              </Tr>
              <Tr>
                <Td>Reset</Td>
                <Td><Kbd>R</Kbd></Td>
                <Td>Reset the current memorization</Td>
              </Tr>
              <Tr>
                <Td>Toggle Full Verse</Td>
                <Td><Kbd>F</Kbd></Td>
                <Td>Show/hide the complete verse text</Td>
              </Tr>
              <Tr>
                <Td>Cancel/Close</Td>
                <Td><Kbd>Esc</Kbd></Td>
                <Td>Reset current verse or close modal</Td>
              </Tr>
              <Tr>
                <Td>Set Status: Not Started</Td>
                <Td><Kbd>1</Kbd></Td>
                <Td>Mark verse as not started</Td>
              </Tr>
              <Tr>
                <Td>Set Status: In Progress</Td>
                <Td><Kbd>2</Kbd></Td>
                <Td>Mark verse as in progress</Td>
              </Tr>
              <Tr>
                <Td>Set Status: Mastered</Td>
                <Td><Kbd>3</Kbd></Td>
                <Td>Mark verse as mastered</Td>
              </Tr>
            </Tbody>
          </Table>
          <Text mt={4} fontSize="sm" color="gray.500">
            Note: Keyboard shortcuts only work when a verse is focused and no input fields are active.
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
  );

  if (loading) {
    return (
      <Box 
        p={4} 
        role="status" 
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading verses"
      >
        <Flex direction="column" align="center" gap={4}>
          <Text>Loading verses...</Text>
          <Text srOnly>Please wait while your verses are being loaded. This may take a moment.</Text>
          <Box
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext="Loading verses"
            width="100%"
            maxW="300px"
            height="4px"
            bg="gray.100"
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              width="100%"
              height="100%"
              bg="blue.500"
              animation="loading 1.5s ease-in-out infinite"
              sx={{
                '@keyframes loading': {
                  '0%': { transform: 'translateX(-100%)' },
                  '100%': { transform: 'translateX(100%)' }
                }
              }}
            />
          </Box>
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box 
        p={4} 
        role="alert" 
        aria-live="assertive"
        aria-atomic="true"
        borderWidth="1px"
        borderColor="red.500"
        borderRadius="md"
        bg={useColorModeValue('red.50', 'red.900')}
      >
        <VStack align="stretch" spacing={3}>
          <Text color="red.500" fontWeight="bold">
            Error Loading Verses
          </Text>
          <Text>
            {error instanceof Error ? error.message : String(error)}
          </Text>
          <Text srOnly>
            There was an error loading your verses. The error message is: {error instanceof Error ? error.message : String(error)}
          </Text>
          <Button
            onClick={() => window.location.reload()}
            colorScheme="red"
            variant="outline"
            aria-label="Try again"
          >
            Try Again
          </Button>
          <Text fontSize="sm" color="gray.500">
            If the problem persists, please try refreshing the page or contact support.
          </Text>
        </VStack>
      </Box>
    );
  }

  if (verses.length === 0) {
    return (
      <Box p={4} role="status" aria-live="polite">
        <Text>No verses added yet. Add your first verse above!</Text>
        <Text srOnly>You haven't added any verses yet. Use the form above to add your first verse.</Text>
      </Box>
    );
  }

  return (
    <Box w="100%">
      {/* Skip link for keyboard users */}
      <Link
        href="#verses-list"
        position="absolute"
        left="-9999px"
        top="auto"
        width="1px"
        height="1px"
        overflow="hidden"
        zIndex="9999"
        _focus={{
          left: "10px",
          top: "10px",
          width: "auto",
          height: "auto",
          padding: "10px",
          backgroundColor: "white",
          border: "1px solid",
          borderColor: "blue.500",
          borderRadius: "md",
        }}
      >
        Skip to verses list
      </Link>

      {/* ARIA Live Region for announcing revealed words */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        position="absolute"
        width="1px"
        height="1px"
        padding="0"
        margin="-1px"
        overflow="hidden"
        clipPath="inset(50%)"
        whiteSpace="nowrap"
        border="0"
      >
        {announcedWord}
      </Box>

      <VStack spacing={4} align="stretch" mb={8} id="verses-list">
        {verses.map(renderVerseCard)}
      </VStack>

      {renderDeleteDialog()}
      {renderShortcutsModal()}
    </Box>
  );
}); 