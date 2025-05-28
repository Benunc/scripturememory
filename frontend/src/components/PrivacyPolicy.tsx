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
  Flex,
  HStack,
  Link,
  Button,
} from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';
import { Footer } from './Footer';
import logo from '/assets/images/ScriptureMemory.svg';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
  const email = 'ben@wpsteward.com';
  const navigate = useNavigate();

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <Box as="header" p={4} borderBottom="1px" borderColor="gray.200">
        <Flex justify="space-between" align="center">
          <Link as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
            <HStack spacing={4}>
              <img src={logo} alt="Scripture Memory" style={{ height: '40px' }} />
              <Heading size="md">Scripture Memory</Heading>
            </HStack>
          </Link>
          <Button
            variant="outline"
            colorScheme="blue"
            onClick={() => navigate('/')}
          >
            Sign In
          </Button>
        </Flex>
      </Box>

      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl" textAlign="center">Privacy Policy</Heading>
          
          <Box>
            <Heading as="h2" size="lg" mb={4}>Information We Collect</Heading>
            <List spacing={3} styleType="none">
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Your email address (for authentication)</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Your scripture verses and progress</Text>
              </ListItem>
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>How We Use Your Information</Heading>
            <List spacing={3} styleType="none">
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Authenticate your account</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Store your verses and track your progress</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Send you magic links for secure login</Text>
              </ListItem>
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Data Storage</Heading>
            <Text mb={4}>
              Your data is stored securely in our database with the following protections:
            </Text>
            <List spacing={3} styleType="none">
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Encrypted at rest</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Protected by industry-standard security measures</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Accessible only to you and our secure API</Text>
              </ListItem>
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Technologies We Use</Heading>
            <List spacing={3} styleType="none">
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Cloudflare Workers for secure API handling</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Cloudflare Turnstile for bot protection</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Magic links for passwordless authentication</Text>
              </ListItem>
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Your Rights</Heading>
            <List spacing={3} styleType="none">
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Access your data at any time</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Delete your account and all associated data</Text>
              </ListItem>
              <ListItem display="flex" alignItems="flex-start">
                <ListIcon as={CheckCircleIcon} color="green.500" mt={1} />
                <Text>Export your data in a standard format</Text>
              </ListItem>
            </List>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Contact</Heading>
            <Text>
              If you have any questions about this Privacy Policy, please{' '}
              <Link href={`mailto:${email}`} color="blue.500" _hover={{ textDecoration: 'underline' }}>
                contact us
              </Link>
              .
            </Text>
          </Box>
        </VStack>
      </Container>

      <Footer />
    </Box>
  );
}; 