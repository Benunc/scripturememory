import React from 'react';
import { 
  Container, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Box,
  Button,
  SimpleGrid,
  List,
  ListItem,
  ListIcon,
  Divider,
  Badge
} from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';
import { getLandingPage } from '../utils/content';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function ChurchGroups() {
  const page = getLandingPage('church-groups');

  if (!page) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.md" py={8} flex="1">
          <VStack spacing={6}>
            <Heading size="lg">
              Page Not Found
            </Heading>
            <Text color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              The page you're looking for doesn't exist.
            </Text>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.xl" py={8} flex="1">
        <VStack spacing={12} align="center" justify="center" minH="60vh">
          <Heading size="2xl" color="gray.800" _dark={{ color: 'white' }} textAlign="center">
            Church Group Management
          </Heading>
          <Text fontSize="xl" color="gray.600" _dark={{ color: 'whiteAlpha.800' }} textAlign="center">
            Coming Soon
          </Text>
          <Text fontSize="md" color="gray.500" _dark={{ color: 'whiteAlpha.600' }} textAlign="center" maxW="md">
            We're working on specialized features for church groups. Stay tuned for updates!
          </Text>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 