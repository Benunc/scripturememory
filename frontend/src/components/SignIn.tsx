import React, { useState, useEffect, useRef } from 'react';
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
  Link,
  Spinner
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';

// Add Turnstile types
declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

interface SignInProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignIn({ isOpen, onClose }: SignInProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const { signIn } = useAuthContext();
  const toast = useToast();
  const navigate = useNavigate();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Load Turnstile script
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const loadScript = () => {
      if (document.querySelector('script[src*="turnstile"]')) {
        setIsTurnstileReady(true);
        return;
      }

      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsTurnstileReady(true);
      };
      document.head.appendChild(script);
    };

    loadScript();

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Function to render Turnstile
  const renderTurnstile = () => {
    if (!turnstileContainerRef.current || !window.turnstile) return;
    
    // Use test keys for local development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const siteKey = import.meta.env.DEV
      ? '1x00000000000000000000AA'  // Test site key
      : import.meta.env.VITE_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.error('Turnstile site key is missing. Please check your .env file.');
      toast({
        title: "Configuration Error",
        description: "Turnstile site key is missing. Please contact support.",
        status: "error",
        duration: null,
        isClosable: true,
      });
      return;
    }
    
    // Reset any existing widget
    if (widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }

    try {
      // Render new widget
      widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
        'refresh-expired': 'auto',
        'appearance': 'always'
      });
    } catch (error) {
      console.error('Error rendering Turnstile:', error);
      toast({
        title: "Error",
        description: "Failed to load Turnstile. Please refresh the page.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Render Turnstile widget when modal opens and script is ready
  useEffect(() => {
    if (isOpen && isTurnstileReady) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        renderTurnstile();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isTurnstileReady]);

  // Cleanup Turnstile when modal closes
  useEffect(() => {
    if (!isOpen && widgetIdRef.current) {
      window.turnstile?.reset(widgetIdRef.current);
      widgetIdRef.current = null;
      setTurnstileToken('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
      toast({
        title: "Error",
        description: "Please complete the Turnstile challenge",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, false, turnstileToken);
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
              <Box 
                ref={turnstileContainerRef} 
                w="full" 
                minH="65px" 
                display="flex" 
                alignItems="center" 
                justifyContent="center"
              >
                {!isTurnstileReady && <Spinner />}
              </Box>
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