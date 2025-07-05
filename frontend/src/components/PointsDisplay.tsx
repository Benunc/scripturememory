import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  useColorModeValue,
  Flex,
  Tooltip,
  VStack,
  HStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { usePoints } from '../contexts/PointsContext';

interface PointsDisplayProps {
  initialPoints?: number;
}

export const PointsDisplay: React.FC<PointsDisplayProps> = ({ initialPoints = 0 }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevPoints, setPrevPoints] = useState(initialPoints);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const { points, longestWordGuessStreak, refreshPoints } = usePoints();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const pointsColor = useColorModeValue('green.500', 'green.300');
  const streakColor = useColorModeValue('blue.500', 'blue.300');

  // Handle points update animation
  useEffect(() => {
    if (points > prevPoints) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    setPrevPoints(points);
  }, [points, prevPoints]);

  // Navigate to points stats page
  const handleClick = async () => {
    await refreshPoints();
    navigate('/points');
  };

  // Refresh points when component mounts or when returning to main app
  useEffect(() => {
    void refreshPoints();
  }, []);

  if (!isAuthenticated) return null;

  return (
    <Tooltip label="Learn more about points and streaks" placement="bottom">
      <Box
        position="fixed"
        top="58px"
        right="85px"
        zIndex="1000"
        onClick={handleClick}
        cursor="pointer"
        role="button"
        aria-label="Learn more about points and streaks"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <VStack
          align="stretch"
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="lg"
          px={4}
          py={3}
          boxShadow="md"
          transition="all 0.2s"
          _hover={{
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
          }}
          _focus={{
            outline: 'none',
            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
          }}
          _focusVisible={{
            outline: 'none',
            boxShadow: '0 0 0 3px var(--chakra-colors-blue-300)',
          }}
          spacing={2}
        >
          <HStack justify="space-between">
            <Text
              color={textColor}
              fontWeight="bold"
              fontSize="sm"
            >
              Points:
            </Text>
            <Text
              color={pointsColor}
              fontWeight="bold"
              fontSize="lg"
              animation={isAnimating ? 'pulse 1s ease-in-out' : 'none'}
              sx={{
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' }
                }
              }}
            >
              {points.toLocaleString()}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text
              color={textColor}
              fontWeight="bold"
              fontSize="sm"
            >
              Best Word Streak:
            </Text>
            <Text
              color={streakColor}
              fontWeight="bold"
              fontSize="lg"
            >
              {longestWordGuessStreak}
            </Text>
          </HStack>
        </VStack>
      </Box>
    </Tooltip>
  );
}; 