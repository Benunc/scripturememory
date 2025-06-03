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
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePoints } from '../contexts/PointsContext';
import { debug } from '../utils/debug';

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
  const { isAuthenticated } = useAuth();
  const { refreshPoints } = usePoints();
  const navigate = useNavigate();

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

        const response = await fetch('/api/gamification/stats', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch points stats');
        }

        const data = await response.json();
        debug.log('api', 'Received points stats:', data);
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format');
        }

        setStats(data);
      } catch (error) {
        debug.error('api', 'Error fetching points stats:', error);
        setError('Failed to load points statistics. Please try refreshing the page.');
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
    <Container maxW="container.xl" py={8}>
      <HStack justify="space-between" mb={8}>
        <Box>
          <Heading as="h1" size="xl" mb={2}>Points Statistics</Heading>
          <Text color="gray.500">Track your progress and achievements</Text>
        </Box>
        <Button onClick={handleBack}>Back to App</Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Total Points</StatLabel>
          <StatNumber>{stats.total_points?.toLocaleString() ?? 0}</StatNumber>
          <StatHelpText>All time points earned</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Current Streak</StatLabel>
          <StatNumber>{stats.current_streak ?? 0}</StatNumber>
          <StatHelpText>Days in a row</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Best Streak</StatLabel>
          <StatNumber>{stats.longest_streak ?? 0}</StatNumber>
          <StatHelpText>Longest streak achieved</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Verses Mastered</StatLabel>
          <StatNumber>{stats.verses_mastered ?? 0}</StatNumber>
          <StatHelpText>Total verses mastered</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Total Attempts</StatLabel>
          <StatNumber>{stats.total_attempts ?? 0}</StatNumber>
          <StatHelpText>All time recitations</StatHelpText>
        </Stat>

        <Stat
          bg={cardBg}
          p={6}
          borderRadius="lg"
          borderWidth="1px"
          borderColor={borderColor}
        >
          <StatLabel>Last Activity</StatLabel>
          <StatNumber>
            {stats.last_activity_date ? new Date(stats.last_activity_date).toLocaleDateString() : 'Never'}
          </StatNumber>
          <StatHelpText>Last recorded activity</StatHelpText>
        </Stat>
      </SimpleGrid>
    </Container>
  );
}; 