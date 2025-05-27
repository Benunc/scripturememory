import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleIcon } from '@chakra-ui/icons';

export function ThankYou() {
  const navigate = useNavigate();

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={4}>Thank You!</Heading>
          <Text fontSize="lg" color="gray.600">
            Your support helps us continue building tools for memorizing God's Word
          </Text>
        </Box>

        <Card>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Box textAlign="center">
                <Text mb={6}>
                  Your donation makes a difference. Together, we're helping believers around the world
                  grow closer to God through Scripture memorization.
                </Text>
                
                <Box mb={8}>
                  <Heading size="md" mb={4}>Ready to Get Started?</Heading>
                  <Text mb={4}>
                    If you don't have an account yet, here's how to get started:
                  </Text>
                  <List spacing={3} textAlign="left" mb={6}>
                    <ListItem>
                      <ListIcon as={CheckCircleIcon} color="green.500" />
                      Click the "Get Started" button below
                    </ListItem>
                    <ListItem>
                      <ListIcon as={CheckCircleIcon} color="green.500" />
                      Enter your email address
                    </ListItem>
                    <ListItem>
                      <ListIcon as={CheckCircleIcon} color="green.500" />
                      Check your email for a magic link
                    </ListItem>
                    <ListItem>
                      <ListIcon as={CheckCircleIcon} color="green.500" />
                      Click the link to sign in
                    </ListItem>
                  </List>
                  <Button
                    onClick={() => navigate('/register')}
                    size="lg"
                    colorScheme="blue"
                    width="200px"
                    mb={4}
                  >
                    Get Started
                  </Button>
                </Box>

                <Text mb={4}>
                  Already have an account? You can sign in below.
                </Text>
                <Button
                  onClick={() => navigate('/')}
                  size="lg"
                  variant="outline"
                  width="200px"
                >
                  Sign In
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
} 