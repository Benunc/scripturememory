import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Button,
  HStack,
  Flex,
  Avatar,
  Link,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  useBreakpointValue,
  VStack,
  useColorMode,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePoints } from '../contexts/PointsContext';
import { debug } from '../utils/debug';
import { Footer } from '../components/Footer';
import { PointsTutorial } from '../components/PointsTutorial';
import { Link as RouterLink } from 'react-router-dom';
import { HamburgerIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import { getApiUrl } from '../utils/api';
import { AppHeader } from '../components/AppHeader';

interface PointsStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  longest_word_guess_streak: number;
  verses_mastered: number;
  total_attempts: number;
  perfect_attempts: number;
  other_attempts: number;
  last_activity_date: number;
  points_breakdown?: {
    verse_mastery: number;
    word_guesses: number;
    guess_streaks: number;
    verse_additions: number;
    daily_streaks: number;
  };
  point_history?: Array<{
    date: string;
    points: number;
    running_total: number;
  }>;
}

export const PointsStats: React.FC = () => {
  const [stats, setStats] = useState<PointsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, userEmail, signOut } = useAuth();
  const { refreshPoints } = usePoints();
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false }) || false;
  const { colorMode, toggleColorMode } = useColorMode();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  const svgRef = useRef<SVGSVGElement>(null);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sessionToken = localStorage.getItem('session_token');
        if (!sessionToken) {
          throw new Error('No session token found');
        }

        debug.log('api', 'Fetching points stats...');
        const response = await fetch(`${getApiUrl()}/gamification/stats`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          debug.error('api', 'Failed to fetch points stats:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          throw new Error(`Failed to fetch points stats: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        debug.log('api', 'Received points stats:', data);
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from server');
        }

        setStats(data);
      } catch (error) {
        debug.error('api', 'Error fetching points stats:', error);
        setError(error instanceof Error ? error.message : 'Failed to load points statistics. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    void fetchStats();
  }, [isAuthenticated]);

  useEffect(() => {
    function updateAspectRatio() {
      if (svgRef.current) {
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        if (height > 0) setAspectRatio(width / height);
      }
    }
    updateAspectRatio();
    window.addEventListener('resize', updateAspectRatio);
    return () => window.removeEventListener('resize', updateAspectRatio);
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  if (!isAuthenticated) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="warning">
          <AlertIcon />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please log in to view your points statistics.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxW="container.xl" py={8} centerContent>
        <Spinner size="xl" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (!stats) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="info">
          <AlertIcon />
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>
            You haven't earned any points yet. Start memorizing verses to earn points!
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  // Find first non-zero data point
  const firstNonZeroIndex = stats.point_history?.findIndex(p => p.running_total > 0) ?? 0;
  const chartPoints = stats.point_history?.slice(firstNonZeroIndex) ?? [];
  const N = chartPoints.length;
  const getX = (i: number) => (N === 1 ? 8 : 8 + (i / (N - 1)) * 100);

  return (
    <Box minH="100vh" bg={bgColor}>
      <AppHeader />
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading size="lg">Your Progress</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            {/* Total Points and Points Breakdown */}
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
              gridColumn={{ base: "1", md: "span 2", lg: "span 1" }}
            >
              <Heading size="md" pb={7} mb={0}>Points</Heading>
              <Box display="flex" flexDirection="column" justifyContent="center" flex={1}>
                <StatLabel>Total Points</StatLabel>
                <StatNumber>{stats.total_points}</StatNumber>
                <StatHelpText>Keep going!</StatHelpText>
                {stats.points_breakdown && (
                  <Box mt={4}>
                    <StatLabel mb={2}>Points Breakdown (approximate)</StatLabel>
                    <VStack spacing={0} align="stretch">
                      <Flex bg={useColorModeValue('gray.50', 'gray.700')} p={2} justify="space-between" gap={7}>
                        <Text>Verse Mastery</Text>
                        <Text fontWeight="bold">{stats.points_breakdown.verse_mastery}</Text>
                      </Flex>
                      <Flex bg={useColorModeValue('gray.100', 'gray.600')} p={2} justify="space-between" gap={4}>
                        <Text>Word Guesses</Text>
                        <Text fontWeight="bold">{stats.points_breakdown.word_guesses}</Text>
                      </Flex>
                      <Flex bg={useColorModeValue('gray.50', 'gray.700')} p={2} justify="space-between" gap={4}>
                        <Text>Guess Streaks</Text>
                        <Text fontWeight="bold">{Math.round(stats.points_breakdown.guess_streaks)}</Text>
                      </Flex>
                      <Flex bg={useColorModeValue('gray.100', 'gray.600')} p={2} justify="space-between" gap={4}>
                        <Text>Verse Additions</Text>
                        <Text fontWeight="bold">{stats.points_breakdown.verse_additions}</Text>
                      </Flex>
                      <Flex bg={useColorModeValue('gray.50', 'gray.700')} p={2} justify="space-between" gap={4}>
                        <Text>Daily Streaks</Text>
                        <Text fontWeight="bold">{stats.points_breakdown.daily_streaks}</Text>
                      </Flex>
                    </VStack>
                  </Box>
                )}
              </Box>
            </Stat>

            {/* Current Streak and Longest Streak */}
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <Heading size="md" pb={10} mb={0}>Streaks</Heading>
              <Box display="flex" flexDirection="column" justifyContent="center" flex={1}>
                <StatLabel>Current Login Streak</StatLabel>
                <StatNumber>{stats.current_streak} {stats.current_streak === 1 ? 'day' : 'days'}</StatNumber>
                <StatHelpText>Don't break the chain!</StatHelpText>
                <Box mt={4}>
                  <StatLabel>Longest Login Streak</StatLabel>
                  <StatNumber fontSize="lg">{stats.longest_streak} {stats.longest_streak === 1 ? 'day' : 'days'}</StatNumber>
                  <StatHelpText>Your best streak</StatHelpText>
                </Box>
                <Box mt={4}>
                  <StatLabel>Best Word Guess Streak</StatLabel>
                  <StatNumber fontSize="lg">{stats.longest_word_guess_streak} {stats.longest_word_guess_streak === 1 ? 'word' : 'words'}</StatNumber>
                  <StatHelpText>Your best word guessing streak</StatHelpText>
                </Box>
              </Box>
            </Stat>

            {/* Verses Mastered and Total Attempts */}
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <Heading size="md" pb={10} mb={0}>Mastery</Heading>
              <Box display="flex" flexDirection="column" justifyContent="center" flex={1}>
                <StatLabel>Verses Mastered</StatLabel>
                <StatNumber>{stats.verses_mastered}</StatNumber>
                <StatHelpText>
                  {stats.verses_mastered > 0 
                    ? "Great job!" 
                    : <Link as={RouterLink} to="#mastery" color="blue.500">Learn how to master verses</Link>}
                </StatHelpText>
                <Box mt={4}>
                  <StatLabel>Total Attempts</StatLabel>
                  <StatNumber fontSize="lg">{stats.total_attempts}</StatNumber>
                  <StatHelpText>
                    <VStack spacing={1} align="stretch">
                      <Text fontSize="sm">Perfect: {stats.perfect_attempts}</Text>
                      <Text fontSize="sm">Other: {stats.other_attempts}</Text>
                    </VStack>
                  </StatHelpText>
                </Box>
              </Box>
            </Stat>
          </SimpleGrid>
          <PointsTutorial />
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 