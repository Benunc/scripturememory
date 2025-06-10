import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  UnorderedList,
  ListItem,
  useColorModeValue,
} from '@chakra-ui/react';

export const PointsTutorial: React.FC = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.700', 'gray.300');

  return (
    <Box
      p={6}
      bg={bgColor}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={borderColor}
      shadow="sm"
      maxW="800px"
      mx="auto"
      mt={8}
    >
      <VStack align="stretch" spacing={6}>
        <Heading size="xl" mb={2} textAlign="center">
          How Points Work
        </Heading>
        
        <Box textAlign="left">
          <Heading size="lg" mb={3}>
            Earning Points
          </Heading>
          <UnorderedList spacing={2} color={textColor}>
            <ListItem>1 point for the first correct word during memorization practice</ListItem>
            <ListItem>Each consecutive correct word in a streak is worth its streak position (e.g., 2nd word = 2 points, 3rd word = 3 points, etc.)</ListItem>
            <ListItem>10 points for adding new verses to memorize (limit 3 points-earning verses per day)</ListItem>
            <ListItem>500 points for achieving mastery of a verse</ListItem>
            <ListItem>50 points for maintaining a daily practice streak (awarded after 2+ days)</ListItem>
            <ListItem>Points are awarded in real-time as you practice, and make your progress visible immediately</ListItem>
          </UnorderedList>
        </Box>

        <Box textAlign="left">
          <Heading size="lg" mb={3}>
            Achieving Mastery
          </Heading>
          <UnorderedList spacing={2} color={textColor}>
            <ListItem>Complete 5 total attempts with at least 80% accuracy</ListItem>
            <ListItem>Get 3 perfect attempts in a row (100% accuracy)</ListItem>
            <ListItem>Perfect attempts must be at least 24 hours apart</ListItem>
            <ListItem>Once mastered, you'll receive a 500-point bonus!</ListItem>
          </UnorderedList>
        </Box>

        <Box textAlign="left">
          <Heading size="lg" mb={3}>
            Tips for Success
          </Heading>
          <UnorderedList spacing={2} color={textColor}>
            <ListItem>Practice regularly to build up your points</ListItem>
            <ListItem>Focus on accuracy over speed, there's no time limit.</ListItem>
            <ListItem>Check back here to see your points, streaks, and mastery grow!</ListItem>
          </UnorderedList>
        </Box>

        <Text fontSize="sm" color="gray.500" mt={2} textAlign="left">
          Points are a fun way to track your progress and stay motivated. Keep practicing to see your total grow!
        </Text>
      </VStack>
    </Box>
  );
}; 