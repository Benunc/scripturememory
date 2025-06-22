import React, { useState, useEffect, useRef } from 'react';
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
  Spinner,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { debug } from '../utils/debug';
import { getApiUrl } from '../utils/api';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

// Add Turnstile types
declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function AddVerseSet() {
  const [verseSetCode, setVerseSetCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const { token, userEmail, isAuthenticated } = useAuthContext();
  const navigate = useNavigate();
  const toast = useToast();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Load Turnstile script
  useEffect(() => {
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
  }, []);

  // Render Turnstile when ready
  useEffect(() => {
    if (!isTurnstileReady || !turnstileContainerRef.current) return;

    debug.log('auth', 'Attempting to render Turnstile', {
      containerReady: !!turnstileContainerRef.current,
      turnstileReady: !!window.turnstile,
      isTurnstileReady
    });

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
  }, [isTurnstileReady]);

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

    if (!turnstileToken) {
      toast({
        title: "Error",
        description: "Please complete the security check",
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
          turnstileToken: turnstileToken,
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
        setTurnstileToken('');
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
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

                  <Box>
                    <FormControl isRequired>
                      <FormLabel>Security Check</FormLabel>
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
                    </FormControl>
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
                    isDisabled={!verseSetCode.trim() || !turnstileToken}
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