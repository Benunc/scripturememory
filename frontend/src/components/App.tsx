import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, HStack, Heading, Text, Avatar, useToast, VStack, Flex, Divider, Link, Menu, MenuButton, MenuList, MenuItem, IconButton, useBreakpointValue, keyframes, useColorMode } from '@chakra-ui/react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { AddVerse } from './AddVerse';
import { VerseList } from './VerseList';
import { useAuthContext } from '../contexts/AuthContext';
import { useVerses } from '../hooks/useVerses';
import { Footer } from './Footer';
import { validateEnvVariables } from '../utils/auth';
import { ProgressStatus } from '../utils/progress';
import { SignIn } from './SignIn';
import { PointsDisplay } from './PointsDisplay';
import logo from '/assets/images/ScriptureMemory.svg';
import { Verse } from '../types/Verse';
import { debug } from '../utils/debug';
import { HamburgerIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import { AppHeader } from './AppHeader';

const SAMPLE_VERSES: Verse[] = [
  {
    reference: "John 3:16",
    text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    status: "memorized" as ProgressStatus,
    lastReviewed: new Date().toISOString()
  },
  {
    reference: "Philippians 4:13",
    text: "I can do all things through Christ who strengthens me.",
    status: "learning" as ProgressStatus,
    lastReviewed: new Date().toISOString()
  },
  {
    reference: "Jeremiah 29:11",
    text: "\"For I know the plans I have for you,\" declares the LORD, \"plans to prosper you and not to harm you, plans to give you hope and a future.\"",
    status: "reviewing" as ProgressStatus,
    lastReviewed: new Date().toISOString()
  }
];

const pulseAnimation = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
`;

export function MainApp() {
  const { isAuthenticated, userEmail, signOut } = useAuthContext();
  const { verses, loading, error, updateVerse, deleteVerse, addVerse } = useVerses();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const verseListRef = useRef<{ scrollToVerse: (reference: string) => void }>(null);
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { colorMode, toggleColorMode } = useColorMode();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Validate environment variables first
        validateEnvVariables();

        // Check for message parameter
        const params = new URLSearchParams(window.location.search);
        const message = params.get('message');
        if (message) {
          setIsSignInOpen(true);
          // Clear the message from URL
          window.history.replaceState({}, '', '/');
        }
      } catch (error) {
        debug.error('state', 'Initialization error:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : 'Failed to initialize app',
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [toast]);

  const handleVerseAdded = (reference: string) => {
    // Scroll to the newly added verse
    verseListRef.current?.scrollToVerse(reference);
  };

  const handleStatusChange = async (reference: string, newStatus: ProgressStatus) => {
    try {
      await updateVerse(reference, { status: newStatus });
    } catch (error) {
      debug.error('verses', 'Error updating verse status:', error);
      throw error; // Let VerseList handle the error display
    }
  };

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <Link
          href="#main-content"
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
          Skip to main content
        </Link>

        <Box position="absolute" top={4} right={4}>
          <IconButton
            aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
          />
        </Box>

        <Box p={8}>
          <VStack spacing={8} align="center">
            <img src={logo} alt="Scripture Memory" style={{ maxWidth: '300px', width: '100%' }} />
            <Heading size="xl" textAlign="center">Welcome to Scripture Memory</Heading>
            <Text fontSize="lg" textAlign="center" color="gray.600">
              Start your journey of memorizing God's Word
            </Text>
            <VStack spacing={4} w="100%" maxW="300px">
              <Button
                colorScheme="blue"
                size="lg"
                w="100%"
                onClick={() => navigate('/register')}
              >
                Create Account
              </Button>
              <Button
                size="lg"
                variant="outline"
                colorScheme="blue"
                bg="transparent"
                w="100%"
                _hover={{
                  bg: 'whiteAlpha.200',
                  borderColor: 'blue.400',
                  transform: 'translateY(-1px)',
                  boxShadow: 'sm'
                }}
                _active={{
                  bg: 'whiteAlpha.300',
                  transform: 'translateY(0)'
                }}
                transition="all 0.2s"
                onClick={() => setIsSignInOpen(true)}
              >
                Sign In
              </Button>
              <Button
                size="lg"
                colorScheme="green"
                bg="green.100"
                color="green.700"
                w="100%"
                animation={`${pulseAnimation} 2s ease-in-out infinite`}
                _hover={{
                  bg: 'green.200',
                  transform: 'translateY(-1px)',
                  boxShadow: 'sm'
                }}
                _active={{
                  bg: 'green.300',
                  transform: 'translateY(0)'
                }}
                onClick={() => navigate('/donate')}
              >
                Support Us
              </Button>
            </VStack>
          </VStack>
        </Box>

        <Divider my={8} />

        <Box flex="1" p={8}>
          <VStack spacing={8} align="stretch">
            <Heading size="md" textAlign="center">Sample Verses</Heading>
            <VerseList
              ref={verseListRef}
              verses={SAMPLE_VERSES}
              loading={false}
              error={null}
              onStatusChange={async () => {}}
              onDelete={async () => {}}
              showStatusButtons={false}
            />
          </VStack>
        </Box>

        <Footer />
        <SignIn isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Link
        href="#main-content"
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
        Skip to main content
      </Link>

      <AppHeader />

      <Box id="main-content" flex="1" p={8} tabIndex={-1}>
        <VStack spacing={8} align="stretch">
          <VerseList
            ref={verseListRef}
            verses={verses}
            loading={loading}
            error={error}
            onStatusChange={handleStatusChange}
            onDelete={deleteVerse}
          />
          <AddVerse onVerseAdded={handleVerseAdded} addVerse={addVerse} />
        </VStack>
      </Box>

      <Footer />
      {isAuthenticated && <PointsDisplay />}
    </Box>
  );
} 