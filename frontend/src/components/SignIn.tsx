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
import { getMagicLink } from '../utils/api';
import { debug } from '../utils/debug';

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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Load Turnstile script
  useEffect(() => {
    const loadTurnstile = async () => {
      try {
        debug.log('auth', 'Checking Turnstile availability');
        if (window.turnstile) {
          debug.log('auth', 'Turnstile already loaded');
          setIsTurnstileReady(true);
          return;
        }

        debug.log('auth', 'Loading Turnstile script');
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          debug.log('auth', 'Turnstile script loaded successfully');
          setIsTurnstileReady(true);
        };
        script.onerror = (error) => {
          debug.error('auth', 'Failed to load Turnstile script', error);
          toast({
            title: "Error",
            description: "Failed to load security check. Please refresh the page.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        };
        document.head.appendChild(script);
      } catch (error) {
        debug.error('auth', 'Error loading Turnstile script', error);
        toast({
          title: "Error",
          description: "Failed to load security check. Please refresh the page.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    };

    loadTurnstile();
  }, []);

  // Function to render Turnstile
  const renderTurnstile = () => {
    debug.log('auth', 'Attempting to render Turnstile', {
      containerReady: !!turnstileContainerRef.current,
      turnstileReady: !!window.turnstile,
      isOpen,
      isTurnstileReady
    });

    if (!turnstileContainerRef.current) {
      debug.error('auth', 'Turnstile container not ready');
      return;
    }

    if (!window.turnstile) {
      debug.error('auth', 'Turnstile API not ready');
      return;
    }
    
    // Use test keys for local development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const siteKey = import.meta.env.DEV
      ? '1x00000000000000000000AA'  // Test site key
      : import.meta.env.VITE_TURNSTILE_SITE_KEY;

    debug.log('auth', 'Using Turnstile site key', { isLocalhost, hasSiteKey: !!siteKey });

    if (!siteKey) {
      debug.error('auth', 'Turnstile site key is missing');
      toast({
        title: "Configuration Error",
        description: "Security check configuration is missing. Please contact support.",
        status: "error",
        duration: null,
        isClosable: true,
      });
      return;
    }
    
    try {
      // Reset any existing widget
      if (widgetIdRef.current) {
        debug.log('auth', 'Resetting existing Turnstile widget');
        window.turnstile.reset(widgetIdRef.current);
        widgetIdRef.current = null;
      }

      debug.log('auth', 'Rendering new Turnstile widget');
      // Render new widget
      widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          debug.log('auth', 'Turnstile callback received token');
          setTurnstileToken(token);
        },
        'refresh-expired': 'auto',
        'appearance': 'always'
      });
      debug.log('auth', 'Turnstile widget rendered successfully');
    } catch (error) {
      debug.error('auth', 'Error rendering Turnstile:', error);
      toast({
        title: "Error",
        description: "Failed to load security check. Please refresh the page.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Render Turnstile widget when modal opens and script is ready
  useEffect(() => {
    debug.log('auth', 'Turnstile render effect triggered', {
      isOpen,
      isTurnstileReady,
      hasTurnstile: !!window.turnstile
    });

    if (isOpen && isTurnstileReady) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        renderTurnstile();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isTurnstileReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      if (!turnstileToken) {
        setError('Please complete the security check');
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        const result = await getMagicLink(email, false, turnstileToken);
        if (result.data?.token) {
          setMessage('Magic link sent! Please check your email.');
          setEmail('');
          setTurnstileToken(''); // Reset token after successful use
          if (widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
        } else {
          setError(result.error || 'Failed to send magic link');
        }
      } catch (error) {
        debug.error('auth', 'Error sending magic link', error);
        setError('Failed to send magic link. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } catch (error) {
      debug.error('auth', 'Error sending magic link', error);
      setError('Failed to send magic link. Please try again.');
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