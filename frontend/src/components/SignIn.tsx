import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Link
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

interface SignInProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignIn({ isOpen, onClose }: SignInProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuthContext();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signIn(email, false);
      toast({
        title: "Check Your Email",
        description: "If an account exists for that email, a magic link was sent",
        status: "success",
        duration: 8000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      console.error('Error sending magic link:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send magic link',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Sign In</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <form onSubmit={handleSubmit}>
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
                Send Magic Link
              </Button>
              <Text fontSize="sm" color="gray.600">
                Don't have an account?{' '}
                <Link color="blue.500" onClick={() => {
                  onClose();
                  navigate('/register');
                }}>
                  Create one
                </Link>
              </Text>
            </VStack>
          </form>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
} 