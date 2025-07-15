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
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevCurrentStreak, setPrevCurrentStreak] = useState(0);
  const [prevBestStreak, setPrevBestStreak] = useState(0);
  const [isBouncing, setIsBouncing] = useState(false);
  const [isNewBestStreak, setIsNewBestStreak] = useState(false);
  const [hasCelebratedThisStreak, setHasCelebratedThisStreak] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthContext();
  const { points, longestWordGuessStreak, currentStreak, refreshPoints } = usePoints();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const pointsColor = useColorModeValue('green.500', 'green.300');
  const streakColor = useColorModeValue('blue.500', 'blue.300');
  const grayColor = useColorModeValue('gray.500', 'gray.400');
  const yellowColor = useColorModeValue('yellow.500', 'yellow.300');
  const orangeColor = useColorModeValue('orange.500', 'orange.300');
  const redColor = useColorModeValue('red.500', 'red.300');
  const greenColor = useColorModeValue('green.500', 'green.300');

  // Dynamic color calculation for current streak
  const getCurrentStreakColor = () => {
    if (longestWordGuessStreak === 0) return grayColor;
    
    const ratio = currentStreak / longestWordGuessStreak;
    
    if (currentStreak >= longestWordGuessStreak) {
      return greenColor; // At or past best streak - show green!
    } else if (ratio >= 0.8) {
      return redColor; // Very close
    } else if (ratio >= 0.6) {
      return orangeColor; // Getting close
    } else if (ratio >= 0.4) {
      return yellowColor; // Building up
    } else {
      return grayColor; // Normal
    }
  };

  const currentStreakColor = getCurrentStreakColor();
  
  // Check if current streak is very close to best streak for pulsing effect
  const isVeryClose = longestWordGuessStreak > 0 && currentStreak / longestWordGuessStreak >= 0.8 && currentStreak < longestWordGuessStreak;
  
  // Check if this is a new best streak ever
  const isNewBestStreakEver = currentStreak >= longestWordGuessStreak && currentStreak > 0;
  
  // Check if current streak is close (red color) for jiggling effect
  const isClose = longestWordGuessStreak > 0 && currentStreak / longestWordGuessStreak >= 0.8 && currentStreak < longestWordGuessStreak;

  // Handle points update animation
  useEffect(() => {
    if (points > prevPoints) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    setPrevPoints(points);
  }, [points, prevPoints]);

  // Handle confetti when current streak passes best streak
  useEffect(() => {
    // Reset celebration flag when streak resets to 0
    if (currentStreak === 0) {
      setHasCelebratedThisStreak(false);
    }
    
    // Check if current streak just reached the best streak level for the first time in this attempt
    const justReachedBestStreak = currentStreak >= longestWordGuessStreak && 
                                 prevCurrentStreak < prevBestStreak &&
                                 currentStreak > prevCurrentStreak &&
                                 !hasCelebratedThisStreak;
    
    if (justReachedBestStreak) {
      setShowConfetti(true);
      setIsBouncing(true);
      setIsNewBestStreak(true);
      setHasCelebratedThisStreak(true); // Mark that we've celebrated this streak
      setTimeout(() => setShowConfetti(false), 3000); // Hide confetti after 3 seconds
      setTimeout(() => setIsBouncing(false), 2000); // Stop bouncing after 2 seconds
      setTimeout(() => setIsNewBestStreak(false), 2000); // Stop new best streak state after 2 seconds
    }
    
    setPrevCurrentStreak(currentStreak);
    setPrevBestStreak(longestWordGuessStreak);
  }, [currentStreak, longestWordGuessStreak, prevCurrentStreak, prevBestStreak, hasCelebratedThisStreak]);

  // Generate confetti pieces
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    animationDelay: Math.random() * 2,
    color: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'][Math.floor(Math.random() * 6)]
  }));

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
    <>
      {/* Confetti Overlay */}
      {showConfetti && (
        <Box
          position="fixed"
          top="0"
          left="0"
          width="100vw"
          height="100vh"
          pointerEvents="none"
          zIndex="9999"
        >
          {confettiPieces.map(piece => (
            <Box
              key={piece.id}
              position="absolute"
              top="-10px"
              left={`${piece.left}%`}
              width="8px"
              height="8px"
              bg={piece.color}
              borderRadius="50%"
              sx={{
                animation: 'confetti 3s ease-out forwards',
                animationDelay: `${piece.animationDelay}s`,
                '@keyframes confetti': {
                  '0%': {
                    transform: 'translateY(0) rotate(0deg)',
                    opacity: 1,
                  },
                  '100%': {
                    transform: 'translateY(100vh) rotate(720deg)',
                    opacity: 0,
                  },
                },
              }}
            />
          ))}
        </Box>
      )}

      <Tooltip label="Learn more about points and streaks" placement="bottom">
        <Box
          position="fixed"
          top="58px"
          left="50%"
          transform="translateX(-50%)"
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
          <HStack
            bg={bgColor}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="lg"
            px={6}
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
            spacing={6}
          >
            <HStack spacing={2}>
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
            <HStack spacing={2}>
              <Text
                color={textColor}
                fontWeight="bold"
                fontSize="sm"
              >
                Current:
              </Text>
              <Text
                color={currentStreakColor}
                fontWeight="bold"
                fontSize="lg"
                sx={{
                  ...(isBouncing && {
                    animation: 'bounce 1s ease-in-out',
                    '@keyframes bounce': {
                      '0%, 20%, 53%, 80%, 100%': {
                        transform: 'translate3d(0,0,0)',
                      },
                      '40%, 43%': {
                        transform: 'translate3d(0, -8px, 0)',
                      },
                      '70%': {
                        transform: 'translate3d(0, -4px, 0)',
                      },
                      '90%': {
                        transform: 'translate3d(0, -2px, 0)',
                      },
                    },
                  }),
                  ...(isClose && !isBouncing && !isNewBestStreakEver && {
                    animation: 'jiggle 0.2s ease-in-out infinite',
                    '@keyframes jiggle': {
                      '0%, 100%': {
                        transform: 'translate3d(1px,1px,0)',
                      },
                      '25%': {
                        transform: 'translate3d(-2px,-2px,0)',
                      },
                      '50%': {
                        transform: 'translate3d(2px,2px,0)',
                      },
                      '75%': {
                        transform: 'translate3d(-1px,-1px,0)',
                      },
                    },
                  }),
                  ...(isVeryClose && !isBouncing && !isClose && !isNewBestStreakEver && {
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': {
                        opacity: 1,
                      },
                      '50%': {
                        opacity: 0.7,
                      },
                    },
                  }),
                  ...(isNewBestStreakEver && !isBouncing && {
                    animation: 'bounce 1s ease-in-out infinite',
                    '@keyframes bounce': {
                      '0%, 20%, 53%, 80%, 100%': {
                        transform: 'translate3d(0,0,0)',
                      },
                      '40%, 43%': {
                        transform: 'translate3d(0, -8px, 0)',
                      },
                      '70%': {
                        transform: 'translate3d(0, -4px, 0)',
                      },
                      '90%': {
                        transform: 'translate3d(0, -2px, 0)',
                      },
                    },
                  }),
                }}
              >
                {currentStreak}
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Text
                color={textColor}
                fontWeight="bold"
                fontSize="sm"
              >
                Best:
              </Text>
              <Text
                color={isNewBestStreakEver ? greenColor : streakColor}
                fontWeight="bold"
                fontSize="lg"
              >
                {longestWordGuessStreak}
              </Text>
            </HStack>
          </HStack>
        </Box>
      </Tooltip>
    </>
  );
}; 