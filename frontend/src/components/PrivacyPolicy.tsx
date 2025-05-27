import React from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';

export const PrivacyPolicy: React.FC = () => {
  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={6} align="stretch">
        <Heading as="h1" size="xl">Privacy Policy</Heading>
        
        <Box>
          <Heading as="h2" size="lg" mb={4}>Information We Collect</Heading>
          <List spacing={3}>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Your email address (for authentication)</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Your scripture verses and progress</Text>
            </ListItem>
          </List>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={4}>How We Use Your Information</Heading>
          <List spacing={3}>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Authenticate your account</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Store your verses and track your progress</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Send you magic links for secure login</Text>
            </ListItem>
          </List>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={4}>Data Storage</Heading>
          <Text mb={4}>
            Your data is stored securely in our database with the following protections:
          </Text>
          <List spacing={3}>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Encrypted at rest</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Protected by industry-standard security measures</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Accessible only to you and our secure API</Text>
            </ListItem>
          </List>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={4}>Technologies We Use</Heading>
          <List spacing={3}>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Cloudflare Workers for secure API handling</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Cloudflare Turnstile for bot protection</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Magic links for passwordless authentication</Text>
            </ListItem>
          </List>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={4}>Your Rights</Heading>
          <List spacing={3}>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Access your data at any time</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Delete your account and all associated data</Text>
            </ListItem>
            <ListItem>
              <ListIcon as={CheckCircleIcon} color="green.500" />
              <Text>Export your data in a standard format</Text>
            </ListItem>
          </List>
        </Box>

        <Box>
          <Heading as="h2" size="lg" mb={4}>Contact</Heading>
          <Text>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:ben@scripturememory.app" style={{ color: 'blue' }}>
              ben@scripturememory.app
            </a>
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}; 