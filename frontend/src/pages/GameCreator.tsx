import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  CardHeader,
  useToast,
  Input,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Select,
  Textarea,
  Badge,
  IconButton,
  Divider,
  Alert,
  AlertIcon,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  SimpleGrid,
  Flex,
  Checkbox,
  useColorModeValue
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { createGame, CreateGameRequest } from '../utils/api';
import { useVerses } from '../hooks/useVerses';
import { debug } from '../utils/debug';

interface Round {
  roundNumber: number;
  verseReference: string;
  verseText: string;
  wordIndicesToHide: Array<{ index: number; type: string }>;
}

// Word types for distractor generation
const WORD_TYPES = ['noun', 'verb', 'adjective', 'adverb', 'other'];

// Helper function to split verse text into words (matching VerseList.tsx)
const splitVerseText = (text: string): string[] => {
  let processedText = text.replace(/—/g, '— ');
  processedText = processedText.replace(/-/g, ' ');
  return processedText.split(/\s+/).filter(word => word.length > 0);
};

export function GameCreator() {
  const { token, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const toast = useToast();
  const { verses, loading: versesLoading } = useVerses();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [creatorDisplayName, setCreatorDisplayName] = useState('');
  const [autoApproveParticipants, setAutoApproveParticipants] = useState(true);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(300); // 5 minutes default
  const [isCreating, setIsCreating] = useState(false);
  const [selectedVerseForRound, setSelectedVerseForRound] = useState<number | null>(null);
  const [manualVerseReference, setManualVerseReference] = useState('');
  const [manualVerseText, setManualVerseText] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingRoundIndex, setEditingRoundIndex] = useState<number | null>(null);
  const [tempWordSelection, setTempWordSelection] = useState<Array<{ index: number; type: string }>>([]);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const roundCardBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to create a game.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  }, [isAuthenticated, navigate, toast]);

  const handleAddRound = () => {
    setSelectedVerseForRound(null);
    setManualVerseReference('');
    setManualVerseText('');
    setEditingRoundIndex(null);
    setTempWordSelection([]);
    onOpen();
  };

  const handleEditRound = (index: number) => {
    const round = rounds[index];
    if (round) {
      // Check if verse exists in user's verses
      const existingVerse = verses.find(v => v.reference === round.verseReference);
      if (existingVerse) {
        setSelectedVerseForRound(existingVerse.reference);
        setManualVerseReference('');
        setManualVerseText('');
      } else {
        setSelectedVerseForRound(null);
        setManualVerseReference(round.verseReference);
        setManualVerseText(round.verseText);
      }
      setEditingRoundIndex(index);
      setTempWordSelection(round.wordIndicesToHide);
      onOpen();
    }
  };

  const handleSelectWords = (index: number) => {
    const round = rounds[index];
    if (round) {
      // Check if verse exists in user's verses
      const existingVerse = verses.find(v => v.reference === round.verseReference);
      if (existingVerse) {
        setSelectedVerseForRound(existingVerse.reference);
        setManualVerseReference('');
        setManualVerseText('');
      } else {
        setSelectedVerseForRound(null);
        setManualVerseReference(round.verseReference);
        setManualVerseText(round.verseText);
      }
      setEditingRoundIndex(index);
      setTempWordSelection(round.wordIndicesToHide);
      onOpen();
    }
  };

  const handleSaveRound = () => {
    let verseReference = '';
    let verseText = '';

    if (selectedVerseForRound) {
      const verse = verses.find(v => v.reference === selectedVerseForRound);
      if (verse) {
        verseReference = verse.reference;
        verseText = verse.text;
      }
    } else {
      verseReference = manualVerseReference.trim();
      verseText = manualVerseText.trim();
    }

    if (!verseReference || !verseText) {
      toast({
        title: 'Error',
        description: 'Please select a verse or enter verse details.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const words = splitVerseText(verseText);
    if (words.length === 0) {
      toast({
        title: 'Error',
        description: 'Verse text is empty or invalid.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // If editing, update existing round
    if (editingRoundIndex !== null) {
      const updatedRounds = [...rounds];
      updatedRounds[editingRoundIndex] = {
        roundNumber: editingRoundIndex + 1,
        verseReference,
        verseText,
        wordIndicesToHide: tempWordSelection // Use temp selection
      };
      setRounds(updatedRounds);
    } else {
      // Add new round with word selections
      const newRound: Round = {
        roundNumber: rounds.length + 1,
        verseReference,
        verseText,
        wordIndicesToHide: tempWordSelection // Use temp selection
      };
      setRounds([...rounds, newRound]);
    }

    onClose();
    setSelectedVerseForRound(null);
    setManualVerseReference('');
    setManualVerseText('');
    setEditingRoundIndex(null);
    setTempWordSelection([]);
  };

  const handleDeleteRound = (index: number) => {
    const updatedRounds = rounds.filter((_, i) => i !== index).map((round, i) => ({
      ...round,
      roundNumber: i + 1
    }));
    setRounds(updatedRounds);
  };

  const validateDisplayName = (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: 'Display name is required' };
    }
    if (trimmed.length > 50) {
      return { valid: false, error: 'Display name must be 50 characters or less' };
    }
    if (!/^[a-zA-Z0-9\s]+$/.test(trimmed)) {
      return { valid: false, error: 'Display name can only contain letters, numbers, and spaces' };
    }
    return { valid: true };
  };

  const handleCreateGame = async () => {
    // Validate display name
    const nameValidation = validateDisplayName(creatorDisplayName);
    if (!nameValidation.valid) {
      toast({
        title: 'Error',
        description: nameValidation.error || 'Invalid display name',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (rounds.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one round to the game.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Validate that all rounds have at least one word selected to hide
    for (const round of rounds) {
      if (round.wordIndicesToHide.length === 0) {
        toast({
          title: 'Error',
          description: `Round ${round.roundNumber} (${round.verseReference}) must have at least one word selected to hide.`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    if (!token) {
      toast({
        title: 'Error',
        description: 'Authentication token not found.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsCreating(true);

    try {
      const gameData: CreateGameRequest = {
        creatorDisplayName: creatorDisplayName.trim(),
        rounds: rounds.map(round => ({
          roundNumber: round.roundNumber,
          verseReference: round.verseReference,
          verseText: round.verseText,
          wordIndicesToHide: round.wordIndicesToHide
        })),
        autoApproveParticipants,
        timeLimitSeconds
      };

      debug.log('family-game', 'Creating game', gameData);
      const result = await createGame(token, gameData);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data?.game) {
        // Store creator participant data in localStorage
        if (result.data.game.creatorParticipantId) {
          localStorage.setItem('family_game_participant_id', result.data.game.creatorParticipantId);
          localStorage.setItem('family_game_code', result.data.game.gameCode);
          localStorage.setItem('family_game_display_name', result.data.game.creatorDisplayName || creatorDisplayName.trim());
        }

        toast({
          title: 'Game Created!',
          description: `Game code: ${result.data.game.gameCode}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });

        // Navigate to waiting room (not join page)
        navigate(`/family-games/${result.data.game.gameCode}/play`);
      }
    } catch (error) {
      debug.error('family-game', 'Error creating game', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create game',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.lg" py={8} flex="1">
        <VStack spacing={6} align="stretch">
          <Heading size="lg">Create Family Game</Heading>
          <Text color="gray.500">
            Create a collaborative memorization game. Add verses as rounds, select which words to hide, and invite family members to join!
          </Text>

          {/* Game Settings */}
          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <Heading size="md">Game Settings</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Your Display Name</FormLabel>
                  <Input
                    value={creatorDisplayName}
                    onChange={(e) => setCreatorDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={50}
                    size="lg"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    This name will be visible to other players. Letters, numbers, and spaces only (max 50 characters).
                  </Text>
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="auto-approve" mb="0">
                    Auto-approve participants
                  </FormLabel>
                  <Switch
                    id="auto-approve"
                    isChecked={autoApproveParticipants}
                    onChange={(e) => setAutoApproveParticipants(e.target.checked)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Time limit per round (seconds)</FormLabel>
                  <NumberInput
                    value={timeLimitSeconds}
                    onChange={(_, value) => setTimeLimitSeconds(isNaN(value) ? 300 : value)}
                    min={60}
                    max={1800}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Each participant has this much time to complete each round
                  </Text>
                </FormControl>
              </VStack>
            </CardBody>
          </Card>

          {/* Rounds */}
          <Card bg={cardBg} borderColor={borderColor}>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">Rounds ({rounds.length})</Heading>
                <Button leftIcon={<AddIcon />} onClick={handleAddRound} size="sm">
                  Add Round
                </Button>
              </HStack>
            </CardHeader>
            <CardBody>
              {rounds.length === 0 ? (
                <Text color="gray.500" textAlign="center" py={8}>
                  No rounds added yet. Click "Add Round" to get started.
                </Text>
              ) : (
                <VStack spacing={4} align="stretch">
                  {rounds.map((round, index) => (
                    <Card key={index} bg={roundCardBg} size="sm">
                      <CardBody>
                        <VStack align="stretch" spacing={3}>
                          <HStack justify="space-between">
                            <HStack>
                              <Badge>Round {round.roundNumber}</Badge>
                              <Text fontWeight="bold">{round.verseReference}</Text>
                            </HStack>
                            <HStack>
                              <IconButton
                                aria-label="Edit round"
                                icon={<CheckIcon />}
                                size="sm"
                                onClick={() => handleEditRound(index)}
                              />
                              <IconButton
                                aria-label="Delete round"
                                icon={<DeleteIcon />}
                                size="sm"
                                colorScheme="red"
                                onClick={() => handleDeleteRound(index)}
                              />
                            </HStack>
                          </HStack>
                          <Text fontSize="sm" noOfLines={2}>
                            {round.verseText}
                          </Text>
                          <Text fontSize="sm" color="gray.500">
                            {round.wordIndicesToHide.length} word{round.wordIndicesToHide.length !== 1 ? 's' : ''} to hide
                          </Text>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSelectWords(index)}
                          >
                            Select Words to Hide
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  ))}
                </VStack>
              )}
            </CardBody>
          </Card>

          {/* Create Game Button */}
          <Button
            colorScheme="blue"
            size="lg"
            onClick={handleCreateGame}
            isLoading={isCreating}
            isDisabled={rounds.length === 0 || !creatorDisplayName.trim()}
          >
            Create Game
          </Button>
        </VStack>
      </Container>

      {/* Add/Edit Round Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingRoundIndex !== null ? 'Edit Round' : 'Add Round'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>Select Verse</FormLabel>
                <Select
                  placeholder="Choose from your verses or enter manually"
                  value={selectedVerseForRound || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value) {
                      setSelectedVerseForRound(value);
                      setManualVerseReference('');
                      setManualVerseText('');
                    } else {
                      setSelectedVerseForRound(null);
                    }
                  }}
                >
                  {verses.map((verse) => (
                    <option key={verse.reference} value={verse.reference}>
                      {verse.reference}
                    </option>
                  ))}
                </Select>
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Or enter verse details manually below
                </Text>
              </FormControl>

              {!selectedVerseForRound && (
                <>
                  <FormControl>
                    <FormLabel>Verse Reference</FormLabel>
                    <Input
                      value={manualVerseReference}
                      onChange={(e) => setManualVerseReference(e.target.value)}
                      placeholder="e.g., John 3:16"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Verse Text</FormLabel>
                    <Textarea
                      value={manualVerseText}
                      onChange={(e) => setManualVerseText(e.target.value)}
                      placeholder="Enter the full verse text..."
                      rows={4}
                    />
                  </FormControl>
                </>
              )}

              {selectedVerseForRound && (
                <Box>
                  <Text fontWeight="bold" mb={2}>
                    {verses.find(v => v.reference === selectedVerseForRound)?.reference}
                  </Text>
                  <Text>
                    {verses.find(v => v.reference === selectedVerseForRound)?.text}
                  </Text>
                </Box>
              )}

              {/* Word Selection Interface */}
              {((selectedVerseForRound && verses.find(v => v.reference === selectedVerseForRound)) || 
                (manualVerseText.trim() && !selectedVerseForRound) ||
                (editingRoundIndex !== null && rounds[editingRoundIndex])) && (
                <Box>
                  <Divider my={4} />
                  <Heading size="sm" mb={4}>Select Words to Hide</Heading>
                  <WordSelector
                    verseText={
                      selectedVerseForRound
                        ? verses.find(v => v.reference === selectedVerseForRound)?.text || ''
                        : editingRoundIndex !== null
                        ? rounds[editingRoundIndex].verseText
                        : manualVerseText
                    }
                    selectedWords={tempWordSelection}
                    onSelectionChange={(wordIndices) => {
                      setTempWordSelection(wordIndices);
                    }}
                  />
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveRound}>
              {editingRoundIndex !== null ? 'Update Round' : 'Add Round'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Footer />
    </Box>
  );
}

// Word Selector Component
interface WordSelectorProps {
  verseText: string;
  selectedWords: Array<{ index: number; type: string }>;
  onSelectionChange: (wordIndices: Array<{ index: number; type: string }>) => void;
}

function WordSelector({ verseText, selectedWords, onSelectionChange }: WordSelectorProps) {
  const words = splitVerseText(verseText);
  const [localSelection, setLocalSelection] = useState<Array<{ index: number; type: string }>>(selectedWords);

  useEffect(() => {
    setLocalSelection(selectedWords);
  }, [selectedWords]);

  const handleWordToggle = (index: number) => {
    const existing = localSelection.find(s => s.index === index);
    if (existing) {
      // Remove
      const updated = localSelection.filter(s => s.index !== index);
      setLocalSelection(updated);
      onSelectionChange(updated);
    } else {
      // Add with default type 'other'
      const updated = [...localSelection, { index, type: 'other' }];
      setLocalSelection(updated);
      onSelectionChange(updated);
    }
  };

  const handleTypeChange = (index: number, type: string) => {
    const updated = localSelection.map(s =>
      s.index === index ? { ...s, type } : s
    );
    setLocalSelection(updated);
    onSelectionChange(updated);
  };

  const isSelected = (index: number) => {
    return localSelection.some(s => s.index === index);
  };

  const getWordType = (index: number) => {
    return localSelection.find(s => s.index === index)?.type || 'other';
  };

  return (
    <VStack spacing={4} align="stretch">
      <Text fontSize="sm" color="gray.500">
        Click words to hide them. Select word type for each hidden word to generate better distractors.
      </Text>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={2}>
        {words.map((word, index) => {
          const selected = isSelected(index);
          return (
            <Box key={index}>
              <Button
                size="sm"
                variant={selected ? 'solid' : 'outline'}
                colorScheme={selected ? 'blue' : 'gray'}
                onClick={() => handleWordToggle(index)}
                width="100%"
                justifyContent="flex-start"
              >
                {word}
              </Button>
              {selected && (
                <Select
                  size="xs"
                  mt={1}
                  value={getWordType(index)}
                  onChange={(e) => handleTypeChange(index, e.target.value)}
                >
                  {WORD_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Box>
          );
        })}
      </SimpleGrid>
      <Text fontSize="sm" color="gray.500">
        {localSelection.length} word{localSelection.length !== 1 ? 's' : ''} selected to hide
      </Text>
    </VStack>
  );
}

