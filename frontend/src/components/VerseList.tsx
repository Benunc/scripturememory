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
  UnorderedList,
  ListItem,
  IconButton,
  Tooltip,
  useDisclosure,
  useBreakpointValue,
  Divider,
  useOutsideClick,
  useUpdateEffect,
  useEventListener,
  useMergeRefs,
  useControllableState,
  useCallbackRef,
  useId,
  useBoolean,
  useClipboard,
  useDisclosure as useDisclosureHook,
  useToast as useToastHook,
  useColorMode as useColorModeHook,
  useBreakpointValue as useBreakpointValueHook,
  useOutsideClick as useOutsideClickHook,
  useEventListener as useEventListenerHook,
  useMergeRefs as useMergeRefsHook,
  useControllableState as useControllableStateHook,
  useCallbackRef as useCallbackRefHook,
  useId as useIdHook,
  useBoolean as useBooleanHook,
  useClipboard as useClipboardHook,
  Spinner,
} from '@chakra-ui/react';
import { ChevronDownIcon, ChevronUpIcon, DeleteIcon, EditIcon, InfoIcon, RepeatIcon, StarIcon, TimeIcon } from '@chakra-ui/icons';
import { ProgressStatus } from '../utils/progress';
import { useAuth } from '../hooks/useAuth';
import { usePoints } from '../contexts/PointsContext';
import { saveAchievementForSharing, saveVerseCompletionAchievement, hasUnsharedAchievement, getPendingAchievement, markAchievementAsShared } from '../utils/achievements';
import { SocialShareModal } from './SocialShareModal';
import { debug, handleError } from '../utils/debug';
import { useVerses } from '../hooks/useVerses';
import { Footer } from './Footer';
import { getApiUrl } from '../utils/api';
import { VerseOverlay } from './VerseOverlay';

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
  last_attempt_date?: number;
}

// Update MasteryState interface
interface MasteryState {
  activeVerse: string | null;
  attempt: string;
  isSubmitting: boolean;
  feedback: {
    isCorrect: boolean;
    message: string;
    attempt?: string;  // Store the attempt for display
  } | null;
  progress: MasteryProgress | null;
}

// Move MasteryMode to be a separate component
interface MasteryModeProps {
  verse: Verse;
  attempt: string;
  isSubmitting: boolean;
  feedback: {
    isCorrect: boolean;
    message: string;
    attempt?: string;
  } | null;
  progress: MasteryProgress | null;
  onAttempt: (reference: string) => Promise<void>;
  onToggle: (reference: string) => Promise<void>;
  onInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, reference: string) => void;
  isVisible: boolean; // Add this prop
}

// Add at the top with other constants
const POINTS = {
  WORD_CORRECT: 1,
  STREAK_MULTIPLIER: 0.5
};

const MasteryMode: React.FC<MasteryModeProps> = ({ 
  verse, 
  attempt,
  isSubmitting,
  feedback,
  progress,
  onAttempt, 
  onToggle, 
  onInput, 
  onKeyDown,
  isVisible
}) => {
  const [progressMessage, setProgressMessage] = useState<JSX.Element | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState<string | null>(null);
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Move all color mode hooks to the top
  const masteryBg = useColorModeValue('blue.50', 'blue.900');
  const masteryBorderColor = useColorModeValue('blue.200', 'blue.700');
  const masteryTextColor = useColorModeValue('gray.700', 'gray.200');
  const masteryBoxBg = useColorModeValue('white', 'gray.800');
  const masteryBoxBorderColor = useColorModeValue('gray.200', 'gray.600');
  const successBg = useColorModeValue('green.500', 'green.600');
  const successBorderColor = useColorModeValue('green.600', 'green.700');
  const warningBg = useColorModeValue('orange.50', 'orange.900');
  const warningBorderColor = useColorModeValue('orange.200', 'orange.700');
  const warningTextColor = useColorModeValue('gray.600', 'gray.300');
  const warningBoxBg = useColorModeValue('white', 'gray.800');
  const warningBoxBorderColor = useColorModeValue('gray.200', 'gray.600');

  // Update time until next attempt
  useEffect(() => {
    if (progress && progress.consecutive_perfect > 0) {
      void getTimeUntilNextAttempt(verse.reference).then(time => {
        setTimeUntilNext(time || null);
      });
    } else {
      setTimeUntilNext(null);
    }
  }, [progress?.consecutive_perfect, verse.reference]);

  // Focus textarea when component becomes visible
  useEffect(() => {
    if (isVisible) {
      // Small delay to ensure the textarea is rendered and visible
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 300); // Delay to account for collapse animation
      return () => clearTimeout(timer);
    }
  }, [isVisible]); // Re-run when visibility changes

  // Helper function to normalize words
  const normalizeWord = (word: string): string => {
    return word.toLowerCase().replace(/[.,;:!?'"—_()\[\]/…]/g, '');
  };

  // Helper function to get time until next attempt
  const getTimeUntilNextAttempt = async (reference: string): Promise<string> => {
    const lastAttempt = localStorage.getItem(`last_attempt_${reference}`);
    if (!lastAttempt) {
      // If no local timestamp, fetch from API
      try {
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken) {
          throw new Error('No session token found');
        }

        const response = await fetch(`${getApiUrl()}/progress/mastery/${reference}`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) throw new Error('Failed to fetch mastery progress');

        const data = await response.json();
        const progress: MasteryProgress = {
          total_attempts: data.totalAttempts || 0,
          overall_accuracy: data.overallAccuracy || 0,
          consecutive_perfect: data.perfectAttemptsInRow || 0,
          is_mastered: data.isMastered || false,
          mastery_date: data.masteryDate,
          last_attempt_date: data.lastAttemptDate
        };

        if (progress.last_attempt_date) {
          localStorage.setItem(`last_attempt_${reference}`, progress.last_attempt_date.toString());
          const now = Date.now();
          const hoursSinceLastAttempt = (now - progress.last_attempt_date) / (1000 * 60 * 60);
          const hoursRemaining = Math.ceil(24 - hoursSinceLastAttempt);
          if (hoursRemaining <= 0) return '';
          return `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
        }
        return '';
      } catch (error) {
        console.error('Error fetching mastery progress:', error);
        return '';
      }
    }
    
    const lastAttemptTime = parseInt(lastAttempt, 10);
    const now = Date.now();
    const hoursSinceLastAttempt = (now - lastAttemptTime) / (1000 * 60 * 60);
    const hoursRemaining = Math.ceil(24 - hoursSinceLastAttempt);
    
    if (hoursRemaining <= 0) return '';
    return `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
  };

  // Helper function to get mastery progress message
  const getMasteryProgressMessage = (progress: MasteryProgress, reference: string): JSX.Element => {
    if (progress.is_mastered) {
      const masteryDate = progress.mastery_date ? new Date(progress.mastery_date).toLocaleDateString() : 'recently';
      return (
        <Text
          fontSize="xl"
          fontWeight="bold"
          color="green.500"
          textAlign="center"
          animation="pulse 2s infinite"
          sx={{
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.05)' },
              '100%': { transform: 'scale(1)' }
            }
          }}
        >
          🎉 YOU DID IT! You mastered this verse on {masteryDate} after successfully reciting it from memory 3 times in a row perfectly! 🎉
        </Text>
      );
    }

    const isInCooldown = timeUntilNext !== null && timeUntilNext !== '';

    return (
      <VStack align="stretch" spacing={2}>
        <Text fontWeight="bold" textAlign="center">Current mastery status for {reference}:</Text>
        <Box display="flex" justifyContent="center">
          <UnorderedList 
            spacing={2} 
            styleType="disc" 
            maxW={{ base: "70%", sm: "60%", md: "50%", lg: "40%" }}
            width="100%"
          >
            <ListItem textAlign="left">
              You need 5 total attempts at 80% or better accuracy
              <UnorderedList spacing={1} styleType="circle" ml={6}>
                <ListItem textAlign="left">
                  You currently have {progress.total_attempts} {progress.total_attempts === 1 ? 'attempt' : 'attempts'}
                </ListItem>
              </UnorderedList>
            </ListItem>
            <ListItem textAlign="left">
              You need 3 perfect attempts, at least 24 hours apart
              <UnorderedList spacing={1} styleType="circle" ml={6}>
                <ListItem textAlign="left">
                  You currently have {progress.consecutive_perfect} perfect {progress.consecutive_perfect === 1 ? 'attempt' : 'attempts'}
                </ListItem>
              </UnorderedList>
            </ListItem>
            {isInCooldown && (
              <ListItem textAlign="left" color="orange.500">
                You can make your next attempt in {timeUntilNext} (24-hour cooldown after perfect attempts)
              </ListItem>
            )}
          </UnorderedList>
        </Box>
        <Text mt={2} textAlign="center">
          {isInCooldown 
            ? "You can practice now, but attempts won't count towards mastery until the cooldown period ends."
            : "You can retry immediately after a failed (below 80%) attempt, and the 24 hour timer only starts after a perfect attempt."}
        </Text>
      </VStack>
    );
  };

  useEffect(() => {
    if (progress) {
      const message = getMasteryProgressMessage(progress, verse.reference);
      setProgressMessage(message);
    }
  }, [progress, verse.reference, timeUntilNext]);

  return (
    <Box
      bg={masteryBg}
      p={4}
      borderRadius="md"
      borderWidth="1px"
      borderColor={masteryBorderColor}
      display={isVisible ? 'block' : 'none'}
    >
      <VStack align="stretch" spacing={4}>
        <Text fontSize="lg" color={masteryTextColor}>
          Think you know {verse.reference} by heart? Enter it exactly right below, and you're one step closer to mastery.
        </Text>
        
        {progress && (
          <Box 
            p={3} 
            bg={masteryBoxBg} 
            borderRadius="md"
            borderWidth="1px"
            borderColor={masteryBoxBorderColor}
          >
            {progressMessage}
          </Box>
        )}

        <Box position="relative">
          <Textarea
            ref={textareaRef}
            value={attempt}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            autoSave="off"
            autoFocus={false}
            form=""
            name=""
            inputMode="text"
            onChange={onInput}
            onKeyDown={(e) => onKeyDown(e, verse.reference)}
            onPaste={(e) => {
              // Only prevent paste if it's a real paste event with more than 2 words
              if (e.nativeEvent instanceof ClipboardEvent && 
                  e.nativeEvent.clipboardData && 
                  e.nativeEvent.clipboardData.getData('text').trim().split(/\s+/).length > 2) {
                e.preventDefault();
                toast({
                  title: "No copy/paste allowed here!",
                  description: "Gotta use your brain!",
                  status: "warning",
                  duration: 3000,
                  isClosable: true,
                  position: "top",
                });
              }
            }}
            placeholder="Type the verse from memory..."
            size="lg"
            rows={4}
            isDisabled={isSubmitting}
            _focus={{
              outline: 'none',
              boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
            }}
            _focusVisible={{
              outline: 'none',
              boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
            }}
            sx={{
              textTransform: 'none',
              '&::placeholder': {
                textTransform: 'none'
              }
            }}
          />
        </Box>

        {feedback && (
          <Box>
            {feedback.isCorrect ? (
              <Box
                p={3}
                bg={successBg}
                borderRadius="md"
                borderWidth="1px"
                borderColor={successBorderColor}
              >
                <Text
                  color="white"
                  fontSize="sm"
                  fontWeight="bold"
                  role="alert"
                  aria-live="polite"
                >
                  {feedback.message}
                </Text>
              </Box>
            ) : (
              <Box
                p={3}
                bg={warningBg}
                borderRadius="md"
                borderWidth="1px"
                borderColor={warningBorderColor}
              >
                <Text fontSize="sm" color={warningTextColor} mb={2}>
                  {feedback.message}
                </Text>
                {feedback.attempt && (
                  <Box
                    p={2}
                    bg={warningBoxBg}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={warningBoxBorderColor}
                  >
                    {feedback.attempt.split(' ').map((word, index) => {
                      const isCorrect = verse.text.split(' ').some(
                        correctWord => normalizeWord(correctWord) === normalizeWord(word)
                      );
                      return (
                        <Text
                          key={index}
                          as="span"
                          color={isCorrect ? 'green.500' : 'red.500'}
                          fontWeight={isCorrect ? 'normal' : 'bold'}
                          mr={1}
                        >
                          {word}
                        </Text>
                      );
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}

        <Flex gap={2} justify="space-between">
          <Button
            colorScheme="green"
            onClick={() => onAttempt(verse.reference)}
            isLoading={isSubmitting}
            isDisabled={!attempt.trim()}
          >
            Submit Attempt
          </Button>
          <Button
            variant="outline"
            onClick={() => onToggle(verse.reference)}
            isDisabled={isSubmitting}
          >
            Exit Mastery Mode
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};

export const VerseList = forwardRef<VerseListRef, VerseListProps>((props, ref): JSX.Element => {
  const { verses, loading, error, onStatusChange, onDelete, showStatusButtons = true } = props;
  const [activeVerseId, setActiveVerseId] = useState<string | null>(null);
  const [revealedWords, setRevealedWords] = useState<number[]>([]);
  const [showFullVerse, setShowFullVerse] = useState<Record<string, boolean>>({});
  const [announcedWord, setAnnouncedWord] = useState<string>('');
  const toast = useToast();
  const { isAuthenticated, userEmail, signOut } = useAuth({});
  const { refreshPoints, updatePoints, updateCurrentStreak, updateLongestWordGuessStreak } = usePoints();
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Move all color mode hooks to component level
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const inputBg = useColorModeValue('white', 'gray.800');
  const inputBorderColor = useColorModeValue('gray.200', 'gray.600');
  const inputFocusShadow = '0 0 0 3px var(--chakra-colors-blue-300)';
  const dialogBg = useColorModeValue('white', 'gray.800');
  const dialogColor = useColorModeValue('gray.800', 'white');
  const dialogOverlayBg = 'blackAlpha.300';
  const dialogContentBg = useColorModeValue('white', 'gray.800');
  const dialogContentColor = useColorModeValue('gray.800', 'white');
  const dialogDetailsBg = useColorModeValue('gray.50', 'gray.700');
  const successBg = useColorModeValue('green.500', 'green.600');
  const successBorderColor = useColorModeValue('green.600', 'green.700');
  const warningBg = useColorModeValue('orange.50', 'orange.900');
  const warningBorderColor = useColorModeValue('orange.200', 'orange.700');
  const warningTextColor = useColorModeValue('gray.600', 'gray.300');
  const warningBoxBg = useColorModeValue('white', 'gray.800');
  const warningBoxBorderColor = useColorModeValue('gray.200', 'gray.600');
  const masteryButtonBg = useColorModeValue('blue.50', 'blue.900');
  const masteryButtonColor = useColorModeValue('blue.700', 'blue.100');
  const masteryButtonBorderColor = useColorModeValue('blue.200', 'blue.700');
  const masteryButtonHoverBg = useColorModeValue('blue.100', 'blue.800');
  const masteryButtonHoverBorderColor = useColorModeValue('blue.300', 'blue.600');
  const masteryButtonActiveBg = useColorModeValue('blue.200', 'blue.700');
  const masteryButtonActiveBorderColor = useColorModeValue('blue.400', 'blue.500');
  const errorBg = useColorModeValue('red.50', 'red.900');
  const shortcutsModalBg = useColorModeValue('white', 'gray.800');
  const shortcutsModalColor = useColorModeValue('gray.800', 'white');
  const verseCardBg = useColorModeValue('white', 'gray.800');
  const verseCardHoverBg = useColorModeValue('gray.50', 'gray.700');

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [verseToDelete, setVerseToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const verseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
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

  // Update syncProgress to batch updates more efficiently
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

        // Sort queue by timestamp to ensure correct order
        const sortedQueue = [...wordProgressQueue].sort((a, b) => a.timestamp - b.timestamp);
        
        // Process words sequentially to maintain proper streak calculation
        for (const progress of sortedQueue) {
          const response = await fetch(`${getApiUrl()}/progress/word`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(progress)
          });

          if (!response.ok) {
            throw new Error('Failed to sync progress');
          }
        }

        // Clear the queue after successful sync
        setWordProgressQueue([]);
        
        // Refresh points from server after successful sync to get updated longest word guess streak
        await refreshPoints();
        localStorage.setItem('last_points_refresh', Date.now().toString());
      } catch (error) {
        debug.error('api', 'Error syncing progress:', error);
      } finally {
        setIsSyncing(false);
      }
    }, 2000); // Reduced debounce time from 3.5s to 2s for more responsive syncing
  }, [isAuthenticated, wordProgressQueue, isSyncing, refreshPoints]);

  // Force immediate sync without debounce
  const forceSync = useCallback(async () => {
    if (!isAuthenticated || wordProgressQueue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      // Sort queue by timestamp to ensure correct order
      const sortedQueue = [...wordProgressQueue].sort((a, b) => a.timestamp - b.timestamp);
      
      // Process words sequentially to maintain proper streak calculation
      for (const progress of sortedQueue) {
        const response = await fetch(`${getApiUrl()}/progress/word`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify(progress)
        });

        if (!response.ok) {
          throw new Error('Failed to sync progress');
        }
      }

      // Clear the queue after successful sync
      setWordProgressQueue([]);
      
      // Refresh points from server after successful sync to get updated longest word guess streak
      await refreshPoints();
      localStorage.setItem('last_points_refresh', Date.now().toString());
    } catch (error) {
      debug.error('api', 'Error syncing progress:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, wordProgressQueue, isSyncing, refreshPoints]);

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

  // Social share modal state
  const [socialShareModal, setSocialShareModal] = useState<{
    isOpen: boolean;
    achievement: any;
  }>({
    isOpen: false,
    achievement: null
  });

  // Red flash effect state
  const [showRedFlash, setShowRedFlash] = useState(false);

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

  // Add state for tracking consecutive correct guesses
  const [consecutiveCorrectGuesses, setConsecutiveCorrectGuesses] = useState<number>(0);

  // Sync consecutive correct guesses with PointsContext
  useEffect(() => {
    updateCurrentStreak(consecutiveCorrectGuesses);
  }, [consecutiveCorrectGuesses, updateCurrentStreak]);

  // Add state for overlay
  const [showOverlay, setShowOverlay] = useState(false);

  // Add helper function to check if enough time has passed since last attempt
  const hasEnoughTimePassed = async (reference: string): Promise<boolean> => {
    const lastAttempt = localStorage.getItem(`last_attempt_${reference}`);
    if (!lastAttempt) {
      // If no local timestamp, fetch from API
      const progress = await fetchMasteryProgress(reference);
      if (progress.last_attempt_date) {
        localStorage.setItem(`last_attempt_${reference}`, progress.last_attempt_date.toString());
        const now = Date.now();
        const hoursSinceLastAttempt = (now - progress.last_attempt_date) / (1000 * 60 * 60);
        return hoursSinceLastAttempt >= 24;
      }
      return true; // No previous attempts found
    }
    
    const lastAttemptTime = parseInt(lastAttempt, 10);
    const now = Date.now();
    const hoursSinceLastAttempt = (now - lastAttemptTime) / (1000 * 60 * 60);
    
    return hoursSinceLastAttempt >= 24;
  };

  // Add helper function to get time until next attempt
  const getTimeUntilNextAttempt = async (reference: string): Promise<string> => {
    const lastAttempt = localStorage.getItem(`last_attempt_${reference}`);
    if (!lastAttempt) {
      // If no local timestamp, fetch from API
      const progress = await fetchMasteryProgress(reference);
      if (progress.last_attempt_date) {
        localStorage.setItem(`last_attempt_${reference}`, progress.last_attempt_date.toString());
        const now = Date.now();
        const hoursSinceLastAttempt = (now - progress.last_attempt_date) / (1000 * 60 * 60);
        const hoursRemaining = Math.ceil(24 - hoursSinceLastAttempt);
        if (hoursRemaining <= 0) return '';
        return `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
      }
      return '';
    }
    
    const lastAttemptTime = parseInt(lastAttempt, 10);
    const now = Date.now();
    const hoursSinceLastAttempt = (now - lastAttemptTime) / (1000 * 60 * 60);
    const hoursRemaining = Math.ceil(24 - hoursSinceLastAttempt);
    
    if (hoursRemaining <= 0) return '';
    return `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`;
  };

  // Add function to fetch mastery progress
  const fetchMasteryProgress = async (reference: string, forceRefresh: boolean = false): Promise<MasteryProgress> => {
    // Check localStorage first, but only if not forcing refresh
    if (!forceRefresh) {
      const cached = localStorage.getItem(`mastery_progress_${reference}`);
      if (cached) {
        const { progress, timestamp } = JSON.parse(cached);
        // Cache for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          return progress;
        }
      }
    }

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const response = await fetch(`${getApiUrl()}/progress/mastery/${reference}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch mastery progress');

      const data = await response.json();
      
      // Map API response to our frontend interface
      const progress: MasteryProgress = {
        total_attempts: data.totalAttempts || 0,
        overall_accuracy: data.overallAccuracy || 0,
        consecutive_perfect: data.perfectAttemptsInRow || 0,
        is_mastered: data.isMastered || false,
        mastery_date: data.masteryDate,
        last_attempt_date: data.lastAttemptDate
      };
      
      // Cache the progress
      localStorage.setItem(`mastery_progress_${reference}`, JSON.stringify({
        progress,
        timestamp: Date.now()
      }));

      // Also update the last attempt timestamp in localStorage if it exists
      if (progress.last_attempt_date) {
        localStorage.setItem(`last_attempt_${reference}`, progress.last_attempt_date.toString());
      }

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

  // Update handleMasteryToggle to show overlay
  const handleMasteryToggle = async (reference: string): Promise<void> => {
    if (masteryState.activeVerse === reference) {
      setMasteryState(prev => ({ ...prev, activeVerse: null }));
      setShowOverlay(false);
    } else {
      const progress = await fetchMasteryProgress(reference);
      setMasteryState(prev => ({
        ...prev,
        activeVerse: reference,
        attempt: '',
        feedback: null,
        progress
      }));
      setShowOverlay(true);
    }
  };

  // Add handler for overlay click
  const handleOverlayClick = () => {
    if (activeVerseId) {
      setActiveVerseId(null);
      setShowOverlay(false);
    }
    if (masteryState.activeVerse) {
      setMasteryState(prev => ({ ...prev, activeVerse: null }));
      setShowOverlay(false);
    }
  };

  // Add helper function to normalize words (remove punctuation and convert to lowercase)
  const normalizeWord = (word: string): string => {
    return word.toLowerCase().replace(/[.,;:!?'"—_()\[\]/…]/g, '');
  };

  // Helper function to split verse text properly, handling emdashes and special characters
  const splitVerseText = (text: string): string[] => {
    // Attach emdashes to the preceding word so they don't become separate words
    // Also split on hyphens to separate hyphenated words
    let processedText = text.replace(/—/g, '— ');
    processedText = processedText.replace(/-/g, ' ');
    // Split on whitespace and filter out empty strings
    return processedText.split(/\s+/).filter(word => word.length > 0);
  };

  // Update handleMasteryAttempt to update progress immediately
  const handleMasteryAttempt = async (reference: string) => {
    if (masteryState.isSubmitting) return;
    setMasteryState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        throw new Error('No session token found');
      }

      const verse = verses.find(v => v.reference === reference);
      if (!verse) {
        throw new Error('Verse not found');
      }

      const words = splitVerseText(verse.text);
      const attempt = masteryState.attempt.trim();
      const attemptWords = splitVerseText(attempt);

      // Calculate accuracy
      const correctWords = attemptWords.filter((word, index) => 
        normalizeWord(word) === normalizeWord(words[index])
      );
      const accuracy = correctWords.length / words.length;
      const accuracyPercent = Math.round(accuracy * 100);

      // Check if this will trigger mastery
      const currentProgress = masteryState.progress || {
        total_attempts: 0,
        overall_accuracy: 0,
        consecutive_perfect: 0,
        is_mastered: false
      };

      const willTriggerMastery = accuracy === 1 && 
        currentProgress.consecutive_perfect === 2 && 
        currentProgress.total_attempts >= 4;

      let feedbackMessage = '';

      if (accuracy === 1) {
        if (willTriggerMastery) {
          feedbackMessage = "Perfect! You've mastered this verse! 🎉";
        } else {
          feedbackMessage = "Perfect! That's exactly right! Come back tomorrow to make your next attempt.";
        }
        // Store the attempt timestamp only for perfect attempts
        localStorage.setItem(`last_attempt_${reference}`, Date.now().toString());
      } else if (accuracy >= 0.95) {
        feedbackMessage = `Great job! You got ${accuracyPercent}% correct. You can try again immediately!`;
      } else if (accuracy >= 0.8) {
        feedbackMessage = `Good attempt! You got ${accuracyPercent}% correct. You can try again immediately!`;
      } else {
        feedbackMessage = `Keep practicing! You need at least 80% accuracy to record an attempt.`;
        setMasteryState(prev => ({
          ...prev,
          feedback: {
            isCorrect: false,
            message: feedbackMessage,
            attempt: masteryState.attempt
          },
          attempt: '',
          isSubmitting: false
        }));
        return; // Don't record attempts below 80%
      }

      // Check 24-hour cooldown for perfect attempts
      if (accuracy === 1) {
        const timeUntilNext = await getTimeUntilNextAttempt(reference);
        if (timeUntilNext && timeUntilNext !== '') {
          setMasteryState(prev => ({
            ...prev,
            feedback: {
              isCorrect: false,
              message: `24-hour cooldown active. You can make your next attempt in ${timeUntilNext}.`,
              attempt: masteryState.attempt
            },
            attempt: '',
            isSubmitting: false
          }));
          return;
        }
      }

      // Only make the API call if accuracy is >= 80%
      const response = await fetch(`${getApiUrl()}/progress/verse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          verse_reference: reference,
          words_correct: correctWords.length,
          total_words: words.length
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429 && errorData.error?.includes('24-hour cooldown')) {
          throw new Error(errorData.error);
        }
        throw new Error('Failed to record attempt');
      }

      // Fetch updated mastery progress from the backend
      const progressResponse = await fetch(`${getApiUrl()}/progress/mastery/${reference}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!progressResponse.ok) throw new Error('Failed to fetch mastery progress');

      const progressData = await progressResponse.json();
      const updatedProgress = {
        total_attempts: progressData.totalAttempts || 0,
        overall_accuracy: progressData.overallAccuracy || 0,
        consecutive_perfect: progressData.perfectAttemptsInRow || 0,
        is_mastered: progressData.isMastered || false,
        mastery_date: progressData.masteryDate,
        last_attempt_date: progressData.lastAttemptDate
      };

      // Update mastery state with new progress
      setMasteryState(prev => ({
        ...prev,
        feedback: {
          isCorrect: accuracy === 1,
          message: feedbackMessage,
          attempt: masteryState.attempt
        },
        attempt: '',
        progress: updatedProgress
      }));

      // Cache the updated progress
      localStorage.setItem(`mastery_progress_${reference}`, JSON.stringify({
        progress: updatedProgress,
        timestamp: Date.now()
      }));

      if (updatedProgress.is_mastered) {
        await onStatusChange(reference, ProgressStatus.Mastered);
        // Wait for the backend to process mastery and points
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Refresh points and streaks from server
        await refreshPoints();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record attempt. Please try again.';
      setMasteryState(prev => ({
        ...prev,
        feedback: {
          isCorrect: false,
          message: errorMessage,
          attempt: masteryState.attempt
        }
      }));
    } finally {
      setMasteryState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Update handleMasteryInput to remove redundant paste detection
  const handleMasteryInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
        case 'b':
          // Go back 10 words
          if (activeVerseId === verseReference) {
            e.preventDefault();
            handleGoBack10Words(verseReference);
            setAnnouncedWord('Going back 10 words. Your streak has been reset.');
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

  // Helper function to reset verse streak on backend
  const resetVerseStreak = async (reference: string) => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) return;

      await fetch(`${getApiUrl()}/progress/reset-streak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ verse_reference: reference })
      });
    } catch (error) {
      console.error('Error resetting verse streak:', error);
    }
  };

  // Update handleStart to use number[] for revealedWords
  const handleStart = (reference: string) => {
    setActiveVerseId(reference);
    setRevealedWords([]);
    setShowFullVerse(prev => ({
      ...prev,
      [reference]: false,
    }));
    setUserGuess('');
    setGuessFeedback(null);
    setShowOverlay(true);
    setConsecutiveCorrectGuesses(0);
    void resetVerseStreak(reference);
    
    // Reset current streak when starting a new verse
    updateCurrentStreak(0);
    
    // Clear recorded words from localStorage for this verse
    setRecordedWords(prev => {
      const newRecordedWords = prev.filter(word => word.verse_reference !== reference);
      localStorage.setItem('recordedWords', JSON.stringify(newRecordedWords));
      return newRecordedWords;
    });

    // Find the verse and update its status if needed
    const verse = verses.find(v => v.reference === reference);
    if (verse?.status === ProgressStatus.NotStarted) {
      void handleStatusChange(reference, ProgressStatus.InProgress, false);
    }

    // Focus input after a short delay
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Add function to find the first unrevealed word index
  const findFirstUnrevealedWordIndex = useCallback((words: string[]): number => {
    const verse = verses.find(v => v.reference === activeVerseId);
    if (!verse) return 0;

    const verseWords = splitVerseText(verse.text);
    for (let i = 0; i < verseWords.length; i++) {
      if (!revealedWords.includes(i)) {
        return i;
      }
    }
    return verseWords.length;
  }, [revealedWords, activeVerseId, verses]);

  // Update handleShowHint to reveal the word
  const handleShowHint = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    const words = splitVerseText(verse.text);
    const nextWordIndex = findFirstUnrevealedWordIndex(words);
    
    // Reset streak when using hint
    setConsecutiveCorrectGuesses(0);
    void resetVerseStreak(reference);
    
    // Ensure we don't try to reveal beyond the verse length
    if (nextWordIndex >= words.length) {
      setGuessFeedback({
        isCorrect: false,
        message: "Great job! Practice again with the reset button."
      });
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
  };

  // Update handleReset to use number[] for revealedWords
  const handleReset = async (reference: string, clearProgress: boolean = false) => {
    setRevealedWords([]);
    setShowFullVerse(prev => ({
      ...prev,
      [reference]: false,
    }));
    setActiveVerseId(null);
    setUserGuess('');
    setGuessFeedback(null);
    setConsecutiveCorrectGuesses(0);
    setShowOverlay(false);
    
    // Clear recorded words from localStorage for this verse
    setRecordedWords(prev => {
      const newRecordedWords = prev.filter(word => word.verse_reference !== reference);
      localStorage.setItem('recordedWords', JSON.stringify(newRecordedWords));
      return newRecordedWords;
    });

    // Send a reset signal to the server to break the streak
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        await fetch(`${getApiUrl()}/progress/word`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          },
          body: JSON.stringify({
            verse_reference: reference,
            word_index: -1, // Special index to indicate reset
            word: 'RESET',
            is_correct: false,
            timestamp: Date.now()
          })
        });
      }
    } catch (error) {
      debug.error('api', 'Error sending reset signal:', error);
    }
  };

  // Add handler for going back 10 words in practice mode
  const handleGoBack10Words = (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    const verseWords = splitVerseText(verse.text);
    const currentRevealedCount = revealedWords.length;
    
    // Calculate how many words to go back (minimum of 10 or all revealed words)
    const wordsToGoBack = Math.min(10, currentRevealedCount);
    
    if (wordsToGoBack === 0) {
      // No words to go back
      setGuessFeedback({
        isCorrect: false,
        message: "No words to go back to. Start memorizing first!"
      });
      setTimeout(() => setGuessFeedback(null), 3000);
      return;
    }

    // Remove the last N words from revealedWords
    const newRevealedWords = revealedWords.slice(0, -wordsToGoBack);
    setRevealedWords(newRevealedWords);
    
    // Reset the consecutive correct guesses streak
    setConsecutiveCorrectGuesses(0);
    
    // Reset the verse streak on the backend
    void resetVerseStreak(reference);
    
    // Provide user feedback
    setGuessFeedback({
      isCorrect: true,
      message: `Went back ${wordsToGoBack} word${wordsToGoBack !== 1 ? 's' : ''}. Your streak has been reset.`
    });
    
    // Clear feedback after delay
    setTimeout(() => {
      setGuessFeedback(null);
    }, 4000);
    
    // Focus the input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Update handleGuessSubmit to use batching and immediate UI updates
  const handleGuessSubmit = async (reference: string) => {
    const verse = verses.find(v => v.reference === reference);
    if (!verse) return;

    if (!userGuess.trim()) return;

    const words = userGuess.trim().split(/\s+/);
    const verseWords = splitVerseText(verse.text);
    const nextWordIndex = findFirstUnrevealedWordIndex(verseWords);
    
    // Normalize both the user's guess and the verse words for comparison
    const isCorrect = words.every((word, i) => {
      const verseWord = verseWords[nextWordIndex + i];
      return normalizeWord(verseWord) === normalizeWord(word);
    });

    // Check if this will complete the verse
    const willCompleteVerse = nextWordIndex + words.length >= verseWords.length;
    
    // Immediately update UI for better responsiveness
    setUserGuess('');
    
    // Set appropriate feedback message
    if (isCorrect) {
      if (willCompleteVerse) {
        setGuessFeedback({
          isCorrect: true,
          message: "Perfect! Verse completed. Your streak has been reset for the next verse."
        });
      } else {
        setGuessFeedback({
          isCorrect: true,
          message: "Great job! Keep going!"
        });
      }
    } else {
      setGuessFeedback({
        isCorrect: false,
        message: "Not quite right. Try again or use the hint button."
      });
    }

    // Reset streak for incorrect guesses
    if (!isCorrect) {
      setConsecutiveCorrectGuesses(0);
      
      // Also reset the streak in localStorage to ensure API consistency
      localStorage.setItem('current_word_guess_streak', '0');
      
      // Check if this was during a record streak and trigger red flash
      const currentLongestStreak = parseInt(localStorage.getItem('longest_word_guess_streak') || '0', 10);
      const currentStreak = consecutiveCorrectGuesses;
      
      if (currentStreak >= currentLongestStreak * 0.8) { // Flash if within 80% of record
        setShowRedFlash(true);
        setTimeout(() => setShowRedFlash(false), 500); // Flash for 500ms
      }
      
      // Check for pending social share achievement after streak resets due to incorrect guess
      debug.log('api', 'Checking for social share achievement after incorrect guess...');
      const hasAchievement = hasUnsharedAchievement();
      debug.log('api', 'hasUnsharedAchievement result (incorrect guess):', hasAchievement);
      
      if (hasAchievement) {
        const achievement = getPendingAchievement();
        debug.log('api', 'Found achievement (incorrect guess):', achievement);
        if (achievement) {
          debug.log('api', 'Setting social share modal to open with achievement (incorrect guess):', achievement);
          // Add 2.5 second delay and check if streak is still at 0
          setTimeout(() => {
            const currentStreak = parseInt(localStorage.getItem('current_word_guess_streak') || '0', 10);
            if (currentStreak === 0) {
              setSocialShareModal({
                isOpen: true,
                achievement
              });
            }
          }, 2500);
        }
      } else {
        debug.log('api', 'No unshared achievement found (incorrect guess)');
      }
    }

    // Clear feedback after delay (longer for completion message)
    setTimeout(() => {
      setGuessFeedback(null);
    }, willCompleteVerse ? 5000 : 8000);

    // Calculate points and streaks locally for immediate feedback
    let totalPointsEarned = 0;
    let totalStreakLength = 0;
    const correctWordIndices: number[] = [];
    const currentLongestStreak = parseInt(localStorage.getItem('longest_word_guess_streak') || '0', 10);
    let newLongestStreak = currentLongestStreak;

    for (let i = 0; i < words.length; i++) {
      const wordIndex = nextWordIndex + i;
      const word = words[i];
      const verseWord = verseWords[wordIndex];
      const wordIsCorrect = normalizeWord(verseWord) === normalizeWord(word);

      if (wordIsCorrect) {
        // Calculate points locally (1 point for first word, streak position for consecutive)
        const currentStreak = consecutiveCorrectGuesses + i + 1;
        const pointsForWord = currentStreak;
        totalPointsEarned += pointsForWord;
        totalStreakLength = currentStreak;
        correctWordIndices.push(wordIndex);
        
        // Update longest word guess streak if this streak is longer
        if (currentStreak > newLongestStreak) {
          newLongestStreak = currentStreak;
        }
      }
    }

    // Update UI immediately with local calculations
    if (totalPointsEarned > 0) {
      const currentPoints = parseInt(localStorage.getItem('points') || '0', 10);
      const newPoints = currentPoints + totalPointsEarned;
      localStorage.setItem('points', newPoints.toString());
      updatePoints(newPoints);

      // Update streak locally
      const currentStreak = parseInt(localStorage.getItem('streak') || '0', 10);
      const newStreak = currentStreak + totalStreakLength;
      localStorage.setItem('streak', newStreak.toString());

      // Update longest word guess streak if beaten
      if (newLongestStreak > currentLongestStreak) {
        updateLongestWordGuessStreak(newLongestStreak);
        
        // Check if this qualifies for social sharing achievement
        console.log('New longest streak achieved:', newLongestStreak);
        saveAchievementForSharing(newLongestStreak);
        console.log('Achievement saved for sharing');
        
        // Send the new longest streak to the server asynchronously (non-blocking)
        void (async () => {
          try {
            const sessionToken = localStorage.getItem('session_token');
            if (sessionToken) {
              await fetch(`${getApiUrl()}/gamification/points`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${sessionToken}`
                },
                body: JSON.stringify({
                  event_type: 'word_correct',
                  points: 0, // No additional points, just updating the streak
                  metadata: {
                    streak_length: newLongestStreak,
                    is_new_longest: true
                  },
                  created_at: Date.now()
                })
              });
            }
          } catch (error) {
            debug.error('api', 'Error updating longest streak on server:', error);
          }
        })();
      }

          // Add correct words to revealedWords immediately
    setRevealedWords(prev => [...prev, ...correctWordIndices]);
    
    // Update activeVerseId to ensure we're tracking the next word
    setActiveVerseId(reference);

    // Update consecutive correct guesses
    setConsecutiveCorrectGuesses(prev => prev + words.filter((word, i) => {
      const verseWord = verseWords[nextWordIndex + i];
      return normalizeWord(verseWord) === normalizeWord(word);
    }).length);

    // Check if this completes the verse and force sync if so
    const newRevealedWords = [...revealedWords, ...correctWordIndices];
    if (newRevealedWords.length >= verseWords.length) {
      // Verse is completed, reset streak and force immediate sync
      // Use a small delay to ensure the completion feedback is shown first
      setTimeout(() => {
        // Save verse completion achievement before resetting streak
        const currentStreakBeforeReset = consecutiveCorrectGuesses + words.filter((word, i) => {
          const verseWord = verseWords[nextWordIndex + i];
          return normalizeWord(verseWord) === normalizeWord(word);
        }).length;
        
        // Save verse completion achievement (this can trigger social sharing for short verses)
        saveVerseCompletionAchievement(currentStreakBeforeReset, verseWords.length);
        
        setConsecutiveCorrectGuesses(0);
        updateCurrentStreak(0);
        void resetVerseStreak(reference);
        void forceSync();
        
        // Check for pending social share achievement after streak resets
        debug.log('api', 'Checking for social share achievement after streak reset...');
        const hasAchievement = hasUnsharedAchievement();
        debug.log('api', 'hasUnsharedAchievement result:', hasAchievement);
        
        if (hasAchievement) {
          const achievement = getPendingAchievement();
          debug.log('api', 'Found achievement:', achievement);
          if (achievement) {
            debug.log('api', 'Setting social share modal to open with achievement:', achievement);
            // Add 2.5 second delay and check if streak is still at 0
            setTimeout(() => {
              const currentStreak = parseInt(localStorage.getItem('current_word_guess_streak') || '0', 10);
              if (currentStreak === 0) {
                setSocialShareModal({
                  isOpen: true,
                  achievement
                });
              }
            }, 2500);
          }
        } else {
          debug.log('api', 'No unshared achievement found');
        }
      }, 200); // Small delay to ensure feedback is processed first
    }
    }

    // Queue word progress for batched API submission instead of immediate API calls
    const timestamp = Date.now();
    const wordProgressItems: WordProgress[] = words.map((word, i) => {
      const wordIndex = nextWordIndex + i;
      const verseWord = verseWords[wordIndex];
      const wordIsCorrect = normalizeWord(verseWord) === normalizeWord(word);
      
      return {
        verse_reference: verse.reference,
        word_index: wordIndex,
        word: word,
        is_correct: wordIsCorrect,
        timestamp: timestamp + i // Ensure proper ordering
      };
    });

    // Add to queue for batched processing
    setWordProgressQueue(prev => [...prev, ...wordProgressItems]);

    // Trigger sync after a short delay to allow for more words to be queued
    setTimeout(() => {
      syncProgress();
    }, 1000); // 1 second delay for batching

    // Refresh points from server more frequently to get updated longest word guess streak
    // But still avoid refreshing on every single word to maintain performance
    const lastPointsRefresh = localStorage.getItem('last_points_refresh');
    const now = Date.now();
    if (!lastPointsRefresh || (now - parseInt(lastPointsRefresh)) > 30 * 1000) { // 30 seconds instead of 5 minutes
      setTimeout(() => {
        void refreshPoints();
        localStorage.setItem('last_points_refresh', now.toString());
      }, 2000); // 2 second delay to avoid blocking UI
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
      setConsecutiveCorrectGuesses(0);
      void resetVerseStreak(reference);
      return newState;
    });
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

  // Social share modal handlers
  const handleSocialShareModalClose = () => {
    // Mark the achievement as shared (even if user just dismisses) so it won't show again
    // until a new record is achieved
    markAchievementAsShared();
    debug.log('api', 'Achievement marked as shared (dismissed)');
    
    setSocialShareModal({
      isOpen: false,
      achievement: null
    });
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
    if (showFullVerse[verse.reference]) {
      return (
        <Text fontSize="lg" color={textColor}>
          {verse.text}
        </Text>
      );
    }

    if (activeVerseId === verse.reference) {
      const words = splitVerseText(verse.text);
      const nextWordIndex = findFirstUnrevealedWordIndex(words);
      const maxWords = 30;
      
      // Calculate the visible range centered around the current word
      const halfWindow = Math.floor(maxWords / 2);
      let startIndex = Math.max(0, nextWordIndex - halfWindow);
      let endIndex = Math.min(words.length, startIndex + maxWords);
      
      // Adjust if we're near the end
      if (endIndex === words.length) {
        startIndex = Math.max(0, endIndex - maxWords);
      }

      return (
        <VStack align="stretch" spacing={3}>
          <Text fontSize="lg" color={textColor}>
            {startIndex > 0 && '... '}
            {words.slice(startIndex, endIndex).map((word, index) => {
              const actualIndex = startIndex + index;
              const isRevealed = revealedWords.includes(actualIndex);
              const isNextWord = actualIndex === nextWordIndex;
              return (
                <React.Fragment key={actualIndex}>
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
                  {actualIndex < words.length - 1 ? ' ' : ''}
                </React.Fragment>
              );
            })}
            {endIndex < words.length && ' ...'}
          </Text>
          <Flex direction="column" align="center" gap={2}>
            <Flex gap={2} align="center" justify="center" width="100%">
              <Input
                ref={inputRef}
                value={userGuess}
                onChange={(e) => {
                  const value = e.target.value;
                  // If the last character is a space, trigger submission
                  if (value.endsWith(' ')) {
                    e.preventDefault();
                    // Remove the space before submitting
                    const sanitizedValue = value.slice(0, -1).replace(/[^a-zA-Z0-9.,;:!?'"—]/g, '');
                    setUserGuess(sanitizedValue);
                    handleGuessSubmit(verse.reference);
                    return;
                  }
                  // Otherwise just sanitize normally
                  const sanitizedValue = value.replace(/[^a-zA-Z0-9.,;:!?'"—]/g, '');
                  setUserGuess(sanitizedValue);
                  if (sanitizedValue.length > 1) {
                    setGuessFeedback(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && userGuess.endsWith(' ')) {
                    e.preventDefault();
                    const sanitizedValue = userGuess.slice(0, -1).replace(/[^a-zA-Z0-9.,;:!?'"—]/g, '');
                    setUserGuess(sanitizedValue);
                    handleGuessSubmit(verse.reference);
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGuessSubmit(verse.reference);
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === ' ') {
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
                bg={inputBg}
                borderColor={inputBorderColor}
                _placeholder={{
                  color: useColorModeValue('gray.500', 'gray.400'),
                  opacity: 1
                }}
                _focus={{
                  outline: 'none',
                  boxShadow: inputFocusShadow,
                  scrollBehavior: 'auto',
                  scrollMargin: 0
                }}
              />
              <input
                type="text"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    handleGuessSubmit(verse.reference);
                  }
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
              {isSyncing && (
                <HStack spacing={2}>
                  <Spinner size="xs" />
                  <Text fontSize="xs" color="gray.500">
                    Saving progress...
                  </Text>
                </HStack>
              )}
            </Box>
          </Flex>
        </VStack>
      );
    }

    return (
      <Text fontSize="lg" color={textColor}>
        {(() => {
          const words = splitVerseText(verse.text);
          const maxWords = 30; // Show approximately 3 lines worth of blanks
          const displayWords = words.slice(0, maxWords);
          const blanks = displayWords.map(() => '_____').join(' ');
          return words.length > maxWords ? `${blanks} ...` : blanks;
        })()}
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
      <Box key={`${reference}-${status}`} position="relative">
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
      {[
        { status: ProgressStatus.NotStarted, label: "Not Started", shortcut: "1" },
        { status: ProgressStatus.InProgress, label: "In Progress", shortcut: "2" },
        { status: ProgressStatus.Mastered, label: "Mastered", shortcut: "3" }
      ].map(({ status, label, shortcut }) => (
        <Box key={`${verse.reference}-${status}`}>
          {renderStatusButton(verse.reference, status, label, shortcut)}
        </Box>
      ))}
      <Text
        key={`status-description-${verse.reference}`}
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
    const isActive = activeVerseId === verse.reference || isInMasteryMode;
    
    return (
      <Box
        key={verse.reference}
        ref={el => verseRefs.current[verse.reference] = el}
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        position="relative"
        role="article"
        aria-labelledby={`verse-${verse.reference}`}
        tabIndex={isActive ? -1 : 0}
        zIndex={isActive ? 101 : 1}
        opacity={!isActive && showOverlay ? 0.25 : 1}
        filter={!isActive && showOverlay ? "blur(1px)" : "none"}
        transition="all 0.1s ease-in-out"
        bg={verseCardBg}
        _hover={{
          bg: verseCardHoverBg
        }}
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
                      {!showFullVerse[verse.reference] && revealedWords.length < splitVerseText(verse.text).length && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowHint(verse.reference);
                            inputRef.current?.focus();
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            handleShowHint(verse.reference);
                            inputRef.current?.focus();
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
                      {revealedWords.length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGoBack10Words(verse.reference);
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            handleGoBack10Words(verse.reference);
                          }}
                          role="button"
                          aria-label={`Go back 10 words for ${verse.reference}`}
                          _focus={{
                            outline: 'none',
                            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                          }}
                          _focusVisible={{
                            outline: 'none',
                            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                          }}
                        >
                          Go Back 10 Words {renderKeyboardShortcut('B')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReset(verse.reference, true);  // Explicitly clear progress
                          inputRef.current?.focus();
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          handleReset(verse.reference, true);  // Explicitly clear progress
                          inputRef.current?.focus();
                        }}
                        role="button"
                        aria-label={`Reset progress for ${verse.reference}`}
                        _focus={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                        _focusVisible={{
                          outline: 'none',
                          boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
                        }}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowVerse(verse.reference);
                          inputRef.current?.focus();
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          handleShowVerse(verse.reference);
                          inputRef.current?.focus();
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

          <MasteryMode
            verse={verse}
            attempt={masteryState.attempt}
            isSubmitting={masteryState.isSubmitting}
            feedback={masteryState.feedback}
            progress={masteryState.progress}
            onAttempt={handleMasteryAttempt}
            onToggle={handleMasteryToggle}
            onInput={handleMasteryInput}
            onKeyDown={handleMasteryKeyDown}
            isVisible={isInMasteryMode}
          />

          {verse.status === ProgressStatus.InProgress && !isInMasteryMode && (
            <Button
              size="sm"
              variant="solid"
              bg={masteryButtonBg}
              color={masteryButtonColor}
              borderColor={masteryButtonBorderColor}
              borderWidth="1px"
              onClick={() => handleMasteryToggle(verse.reference)}
              mt={2}
              _hover={{
                bg: masteryButtonHoverBg,
                borderColor: masteryButtonHoverBorderColor,
              }}
              _active={{
                bg: masteryButtonActiveBg,
                borderColor: masteryButtonActiveBorderColor,
              }}
            >
              Enter Mastery Mode
            </Button>
          )}
        </VStack>
      </Box>
    );
  };

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
        bg={dialogOverlayBg}
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
          bg={dialogContentBg}
          color={dialogContentColor}
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
                  bg={dialogDetailsBg}
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
        bg={shortcutsModalBg}
        color={shortcutsModalColor}
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
        bg={errorBg}
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
    <Box w="100%" position="relative">
      {/* Red flash overlay for record streak failures */}
      {showRedFlash && (
        <Box
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="red.500"
          opacity="0.3"
          zIndex="9999"
          pointerEvents="none"
          transition="opacity 0.5s ease-in-out"
        />
      )}
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

      <VerseOverlay
        activeVerseRef={activeVerseId ? verseRefs.current[activeVerseId] : masteryState.activeVerse ? verseRefs.current[masteryState.activeVerse] : { current: null }}
        onOverlayClick={handleOverlayClick}
        isVisible={showOverlay}
      />

      {renderDeleteDialog()}
      {renderShortcutsModal()}
      
      {/* Social Share Modal */}
      {socialShareModal.isOpen && socialShareModal.achievement && (
        <SocialShareModal
          isOpen={socialShareModal.isOpen}
          onClose={handleSocialShareModalClose}
          achievement={socialShareModal.achievement}
        />
      )}
    </Box>
  );
}); 