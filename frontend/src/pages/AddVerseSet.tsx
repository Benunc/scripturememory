import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  useToast,
  Input,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { debug } from '../utils/debug';
import { getApiUrl } from '../utils/api';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function AddVerseSet() {
  const [verseSetCode, setVerseSetCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { token, userEmail, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const toast = useToast();

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Box flex="1" p={8}>
          <Container maxW="container.md" py={8}>
            <Card>
              <CardBody>
                <VStack spacing={4}>
                  <Heading size="md">Authentication Required</Heading>
                  <Text>You must be logged in to add verse sets.</Text>
                  <Button colorScheme="blue" onClick={() => navigate('/')}>
                    Go to Home
                  </Button>
                </VStack>
              </CardBody>
            </Card>
          </Container>
        </Box>
        <Footer />
      </Box>
    );
  }

  const handleAddVerseSet = async () => {
    if (!verseSetCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a verse set code",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    setSuccess(false);

    try {
      debug.log('verses', 'Adding verse set', { verseSet: verseSetCode, email: userEmail });

      const response = await fetch(`${getApiUrl()}/auth/add-verses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          verseSet: verseSetCode.trim(),
          turnstileToken: 'test-token', // In production, you'd need to add Turnstile
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        toast({
          title: "Success!",
          description: result.message || `Successfully added ${result.added} verses`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
        
        // Reset form
        setVerseSetCode('');
      } else {
        throw new Error(result.error || 'Failed to add verse set');
      }
    } catch (error) {
      debug.error('verses', 'Error adding verse set', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add verse set',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      
      <Box flex="1" p={8}>
        <Container maxW="container.md" py={8}>
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Heading size="xl" mb={4}>Add Verse Set</Heading>
              <Text fontSize="lg" color="gray.600">
                Enter the verse set code to add verses to your account
              </Text>
            </Box>

            <Card>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Heading size="md" mb={4}>Enter Verse Set Code</Heading>
                    <FormControl isRequired>
                      <FormLabel>Verse Set Code</FormLabel>
                      <Input
                        value={verseSetCode}
                        onChange={(e) => setVerseSetCode(e.target.value)}
                        placeholder="e.g., gpc_youth, childrens_verses, default"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddVerseSet();
                          }
                        }}
                      />
                    </FormControl>
                    <Text fontSize="sm" color="gray.500" mt={2}>
                      Enter the exact code for the verse set you want to add.
                    </Text>
                  </Box>

                  {success && (
                    <Alert status="success">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Success!</AlertTitle>
                        <AlertDescription>
                          The verse set has been added to your account. You can now find these verses in your verse list.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  <Button
                    colorScheme="blue"
                    onClick={handleAddVerseSet}
                    isLoading={isLoading}
                    isDisabled={!verseSetCode.trim()}
                    width="full"
                  >
                    Add Verse Set
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            <Box textAlign="center">
              <Text fontSize="sm" color="gray.500">
                Note: Only verses you don't already have will be added to your account.
              </Text>
            </Box>
          </VStack>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}