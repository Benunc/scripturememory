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

export function YouthGroups() {
  const page = getLandingPage('youth-groups');

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
      <VStack spacing={12} align="start">
        {/* Hero Section */}
        <Box w="full" textAlign="center">
          <Heading size="2xl" color="gray.800" _dark={{ color: 'white' }} mb={4}>
            Scripture Memory for Youth Groups
          </Heading>
          <Text fontSize="xl" color="gray.600" _dark={{ color: 'whiteAlpha.800' }} mb={8} maxW="3xl" mx="auto">
            Transform your youth group's scripture memory with our powerful, easy-to-use platform.
          </Text>
          <HStack spacing={4} justify="center">
            <Button size="lg" colorScheme="blue" px={8} as="a" href="/register">
              Join Today
            </Button>
            <Button size="lg" variant="outline" colorScheme="blue" px={8} as="a" href="/about">
              Learn More
            </Button>
          </HStack>
        </Box>

        <Divider />

        {/* Features Section */}
        <Box w="full">
          <Heading size="lg" color="gray.800" _dark={{ color: 'white' }} mb={8} textAlign="center">
            Why Youth Groups Love Scripture Memory
          </Heading>
          
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
            <VStack align="center" spacing={4}>
              <Badge colorScheme="blue" variant="subtle" p={2}>
                Easy Setup
              </Badge>
              <Heading size="md" color="gray.800" _dark={{ color: 'white' }}>
                Get Started in Minutes
              </Heading>
              <Text color="gray.600" _dark={{ color: 'whiteAlpha.800' }}>
                Create a group, invite students via email, and start memorizing together. No complex setup required.
              </Text>
            </VStack>

            <VStack align="center" spacing={4}>
              <Badge colorScheme="green" variant="subtle" p={2}>
                Engaging Features
              </Badge>
              <Heading size="md" color="gray.800" _dark={{ color: 'white' }}>
                Keep Students Motivated
              </Heading>
              <Text color="gray.600" _dark={{ color: 'whiteAlpha.800' }}>
                Gamification keeps students engaged while progress tracking helps leaders encourage growth.
              </Text>
            </VStack>

            <VStack align="center" spacing={4}>
              <Badge colorScheme="purple" variant="subtle" p={2}>
                Proven Results
              </Badge>
              <Heading size="md" color="gray.800" _dark={{ color: 'white' }}>
                Students Actually Memorize
              </Heading>
              <Text color="gray.600" _dark={{ color: 'whiteAlpha.800' }}>
                Built-in encouragement system and community features create accountability that works.
              </Text>
            </VStack>
          </SimpleGrid>
        </Box>

        <Divider />

        {/* Getting Started Section */}
        <Box w="full">
          <Heading size="lg" color="gray.800" _dark={{ color: 'white' }} mb={6}>
            Getting Started
          </Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <VStack align="start" spacing={4}>
              <List spacing={3}>
                <ListItem>
                  <ListIcon as={CheckCircleIcon} color="green.500" />
                  <Text as="span" fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>Create Your Group</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.700' }} mt={1}>
                    Sign up as a leader and create your youth group in minutes.
                  </Text>
                </ListItem>
                <ListItem>
                  <ListIcon as={CheckCircleIcon} color="green.500" />
                  <Text as="span" fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>Invite Students</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.700' }} mt={1}>
                    Send email invitations - students join with one click, no passwords needed.
                  </Text>
                </ListItem>
              </List>
            </VStack>

            <VStack align="start" spacing={4}>
              <List spacing={3}>
                <ListItem>
                  <ListIcon as={CheckCircleIcon} color="green.500" />
                  <Text as="span" fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>Add Verse Sets</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.700' }} mt={1}>
                    Choose from curated sets or create custom ones for your group.
                  </Text>
                </ListItem>
                <ListItem>
                  <ListIcon as={CheckCircleIcon} color="green.500" />
                  <Text as="span" fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>Start Memorizing</Text>
                  <Text fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.700' }} mt={1}>
                    Students practice individually while leaders track progress and celebrate achievements.
                  </Text>
                </ListItem>
              </List>
            </VStack>
          </SimpleGrid>
        </Box>

        <Divider />

        {/* Testimonials Section */}
        <Box w="full">
          <Heading size="lg" color="gray.800" _dark={{ color: 'white' }} mb={6} textAlign="center">
            What Folks Are Saying
          </Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <Box p={6} border="1px" borderColor="gray.200" _dark={{ borderColor: 'whiteAlpha.200', bg: 'whiteAlpha.50' }} borderRadius="lg" bg="gray.50">
              <Text fontSize="lg" color="gray.700" _dark={{ color: 'whiteAlpha.900' }} mb={4} fontStyle="italic">
                "I am going to catch your score on the leaderboard! I think I may be spending a little too much time on this app."
              </Text>
              <Text fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>
                - a 9th grader who prefers to remain anonymous.
              </Text>
            </Box>

            <Box p={6} border="1px" borderColor="gray.200" _dark={{ borderColor: 'whiteAlpha.200', bg: 'whiteAlpha.50' }} borderRadius="lg" bg="gray.50">
              <Text fontSize="lg" color="gray.700" _dark={{ color: 'whiteAlpha.900' }} mb={4} fontStyle="italic">
                "This app is actually really cool."
              </Text>
              <Text fontWeight="medium" color="gray.800" _dark={{ color: 'white' }}>
                - a 10th grader who prefers to remain anonymous.
              </Text>
            </Box>
          </SimpleGrid>
        </Box>

        {/* CTA Section */}
        <Box w="full" textAlign="center" py={8} bg="blue.50" _dark={{ bg: 'blue.900' }} borderRadius="lg">
          <Heading size="lg" color="gray.800" _dark={{ color: 'white' }} mb={4}>
            Ready to Get Started?
          </Heading>
          <Text fontSize="lg" color="gray.600" _dark={{ color: 'whiteAlpha.800' }} mb={6}>
            Join literally one youth group already using Scripture Memory to help their students hide God's Word in their hearts.
          </Text>
          <HStack spacing={4} justify="center">
            <Button size="lg" colorScheme="blue" px={8} as="a" href="/register">
              Join Today
            </Button>
            <Button size="lg" variant="outline" colorScheme="blue" px={8} as="a" href="/about">
              Learn More
            </Button>
          </HStack>
        </Box>
      </VStack>
    </Container>
    <Footer />
  </Box>
  );
} 