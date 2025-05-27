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
  showStatusButtons?: boolean;
}

export const VerseList = forwardRef<VerseListRef, VerseListProps>((props, ref) => {
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
  const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes
  const WARNING_DURATION = 5 * 60 * 1000; // 5 minutes

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

      // Only handle shortcuts if no modal is open and no input is focused
      if (modalState.isOpen || document.activeElement?.tagName === 'INPUT') return;

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
            setAnnouncedWord('Started memorizing. Press S to show next word.');
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
  }, [activeVerseId, showFullVerse, modalState.isOpen, verses, revealedWords]);

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

  // Add timeout warning
  useEffect(() => {
    const checkTimeout = () => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity >= TIMEOUT_DURATION - WARNING_DURATION) {
        toast({
          title: "Session Timeout Warning",
          description: "Your session will expire in 5 minutes. Would you like to continue?",
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
              <Text>Your session will expire in 5 minutes. Would you like to continue?</Text>
              <Flex mt={2} gap={2}>
                <Button
                  size="sm"
                  colorScheme="orange"
                  onClick={() => {
                    setLastActivity(Date.now());
                    toast.closeAll();
                  }}
                >
                  Continue Session
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.reload();
                  }}
                >
                  Refresh Page
                </Button>
              </Flex>
            </Box>
          ),
        });
      }
    };

    const interval = setInterval(checkTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [lastActivity, toast]);

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

  const handleStart = (reference: string) => {
    setActiveVerseId(reference);
    setRevealedWords([]);
    setShowFullVerse({});
    // Focus the "Show Next Word" button after a short delay
    setTimeout(() => {
      const nextWordButton = document.querySelector(`[aria-label="Show next word of ${reference}"]`) as HTMLButtonElement;
      if (nextWordButton) {
        nextWordButton.focus();
      }
    }, 100);
  };

  const handleShowHint = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    const words = verse.text.split(' ');
    const nextWordIndex = revealedWords.length;
    
    // Ensure we don't try to reveal beyond the verse length
    if (nextWordIndex >= words.length) {
      setAnnouncedWord("All words have been revealed");
      return;
    }

    // Create a new array with the next word added
    const newRevealedWords = [...revealedWords, nextWordIndex];
    setRevealedWords(newRevealedWords);
    
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

    // Maintain focus on the verse element
    const verseElement = verseRefs.current[reference];
    if (verseElement) {
      verseElement.focus();
    }
  };

  const handleReset = (reference: string) => {
    setRevealedWords([]);
    setShowFullVerse(prev => ({
      ...prev,
      [reference]: false,
    }));
    setActiveVerseId(null);
    // Maintain focus on the verse element
    const verseElement = verseRefs.current[reference];
    if (verseElement) {
      verseElement.focus();
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

  const renderVerseText = (verse: Verse) => {
    if (showFullVerse[verse.reference]) {
      return (
        <Text fontSize="lg" color="gray.700">
          {verse.text}
        </Text>
      );
    }

    if (activeVerseId === verse.reference) {
      const words = verse.text.split(' ');
      return (
        <Text fontSize="lg" color="gray.700">
          {words.map((word, index) => {
            const isRevealed = revealedWords.includes(index);
            return (
              <span key={index}>
                {isRevealed ? word : '_____'}
                {index < words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </Text>
      );
    }

    return (
      <Text fontSize="lg" color="gray.700">
        {verse.text.split(' ').map((_, index) => '_____').join(' ')}
      </Text>
    );
  };

  // Update the status buttons with improved accessibility and states
  const renderStatusButton = (reference: string, status: ProgressStatus, label: string, shortcut: string) => {
    const buttonState = statusButtonStates[reference] || { isLoading: false, error: null, lastUpdated: 0 };
    const isCurrentStatus = verses.find(v => v.reference === reference)?.status === status;
    const hasError = !!buttonState.error;
    const isLoading = buttonState.isLoading;

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
          onClick={() => handleManualStatusChange(reference, status)}
          onKeyPress={(e) => handleKeyPress(e, () => handleManualStatusChange(reference, status))}
          role="radio"
          aria-label={label}
          aria-checked={isCurrentStatus}
          aria-describedby={`status-description-${reference} ${hasError ? `status-error-${reference}` : ''}`}
          tabIndex={isCurrentStatus ? 0 : -1}
          isLoading={isLoading}
          loadingText="Updating..."
          aria-busy={isLoading}
          isDisabled={hasError}
          _hover={{
            transform: 'translateY(-1px)',
            boxShadow: '0 0 0 2px var(--chakra-colors-' + colorScheme + '-500)',
          }}
          _active={{
            transform: 'translateY(0)',
            boxShadow: 'none'
          }}
          _focus={{
            boxShadow: '0 0 0 3px var(--chakra-colors-' + colorScheme + '-300)',
            outline: 'none'
          }}
          _focusVisible={{
            boxShadow: '0 0 0 3px var(--chakra-colors-' + colorScheme + '-300)',
            outline: 'none'
          }}
          transition="all 0.2s"
          position="relative"
          overflow="hidden"
        >
          {label} {renderKeyboardShortcut(shortcut)}
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
        {hasError && (
          <Text
            id={`status-error-${reference}`}
            color="red.600"
            fontSize="xs"
            mt={1}
            role="alert"
            aria-live="assertive"
            fontWeight="medium"
          >
            {buttonState.error}
          </Text>
        )}
        <Text
          id={`status-description-${reference}`}
          srOnly
        >
          {isCurrentStatus 
            ? `Current status: ${label}. Press ${shortcut} to keep this status.`
            : `Press ${shortcut} to set status to ${label}.`
          }
        </Text>
      </Box>
    );
  };

  // Update the status buttons section
  const renderStatusButtons = (verse: Verse) => (
    <Flex 
      gap={2} 
      wrap="wrap" 
      role="radiogroup" 
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
        Select the current progress status for memorizing this verse. Use number keys 1, 2, or 3 to quickly change status.
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

  // Focus management for verse cards
  const handleVerseFocus = (reference: string) => {
    const verseElement = verseRefs.current[reference];
    if (verseElement) {
      verseElement.focus();
    }
  };

  // Update the delete dialog with improved accessibility and animations
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

  // Update the shortcuts modal with improved accessibility and animations
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

  // Update verse card to handle focus
  const renderVerseCard = (verse: Verse) => (
    <Box
      key={`${verse.reference}-${verse.lastReviewed}`}
      ref={el => verseRefs.current[verse.reference] = el}
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      position="relative"
      role="article"
      aria-labelledby={`verse-${verse.reference}`}
      tabIndex={0}
      onClick={() => handleVerseFocus(verse.reference)}
      onKeyPress={(e) => handleKeyPress(e, () => handleVerseFocus(verse.reference))}
      _focus={{
        outline: 'none',
        boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
        borderColor: 'blue.500',
      }}
      _focusVisible={{
        outline: 'none',
        boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
        borderColor: 'blue.500',
      }}
      transition="all 0.2s"
      cursor="pointer"
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
        <Text
          id={`delete-description-${verse.reference}`}
          srOnly
        >
          Delete this verse. This action cannot be undone. A confirmation dialog will appear.
        </Text>
        <Box 
          minH={{ base: "6em", md: "4em" }}
          display="flex" 
          alignItems="center"
          lineHeight="1.5"
          role="region"
          aria-label={`Verse text for ${verse.reference}`}
          tabIndex={0}
          aria-live="polite"
          aria-atomic="true"
          aria-relevant="text"
          aria-describedby={`verse-status-${verse.reference}`}
        >
          {renderVerseText(verse)}
        </Box>
        <Text
          id={`verse-status-${verse.reference}`}
          srOnly
        >
          {activeVerseId === verse.reference 
            ? `Memorizing in progress. ${revealedWords.length} of ${verse.text.split(' ').length} words revealed.`
            : showFullVerse[verse.reference]
              ? "Full verse text is visible"
              : "Verse text is hidden. Press S to start memorizing."
          }
        </Text>
        <Flex gap={2} wrap="wrap" justify="space-between">
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
                    variant="solid"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowHint(verse.reference);
                    }}
                    onKeyPress={(e) => {
                      e.stopPropagation();
                      handleShowHint(verse.reference);
                    }}
                    role="button"
                    aria-label={`Show next word of ${verse.reference}`}
                    _focus={{
                      outline: 'none',
                      boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                    }}
                    _focusVisible={{
                      outline: 'none',
                      boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                    }}
                  >
                    Show Next Word {renderKeyboardShortcut('S')}
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
      </VStack>
    </Box>
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