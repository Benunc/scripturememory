import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Text,
  VStack,
  Input,
  useToast,
  Card,
  CardBody,
  Alert,
  AlertIcon,
  Spinner,
  useColorModeValue
} from '@chakra-ui/react';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { joinGame } from '../utils/api';
import { debug } from '../utils/debug';

export function GameJoiner() {
  const { gameCode: urlGameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [gameCode, setGameCode] = useState(urlGameCode || '');
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Check for existing participant data in localStorage
  useEffect(() => {
    const storedParticipantId = localStorage.getItem('family_game_participant_id');
    const storedGameCode = localStorage.getItem('family_game_code');
    const storedDisplayName = localStorage.getItem('family_game_display_name');

    if (storedParticipantId && storedGameCode && storedDisplayName) {
      // User has existing game session - redirect to game
      if (storedGameCode === (urlGameCode || gameCode)) {
        navigate(`/family-games/${storedGameCode}/play`);
      }
    }
  }, [urlGameCode, gameCode, navigate]);

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

  const handleJoin = async () => {
    setError(null);

    // Validate game code
    if (!gameCode.trim()) {
      setError('Game code is required');
      return;
    }

    if (gameCode.trim().length !== 6) {
      setError('Game code must be 6 characters');
      return;
    }

    // Validate display name
    const nameValidation = validateDisplayName(displayName);
    if (!nameValidation.valid) {
      setError(nameValidation.error || 'Invalid display name');
      return;
    }

    setIsJoining(true);

    try {
      debug.log('family-game', 'Joining game', { gameCode: gameCode.trim().toUpperCase(), displayName });
      const result = await joinGame(gameCode.trim().toUpperCase(), displayName.trim());

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        // Store participant data in localStorage
        localStorage.setItem('family_game_participant_id', result.data.participantId);
        localStorage.setItem('family_game_code', gameCode.trim().toUpperCase());
        localStorage.setItem('family_game_display_name', result.data.displayName);

        toast({
          title: 'Joined Game!',
          description: result.data.isRejoin ? 'Welcome back!' : 'You have joined the game',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Navigate to game
        navigate(`/family-games/${gameCode.trim().toUpperCase()}/play`);
      }
    } catch (error) {
      debug.error('family-game', 'Error joining game', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to join game';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.sm" py={8} flex="1">
        <VStack spacing={6} align="stretch">
          <Heading size="lg">Join Family Game</Heading>
          <Text color="gray.500">
            Enter the game code and your display name to join a collaborative memorization game.
          </Text>

          <Card bg={cardBg} borderColor={borderColor}>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Game Code</FormLabel>
                  <Input
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    maxLength={6}
                    isDisabled={!!urlGameCode}
                    size="lg"
                    textTransform="uppercase"
                    fontFamily="mono"
                    letterSpacing="wide"
                  />
                  {urlGameCode && (
                    <Text fontSize="sm" color="gray.500" mt={1}>
                      Game code from URL
                    </Text>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel>Your Display Name</FormLabel>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={50}
                    size="lg"
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    This name will be visible to other players. Letters, numbers, and spaces only (max 50 characters).
                  </Text>
                </FormControl>

                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={handleJoin}
                  isLoading={isJoining}
                  isDisabled={!gameCode.trim() || !displayName.trim()}
                  width="100%"
                >
                  Join Game
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


