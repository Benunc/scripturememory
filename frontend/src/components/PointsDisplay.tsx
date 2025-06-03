import React, { useState, useEffect } from 'react';
import {
  Box,
  Text,
  useColorModeValue,
  Flex,
  Tooltip,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePoints } from '../contexts/PointsContext';

interface PointsDisplayProps {
  initialPoints?: number;
}

export const PointsDisplay: React.FC<PointsDisplayProps> = ({ initialPoints = 0 }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevPoints, setPrevPoints] = useState(initialPoints);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { points } = usePoints();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const pointsColor = useColorModeValue('green.500', 'green.300');

  // Handle points update animation
  useEffect(() => {
    if (points > prevPoints) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    setPrevPoints(points);
  }, [points, prevPoints]);

  // Navigate to points stats page
  const handleClick = () => {
    navigate('/points');
  };

  if (!isAuthenticated) return null;

  return (
    <Tooltip label="View points breakdown" placement="bottom">
      <Box
        position="fixed"
        top="20px"
        right="20px"
        zIndex="1000"
        onClick={handleClick}
        cursor="pointer"
        role="button"
        aria-label="View points breakdown"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <Flex
          align="center"
          bg={bgColor}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="full"
          px={4}
          py={2}
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
        >
          <Text
            color={textColor}
            fontWeight="bold"
            mr={2}
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
        </Flex>
      </Box>
    </Tooltip>
  );
}; 