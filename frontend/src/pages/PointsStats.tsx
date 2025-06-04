import React, { useState, useEffect } from 'react';
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
import logo from '/assets/images/ScriptureMemory.svg';
import { HamburgerIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import { getApiUrl } from '../utils/api';
import { AppHeader } from '../components/AppHeader';

interface PointsStats {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  verses_mastered: number;
  total_attempts: number;
  last_activity_date: number;
}

export const PointsStats: React.FC = () => {
  const [stats, setStats] = useState<PointsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, userEmail, signOut } = useAuth();
  const { refreshPoints } = usePoints();
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { colorMode, toggleColorMode } = useColorMode();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

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

  return (
    <Box minH="100vh" bg={bgColor}>
      <AppHeader />
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading size="lg">Your Progress</Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Total Points</StatLabel>
              <StatNumber>{stats.total_points}</StatNumber>
              <StatHelpText>Keep going!</StatHelpText>
            </Stat>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Current Streak</StatLabel>
              <StatNumber>{stats.current_streak} days</StatNumber>
              <StatHelpText>Don't break the chain!</StatHelpText>
            </Stat>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Longest Streak</StatLabel>
              <StatNumber>{stats.longest_streak} days</StatNumber>
              <StatHelpText>Your best streak</StatHelpText>
            </Stat>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Verses Mastered</StatLabel>
              <StatNumber>{stats.verses_mastered}</StatNumber>
              <StatHelpText>Great job!</StatHelpText>
            </Stat>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Total Attempts</StatLabel>
              <StatNumber>{stats.total_attempts}</StatNumber>
              <StatHelpText>Keep practicing!</StatHelpText>
            </Stat>
            <Stat
              px={4}
              py={5}
              bg={cardBg}
              rounded="lg"
              border="1px"
              borderColor={borderColor}
            >
              <StatLabel>Last Activity</StatLabel>
              <StatNumber>
                {new Date(stats.last_activity_date).toLocaleDateString()}
              </StatNumber>
              <StatHelpText>Keep it up!</StatHelpText>
            </Stat>
          </SimpleGrid>
          <PointsTutorial />
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 