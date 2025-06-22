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
  Spinner,
} from '@chakra-ui/react';
import { useAuthContext } from '../contexts/AuthContext';
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

interface SignUpProps {
  onClose?: () => void;
}

export function SignUp({ onClose }: SignUpProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure();
  const { signIn } = useAuthContext();
  const toast = useToast();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);

  // Load Turnstile script when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowTurnstile(true);
    }
  }, [isOpen]);

  // Load Turnstile script only when needed
  useEffect(() => {
    if (!showTurnstile) return;

    let script: HTMLScriptElement | null = null;
    const loadTurnstile = async () => {
      try {
        debug.log('auth', 'Checking Turnstile availability');
        if (window.turnstile) {
          debug.log('auth', 'Turnstile already loaded');
          setIsTurnstileReady(true);
          return;
        }

        debug.log('auth', 'Loading Turnstile script');
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = false;
        script.defer = false;
        script.onload = () => {
          debug.log('auth', 'Turnstile script loaded successfully');
          setTimeout(() => {
            setIsTurnstileReady(true);
          }, 100);
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

    // Cleanup function
    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (error) {
          debug.error('auth', 'Error resetting Turnstile widget during cleanup', error);
        }
      }
      widgetIdRef.current = null;
      setIsTurnstileReady(false);
    };
  }, [showTurnstile]);

  // Function to render Turnstile
  const renderTurnstile = () => {
    debug.log('auth', 'Attempting to render Turnstile', {
      containerReady: !!turnstileContainerRef.current,
      turnstileReady: !!window.turnstile,
      showTurnstile,
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

    // Clear any existing widget
    if (widgetIdRef.current) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (error) {
        debug.error('auth', 'Error resetting existing Turnstile widget', error);
      }
      widgetIdRef.current = null;
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

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowTurnstile(false);
      setTurnstileToken('');
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch (error) {
          debug.error('auth', 'Error resetting Turnstile widget on modal close', error);
        }
      }
      widgetIdRef.current = null;
    }
  }, [isOpen]);

  // Render Turnstile widget when needed and ready
  useEffect(() => {
    debug.log('auth', 'Turnstile render effect triggered', {
      showTurnstile,
      isTurnstileReady,
      hasTurnstile: !!window.turnstile
    });

    if (showTurnstile && isTurnstileReady && turnstileContainerRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        renderTurnstile();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showTurnstile, isTurnstileReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!turnstileToken) {
        throw new Error('Please complete the security check');
      }

      await signIn(email, true, turnstileToken, undefined);
      onOpen();
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
    <>
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
          {showTurnstile && (
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
          )}
          <Button
            type="submit"
            colorScheme="blue"
            width="full"
            isLoading={isLoading}
            isDisabled={!turnstileToken}
          >
            Sign Up
          </Button>
        </VStack>
      </Box>

      <Modal isOpen={isOpen} onClose={onModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Check Your Email</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <Text>
                We've sent you a magic link to complete your registration.
              </Text>
              <Text fontSize="sm" color="gray.500">
                Check your spam folder if you don't see it.
              </Text>
              <Text fontSize="sm" color="gray.500">
                Click the link in your email to create your account. You can close this window once you've clicked the link.
              </Text>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}