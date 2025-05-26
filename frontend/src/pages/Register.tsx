import React, { useState } from 'react';
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  VStack,
  Card,
  CardBody,
  useToast,
  Link,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

export function Register() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuthContext();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, true);
      toast({
        title: "Check your email",
        description: "We've sent you a magic link to complete your registration.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send magic link",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading size="xl" mb={4}>Join Scripture Memory</Heading>
          <Text fontSize="lg" color="gray.600">
            Start your journey of memorizing God's Word
          </Text>
        </Box>

        <Card>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="md" mb={2}>Create Your Account</Heading>
                <Text mb={4}>
                  Enter your email below to create your account. We'll send you a magic link to complete the registration.
                </Text>
                <Box as="form" onSubmit={handleSubmit}>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Email</FormLabel>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                      />
                    </FormControl>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      width="full"
                      isLoading={isLoading}
                    >
                      Create Account
                    </Button>
                  </VStack>
                </Box>
              </Box>

              <Box>
                <Heading size="md" mb={2}>Why Join?</Heading>
                <VStack align="start" spacing={2}>
                  <Text>✓ Track your memorization progress</Text>
                  <Text>✓ Get personalized review schedules</Text>
                  <Text>✓ Access your verses anywhere</Text>
                  <Text>✓ Join a community of believers</Text>
                </VStack>
              </Box>

              <Box>
                <Heading size="md" mb={2}>Support Our Mission</Heading>
                <Text mb={4}>
                  Scripture Memory is free to use, but your support helps us continue building tools for memorizing God's Word.
                </Text>
                <Button
                  colorScheme="green"
                  width="full"
                  onClick={() => navigate('/donate')}
                >
                  Support Scripture Memory
                </Button>
              </Box>
            </VStack>
          </CardBody>
        </Card>

        <Box textAlign="center">
          <Text>
            Already have an account?{' '}
            <Link color="blue.500" onClick={() => navigate('/')}>
              Sign in
            </Link>
          </Text>
        </Box>
      </VStack>
    </Container>
  );
} 