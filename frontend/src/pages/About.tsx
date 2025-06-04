import React from 'react';
import { Box, Container, Heading, Text, VStack, Link } from '@chakra-ui/react';
import { Footer } from '../components/Footer';
import { AppHeader } from '../components/AppHeader';

export const About: React.FC = () => {
  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl">About Scripture Memory</Heading>
          
          <Box>
            <Heading as="h2" size="lg" mb={4}>Our Mission</Heading>
            <Text>
              Scripture Memory is dedicated to helping Christians memorize and internalize God's Word. 
              We believe that memorizing scripture is a powerful way to grow in faith and draw closer to God.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>How It Works</Heading>
            <Text>
              Our app uses a proven spaced repetition system to help you memorize verses effectively. 
              You can add your favorite verses, track your progress, and earn points as you master each verse.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Features</Heading>
            <VStack align="stretch" spacing={4}>
              <Text>• Add and manage your favorite verses</Text>
              <Text>• Track your memorization progress</Text>
              <Text>• Earn points and maintain streaks</Text>
              <Text>• Dark mode support for comfortable reading</Text>
              <Text>• Mobile-friendly design</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Support Us</Heading>
            <Text>
              Scripture Memory is free to use, but your support helps us continue developing and improving the app. 
              If you find it valuable, please consider{' '}
              <Link href="/donate" color="blue.500" textDecoration="underline">
                supporting our work
              </Link>.
            </Text>
          </Box>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 