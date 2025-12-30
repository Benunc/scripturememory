import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  CardHeader,
  useToast,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
  Divider,
  SimpleGrid,
  Progress,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { useFamilyGame } from '../hooks/useFamilyGame';
import { useAuthContext } from '../contexts/AuthContext';
import { debug } from '../utils/debug';

export function GamePlay() {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { token, isAuthenticated } = useAuthContext();
  
  // Get participant data from localStorage
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isLoadingParticipant, setIsLoadingParticipant] = useState(true);
  const [forceBetweenRounds, setForceBetweenRounds] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load participant data
  useEffect(() => {
    if (!gameCode) {
      navigate('/family-games/join');
      return;
    }

    const storedParticipantId = localStorage.getItem('family_game_participant_id');
    const storedGameCode = localStorage.getItem('family_game_code');
    const storedDisplayName = localStorage.getItem('family_game_display_name');

    if (storedParticipantId && storedGameCode === gameCode && storedDisplayName) {
      setParticipantId(storedParticipantId);
      setDisplayName(storedDisplayName);
    } else {
      // No participant data - redirect to join
      navigate(`/family-games/${gameCode}/join`);
      return;
    }

    // Check if user is creator (authenticated and game creator)
    // We'll determine this from game state, but for now assume authenticated users might be creators
    if (isAuthenticated && token) {
      setIsCreator(true);
    }
    
    setIsLoadingParticipant(false);
  }, [gameCode, navigate, isAuthenticated, token]);

  const {
    game,
    loading,
    error,
    refreshGame,
    openNextRound,
    startRoundForParticipant,
    selectWordForParticipant,
    startGame: handleStartGame,
    approveParticipant,
    leaveGame,
    endGame
  } = useFamilyGame({
    gameCode: gameCode || '',
    participantId: participantId || undefined,
    isCreator,
    autoPoll: !isLoadingParticipant && (participantId || (isAuthenticated && token))
  });

  // Wait for participant data to load
  if (isLoadingParticipant) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.lg" py={8} flex="1">
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text>Loading participant data...</Text>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  // Determine current view based on game state
  if (loading && !game) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.lg" py={8} flex="1">
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text>Loading game...</Text>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  if (error && !game) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.lg" py={8} flex="1">
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
          <Button mt={4} onClick={() => navigate('/family-games/join')}>
            Go to Join Page
          </Button>
        </Container>
        <Footer />
      </Box>
    );
  }

  if (!game) {
    return null;
  }

  // Determine view based on game status
  if (game.status === 'waiting') {
    return <WaitingRoom game={game} isCreator={isCreator} onStartGame={handleStartGame} onApproveParticipant={approveParticipant} />;
  }

  if (game.status === 'playing') {
    const currentRound = game.currentRound ? game.rounds.find(r => r.roundNumber === game.currentRound) : null;
    
    if (!currentRound) {
      // Between rounds - show leaderboard
      return <BetweenRounds game={game} isCreator={isCreator} onOpenNextRound={openNextRound} />;
    }

    // Check if round is available
    // If round status is not 'available', show between rounds view
    // Also show between rounds if forced (e.g., creator finished and all ready)
    if (forceBetweenRounds) {
      // Reset force flag when game state updates
      if (currentRound && currentRound.roundStatus !== 'available') {
        setForceBetweenRounds(false);
      }
      return <BetweenRounds game={game} isCreator={isCreator} onOpenNextRound={openNextRound} />;
    }
    
    if (currentRound.roundStatus === 'available') {
      // Check if all participants are ready - if so, show between rounds
      // This allows participants to see the between rounds view when all are done
      const allReady = currentRound.participantsReady !== undefined && 
                       currentRound.totalActiveParticipants !== undefined &&
                       currentRound.totalActiveParticipants > 0 &&
                       currentRound.participantsReady >= currentRound.totalActiveParticipants;
      
      // If all participants are ready, show between rounds (round is effectively done)
      if (allReady) {
        return <BetweenRounds game={game} isCreator={isCreator} onOpenNextRound={openNextRound} />;
      }
      
      // Active round - show gameplay interface
      return (
        <GameRoundInterface
          game={game}
          round={currentRound}
          participantId={participantId || ''}
          displayName={displayName || ''}
          isCreator={isCreator}
          onStartRound={startRoundForParticipant}
          onSelectWord={selectWordForParticipant}
          refreshGame={refreshGame}
          onForceBetweenRounds={() => setForceBetweenRounds(true)}
        />
      );
    } else {
      // Round not yet available, soft-closed, or completed - show between rounds view
      return <BetweenRounds game={game} isCreator={isCreator} onOpenNextRound={openNextRound} />;
    }
  }

  if (game.status === 'completed' || game.status === 'ended') {
    return <GameComplete game={game} />;
  }

  return null;
}

// Waiting Room Component
interface WaitingRoomProps {
  game: any;
  isCreator: boolean;
  onStartGame: () => Promise<boolean>;
  onApproveParticipant: (participantId: string, approve: boolean) => Promise<boolean>;
}

function WaitingRoom({ game, isCreator, onStartGame, onApproveParticipant }: WaitingRoomProps) {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const handleStart = async () => {
    const success = await onStartGame();
    if (success) {
      toast({
        title: 'Game Started!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleApprove = async (participantId: string, approve: boolean) => {
    const success = await onApproveParticipant(participantId, approve);
    if (success) {
      toast({
        title: approve ? 'Participant Approved' : 'Participant Rejected',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const approvedParticipants = game.participants?.filter((p: any) => p.isApproved && p.status === 'active') || [];
  const pendingParticipants = game.participants?.filter((p: any) => !p.isApproved && p.status === 'active') || [];

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.lg" py={8} flex="1">
        <VStack spacing={6} align="stretch">
          <Heading size="lg">Waiting Room</Heading>
          <Text color="gray.500">Game Code: <strong>{game.gameCode}</strong></Text>

          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Participants ({game.participants?.length || 0})</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                {approvedParticipants.length > 0 && (
                  <>
                    <Text fontWeight="bold">Approved ({approvedParticipants.length})</Text>
                    {approvedParticipants.map((p: any) => (
                      <HStack key={p.participantId} justify="space-between">
                        <Text>{p.displayName}</Text>
                        <Badge colorScheme="green">Approved</Badge>
                      </HStack>
                    ))}
                  </>
                )}

                {isCreator && pendingParticipants.length > 0 && (
                  <>
                    <Divider />
                    <Text fontWeight="bold">Pending Approval ({pendingParticipants.length})</Text>
                    {pendingParticipants.map((p: any) => (
                      <HStack key={p.participantId} justify="space-between">
                        <Text>{p.displayName}</Text>
                        <HStack>
                          <Button size="sm" colorScheme="green" onClick={() => handleApprove(p.participantId, true)}>
                            Approve
                          </Button>
                          <Button size="sm" colorScheme="red" onClick={() => handleApprove(p.participantId, false)}>
                            Reject
                          </Button>
                        </HStack>
                      </HStack>
                    ))}
                  </>
                )}

                {!isCreator && pendingParticipants.length > 0 && (
                  <>
                    <Divider />
                    <Text fontWeight="bold">Waiting for Approval ({pendingParticipants.length})</Text>
                    {pendingParticipants.map((p: any) => (
                      <HStack key={p.participantId} justify="space-between">
                        <Text>{p.displayName}</Text>
                        <Badge>Pending</Badge>
                      </HStack>
                    ))}
                  </>
                )}
              </VStack>
            </CardBody>
          </Card>

          {isCreator && (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <VStack spacing={4}>
                  <Text>Ready to start? Make sure all participants are approved.</Text>
                  <Button colorScheme="blue" size="lg" onClick={handleStart} isDisabled={approvedParticipants.length === 0}>
                    Start Game
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          )}

          {!isCreator && (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Text>Waiting for game creator to start the game...</Text>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}

// Between Rounds Component
interface BetweenRoundsProps {
  game: any;
  isCreator: boolean;
  onOpenNextRound: (roundNumber: number) => Promise<boolean>;
}

function BetweenRounds({ game, isCreator, onOpenNextRound }: BetweenRoundsProps) {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const currentRoundNumber = game.currentRound || 0;
  const currentRound = game.rounds.find((r: any) => r.roundNumber === currentRoundNumber);
  const nextRoundNumber = currentRoundNumber + 1;
  const nextRound = game.rounds.find((r: any) => r.roundNumber === nextRoundNumber);
  const totalRounds = game.rounds.length;

  // Check if all rounds are complete
  // All rounds are complete if:
  // 1. We've played all rounds (currentRoundNumber >= totalRounds)
  // 2. OR the last round exists and is soft-closed or all participants are ready
  // Check if all rounds are complete
  // A round is complete if it's soft-closed OR all participants have finished it
  // All rounds are complete only if:
  // 1. We've reached or passed the last round number
  // 2. The last round actually exists and has been completed (soft-closed or all participants ready)
  // 3. OR the game status is explicitly 'completed' or 'ended'
  const allRoundsComplete = game.status === 'completed' || game.status === 'ended' ||
    (currentRoundNumber >= totalRounds && currentRound && 
     (currentRound.roundStatus === 'soft_closed' || 
      (currentRound.participantsReady !== undefined && 
       currentRound.totalActiveParticipants !== undefined &&
       currentRound.totalActiveParticipants > 0 &&
       currentRound.participantsReady >= currentRound.totalActiveParticipants)));

  // If all rounds are complete, show game complete screen
  if (allRoundsComplete) {
    return <GameComplete game={game} />;
  }

  // Determine which round to show option for
  // If current round exists but isn't available, show option to open current round
  // Otherwise, show option to open next round
  const roundToOpen = (currentRound && (!currentRound.roundStatus || currentRound.roundStatus === 'not_available')) 
    ? currentRound 
    : nextRound;
  
  // Always calculate the round number to open (even if round object doesn't exist yet)
  const roundNumberToOpen = roundToOpen?.roundNumber || nextRoundNumber;
  
  // Check if there's actually a round at this number in the game
  const roundExists = game.rounds.some((r: any) => r.roundNumber === roundNumberToOpen);

  const handleOpenRound = async () => {
    if (!roundNumberToOpen) return;
    const success = await onOpenNextRound(roundNumberToOpen);
    if (success) {
      toast({
        title: 'Round Opened!',
        description: 'Participants can now start this round.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Determine if round can be opened
  const roundNotAvailable = roundToOpen ? 
    (!roundToOpen.roundStatus || roundToOpen.roundStatus === 'not_available') :
    roundExists; // If round object doesn't exist, it's not available yet
  
  // For participants: need all ready (unless first round)
  const isFirstRound = roundNumberToOpen === 1;
  const allParticipantsReady = roundToOpen && 
    (roundToOpen.participantsReady || 0) >= (roundToOpen.totalActiveParticipants || 0);
  
  // Creator can always open if round exists and is not available
  // Participants can open if it's the first round OR all participants are ready
  const canOpenRound = roundExists && roundNotAvailable && 
    (isCreator || isFirstRound || allParticipantsReady);

  // Debug logging
  debug.log('family-game', 'BetweenRounds state', {
    isCreator,
    currentRoundNumber,
    nextRoundNumber,
    roundNumberToOpen,
    roundExists,
    roundToOpen: roundToOpen ? { roundNumber: roundToOpen.roundNumber, roundStatus: roundToOpen.roundStatus } : null,
    roundNotAvailable,
    canOpenRound
  });

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.lg" py={8} flex="1">
        <VStack spacing={6} align="stretch">
          <Heading size="lg">Between Rounds</Heading>

          {game.leaderboard && game.leaderboard.length > 0 && (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardHeader>
                <Heading size="md">Leaderboard</Heading>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Rank</Th>
                      <Th>Name</Th>
                      <Th>Points</Th>
                      <Th>Rounds</Th>
                      <Th>Accuracy</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {game.leaderboard.map((entry: any, index: number) => (
                      <Tr key={entry.participant_id}>
                        <Td>{entry.rank || index + 1}</Td>
                        <Td>{entry.display_name}</Td>
                        <Td>{entry.total_points}</Td>
                        <Td>{entry.rounds_completed}</Td>
                        <Td>{Math.round(entry.accuracy_percentage)}%</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          )}

          {roundExists ? (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <VStack spacing={4}>
                  <Text fontWeight="bold">
                    {roundToOpen === currentRound ? 'Current Round' : 'Next Round'}: {roundToOpen?.verseReference || `Round ${roundNumberToOpen}`}
                  </Text>
                  {roundToOpen && roundToOpen.participantsReady !== undefined && !isFirstRound && (
                    <Text fontSize="sm" color="gray.500">
                      {roundToOpen.participantsReady || 0} / {roundToOpen.totalActiveParticipants || 0} participants ready
                    </Text>
                  )}
                  {isCreator && roundNotAvailable && (
                    <Button colorScheme="blue" size="lg" onClick={handleOpenRound}>
                      {roundToOpen === currentRound ? 'Open Round' : 'Open Next Round'}
                    </Button>
                  )}
                  {isCreator && !roundNotAvailable && (
                    <Text fontSize="sm" color="gray.500">
                      Round is already open. Participants can start playing.
                    </Text>
                  )}
                  {!isCreator && canOpenRound && (
                    <Button colorScheme="blue" size="lg" onClick={handleOpenRound}>
                      {roundToOpen === currentRound ? 'Open Round' : 'Open Next Round'}
                    </Button>
                  )}
                  {!isCreator && !canOpenRound && (
                    <Text fontSize="sm" color="gray.500">
                      Waiting for all participants to finish...
                    </Text>
                  )}
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <VStack spacing={4}>
                  <Text fontWeight="bold">All Rounds Complete!</Text>
                  <Text fontSize="sm" color="gray.500">
                    The game has finished all rounds.
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}

// Game Round Interface Component
interface GameRoundInterfaceProps {
  game: any;
  round: any;
  participantId: string;
  displayName: string;
  isCreator?: boolean;
  onStartRound: (roundNumber: number) => Promise<boolean>;
  onSelectWord: (roundNumber: number, selectedWord: string, timeTakenMs: number) => Promise<any>;
  refreshGame?: () => Promise<void>;
  onForceBetweenRounds?: () => void;
}

function GameRoundInterface({
  game,
  round,
  participantId,
  displayName,
  isCreator = false,
  onStartRound,
  onSelectWord,
  refreshGame,
  onForceBetweenRounds
}: GameRoundInterfaceProps) {
  const toast = useToast();
  const [roundStarted, setRoundStarted] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(game.timeLimitSeconds);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [allRoundOptions, setAllRoundOptions] = useState<string[]>([]);
  const [wordSelectionStates, setWordSelectionStates] = useState<Map<string, 'correct' | 'wrong_position' | 'not_in_verse' | null>>(new Map());
  const [roundProgress, setRoundProgress] = useState<any>(null);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const pageBg = useColorModeValue('gray.50', 'gray.900');

  // Helper to split verse text (matching backend)
  const splitVerseText = (text: string): string[] => {
    let processedText = text.replace(/—/g, '— ');
    processedText = processedText.replace(/-/g, ' ');
    return processedText.split(/\s+/).filter(word => word.length > 0);
  };

  // Render verse with blanks
  const renderVerseWithBlanks = () => {
    const words = splitVerseText(round.verseText);
    // Sort wordIndicesToHide by index to match backend processing order
    const sortedWordIndices = [...round.wordIndicesToHide].sort((a: any, b: any) => a.index - b.index);
    const hiddenIndices = new Set(sortedWordIndices.map((w: any) => w.index));
    
    // Get completed word indices from progress
    const completedIndices = new Set<number>();
    if (roundProgress && roundProgress.currentWordIndex > 0) {
      // Get all word indices that have been completed (up to currentWordIndex in sorted order)
      for (let i = 0; i < roundProgress.currentWordIndex && i < sortedWordIndices.length; i++) {
        completedIndices.add(sortedWordIndices[i].index);
      }
    }
    
    return words.map((word, index) => {
      if (hiddenIndices.has(index)) {
        // Check if this word has been completed
        const isCompleted = completedIndices.has(index);
        if (isCompleted) {
          return <Text key={index} as="span" fontWeight="bold" color="green.500">{word} </Text>;
        }
        return <Text key={index} as="span" color="blue.500" fontWeight="bold">_____ </Text>;
      }
      return <Text key={index} as="span">{word} </Text>;
    });
  };

  // Start round
  const handleStartRound = async () => {
    const result = await onStartRound(round.roundNumber);
    if (result && result.success) {
      setRoundStarted(true);
      setRoundStartTime(Date.now());
      // Set all round options from startRound response
      if (result.allRoundOptions && result.allRoundOptions.length > 0) {
        setAllRoundOptions(result.allRoundOptions);
        // Initialize all options as unselected
        const initialStates = new Map<string, 'correct' | 'wrong_position' | 'not_in_verse' | null>();
        result.allRoundOptions.forEach((word: string) => {
          initialStates.set(word, null);
        });
        setWordSelectionStates(initialStates);
      }
    }
  };
  
  // Load options from round if available (for rejoin scenarios)
  useEffect(() => {
    if (round.allRoundOptions && round.allRoundOptions.length > 0 && !roundStarted) {
      setAllRoundOptions(round.allRoundOptions);
      const initialStates = new Map<string, 'correct' | 'wrong_position' | 'not_in_verse' | null>();
      round.allRoundOptions.forEach((word: string) => {
        initialStates.set(word, null);
      });
      setWordSelectionStates(initialStates);
    }
  }, [round.allRoundOptions, roundStarted]);

  // Handle word selection
  const handleSelectWord = async (selectedWord: string) => {
    if (!roundStartTime || isRoundComplete) return;
    
    // Check if this word is already yellow (wrong position) - toggle it
    const currentState = wordSelectionStates.get(selectedWord);
    if (currentState === 'wrong_position') {
      // Toggle yellow word to unselected
      setWordSelectionStates(prev => {
        const newStates = new Map(prev);
        newStates.set(selectedWord, null);
        return newStates;
      });
      return;
    }
    
    // If another word is yellow, unselect it first
    setWordSelectionStates(prev => {
      const newStates = new Map(prev);
      prev.forEach((state, word) => {
        if (state === 'wrong_position') {
          newStates.set(word, null);
        }
      });
      return newStates;
    });

    const timeTakenMs = Date.now() - roundStartTime;
    const result = await onSelectWord(round.roundNumber, selectedWord, timeTakenMs);

    if (result) {
      setRoundProgress(result.roundProgress);
      
      // Update selection state for the selected word
      setWordSelectionStates(prev => {
        const newStates = new Map(prev);
        newStates.set(selectedWord, result.selectionStatus);
        return newStates;
      });
      
      // Update all round options if provided
      if (result.allRoundOptions && result.allRoundOptions.length > 0) {
        setAllRoundOptions(result.allRoundOptions);
      }
      
      if (result.isRoundComplete) {
        setIsRoundComplete(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }

      toast({
        title: result.isCorrect ? 'Correct!' : result.selectionStatus === 'wrong_position' ? 'Wrong Position' : 'Not in Verse',
        description: result.message,
        status: result.isCorrect ? 'success' : result.selectionStatus === 'wrong_position' ? 'warning' : 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };


  // Timer effect
  useEffect(() => {
    if (roundStarted && roundStartTime && !isRoundComplete) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        const remaining = game.timeLimitSeconds - elapsed;
        setTimeRemaining(Math.max(0, remaining));

        if (remaining <= 0) {
          setIsRoundComplete(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [roundStarted, roundStartTime, game.timeLimitSeconds, isRoundComplete]);

  // Poll for game state updates when round is complete
  // This allows participants to transition to BetweenRounds when the round status changes
  useEffect(() => {
    if (isRoundComplete && refreshGame) {
      // Stop polling if game is complete
      if (game && (game.status === 'completed' || game.status === 'ended')) {
        return;
      }
      
      // Refresh game state to check if round status has changed
      refreshGame();
      
      // Continue polling every 3 seconds while round is complete (but not if game is done)
      const pollInterval = setInterval(() => {
        if (game && (game.status === 'completed' || game.status === 'ended')) {
          clearInterval(pollInterval);
          return;
        }
        refreshGame();
      }, 3000);

      return () => {
        clearInterval(pollInterval);
      };
    }
  }, [isRoundComplete, refreshGame, game]);

  if (!roundStarted) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.lg" py={8} flex="1">
          <VStack spacing={6} align="stretch">
            <Heading size="lg">Round {round.roundNumber}</Heading>
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <VStack spacing={4}>
                  <Text fontWeight="bold">{round.verseReference}</Text>
                  <Text>{round.verseText}</Text>
                  <Button colorScheme="blue" size="lg" onClick={handleStartRound}>
                    Start Round
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  if (isRoundComplete) {
    // Check if all participants are ready
    const allReady = round.participantsReady !== undefined && 
                     round.totalActiveParticipants !== undefined &&
                     round.participantsReady >= round.totalActiveParticipants;
    
    // For creators who have finished, show option to go to between rounds if all are ready
    if (isCreator && allReady) {
      return (
        <Box minH="100vh" display="flex" flexDirection="column">
          <AppHeader />
          <Container maxW="container.lg" py={8} flex="1">
            <VStack spacing={6} align="stretch">
              <Heading size="lg">Round Complete!</Heading>
              {roundProgress && (
                <Card bg={cardBg} borderColor={borderColor}>
                  <CardBody>
                    <VStack spacing={4}>
                      <Text>Points: {roundProgress.points}</Text>
                      <Text>Words Completed: {roundProgress.wordsCompleted} / {roundProgress.totalWords}</Text>
                      <Text>Longest Streak: {roundProgress.streak}</Text>
                    </VStack>
                  </CardBody>
                </Card>
              )}
              <Card bg={cardBg} borderColor={borderColor}>
                <CardBody>
                  <VStack spacing={4}>
                    <Text>All participants have finished!</Text>
                    <Button colorScheme="blue" size="lg" onClick={async () => {
                      if (refreshGame) {
                        await refreshGame();
                      }
                      // Force transition to between rounds view
                      if (onForceBetweenRounds) {
                        onForceBetweenRounds();
                      }
                    }}>
                      Go to Between Rounds
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </Container>
          <Footer />
        </Box>
      );
    }
    
    // For creators who have finished but not all are ready, or for participants
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.lg" py={8} flex="1">
          <VStack spacing={6} align="stretch">
            <Heading size="lg">Round Complete!</Heading>
            {roundProgress && (
              <Card bg={cardBg} borderColor={borderColor}>
                <CardBody>
                  <VStack spacing={4}>
                    <Text>Points: {roundProgress.points}</Text>
                    <Text>Words Completed: {roundProgress.wordsCompleted} / {roundProgress.totalWords}</Text>
                    <Text>Longest Streak: {roundProgress.streak}</Text>
                  </VStack>
                </CardBody>
              </Card>
            )}
            <Text>Waiting for other participants to finish...</Text>
            {isCreator && (
              <Text fontSize="sm" color="gray.500">
                {round.participantsReady || 0} / {round.totalActiveParticipants || 0} participants ready
              </Text>
            )}
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column" bg={pageBg}>
      <Container maxW="container.lg" px={3} py={2} flex="1" overflowY="auto">
        <VStack spacing={2} align="stretch">
          {/* Compact header with round and timer */}
          <HStack justify="space-between" align="center">
            <Heading size="sm">Round {round.roundNumber}</Heading>
            <Badge colorScheme={timeRemaining > 30 ? 'green' : timeRemaining > 10 ? 'yellow' : 'red'} fontSize="sm" px={2} py={1}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </Badge>
          </HStack>

          <Progress value={(timeRemaining / game.timeLimitSeconds) * 100} colorScheme="blue" size="sm" />

          {/* Compact Verse Display with Blanks */}
          <Box bg={cardBg} borderColor={borderColor} borderWidth="1px" borderRadius="md" p={3}>
            <Text fontSize="xs" color="gray.500" mb={1}>{round.verseReference}</Text>
            <Text fontSize="sm" lineHeight="1.5">
              {renderVerseWithBlanks()}
            </Text>
          </Box>

          {/* Word Selection - Compact grid */}
          {allRoundOptions.length > 0 ? (
            <Box>
              <Text fontSize="xs" fontWeight="bold" mb={2}>Select the next word:</Text>
              <SimpleGrid columns={3} spacing={1}>
                {allRoundOptions.map((word, index) => {
                  const selectionState = wordSelectionStates.get(word);
                  let buttonProps: any = {
                    size: 'sm',
                    onClick: () => handleSelectWord(word),
                    variant: 'outline',
                    fontSize: 'xs',
                    py: 2,
                    px: 1,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  };
                  
                  // Determine button color based on selection state
                  if (selectionState === 'correct') {
                    buttonProps.colorScheme = 'green';
                    buttonProps.variant = 'solid';
                    buttonProps.bg = 'green.500';
                    buttonProps.color = 'white';
                    buttonProps.isDisabled = true;
                  } else if (selectionState === 'not_in_verse') {
                    buttonProps.colorScheme = 'red';
                    buttonProps.variant = 'solid';
                    buttonProps.bg = 'red.500';
                    buttonProps.color = 'white';
                    buttonProps.isDisabled = true;
                  } else if (selectionState === 'wrong_position') {
                    buttonProps.colorScheme = 'yellow';
                    buttonProps.variant = 'solid';
                    buttonProps.bg = 'yellow.400';
                    buttonProps.color = 'black';
                  } else {
                    buttonProps.colorScheme = 'blue';
                    buttonProps.variant = 'outline';
                  }
                  
                  return (
                    <Button
                      key={`${word}-${index}`}
                      {...buttonProps}
                    >
                      {word}
                    </Button>
                  );
                })}
              </SimpleGrid>
            </Box>
          ) : roundStarted && !isRoundComplete && (
            <Text color="gray.500" textAlign="center" fontSize="sm" py={2}>
              Loading word options...
            </Text>
          )}

          {/* Compact Stats */}
          <HStack spacing={4} justify="center" fontSize="xs" color="gray.500" pt={1}>
            {roundProgress ? (
              <>
                <Text>Progress: {roundProgress.wordsCompleted}/{roundProgress.totalWords}</Text>
                <Text>Points: {roundProgress.points || 0}</Text>
                <Text>Streak: {roundProgress.streak || 0}</Text>
              </>
            ) : roundStarted ? (
              <>
                <Text>Progress: 0/{round.wordIndicesToHide?.length || 0}</Text>
                <Text>Points: 0</Text>
                <Text>Streak: 0</Text>
              </>
            ) : null}
          </HStack>
        </VStack>
      </Container>
    </Box>
  );
}

// Game Complete Component
function GameComplete({ game }: { game: any }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Debug logging
  debug.log('family-game', 'GameComplete', {
    hasLeaderboard: !!game.leaderboard,
    leaderboardLength: game.leaderboard?.length || 0,
    leaderboard: game.leaderboard,
    participants: game.participants
  });

  // Build leaderboard from participants if leaderboard is empty
  let leaderboardData = game.leaderboard || [];
  if (leaderboardData.length === 0 && game.participants) {
    // Fallback: create a simple leaderboard from participants
    leaderboardData = game.participants.map((p: any, index: number) => ({
      participant_id: p.participantId,
      display_name: p.displayName,
      total_points: 0,
      rounds_completed: 0,
      accuracy_percentage: 0,
      rank: index + 1
    }));
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.lg" py={8} flex="1">
        <VStack spacing={6} align="stretch">
          <Heading size="lg">Game Complete!</Heading>

          {leaderboardData.length > 0 ? (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardHeader>
                <Heading size="md">Final Leaderboard</Heading>
              </CardHeader>
              <CardBody>
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Rank</Th>
                      <Th>Name</Th>
                      <Th>Points</Th>
                      <Th>Rounds</Th>
                      <Th>Accuracy</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {leaderboardData.map((entry: any, index: number) => (
                      <Tr key={entry.participant_id || entry.participantId || index}>
                        <Td>{entry.rank || index + 1}</Td>
                        <Td>{entry.display_name || entry.displayName}</Td>
                        <Td>{entry.total_points || 0}</Td>
                        <Td>{entry.rounds_completed || 0}</Td>
                        <Td>{entry.accuracy_percentage ? Math.round(entry.accuracy_percentage) : 0}%</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
          ) : (
            <Card bg={cardBg} borderColor={borderColor}>
              <CardBody>
                <Text color="gray.500" textAlign="center">
                  No leaderboard data available.
                </Text>
              </CardBody>
            </Card>
          )}
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}

