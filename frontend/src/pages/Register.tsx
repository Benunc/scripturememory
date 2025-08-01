import React, { useState, useEffect, useRef } from 'react';
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
  Checkbox,
  useColorModeValue,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { debug } from '../utils/debug';
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

export function Register() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const [verseSet, setVerseSet] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const { signIn } = useAuthContext();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!turnstileToken) {
        throw new Error('Please complete the security check');
      }

      await signIn(email, true, turnstileToken, undefined, undefined, marketingOptIn, undefined);
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

  // Color mode values for better contrast
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headingColor = useColorModeValue('gray.800', 'white');

  return (
    <Box minH="100vh" bg={bgColor} display="flex" flexDirection="column">
      <AppHeader showAuth={false} />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading size="xl" mb={4} color={headingColor}>Join Scripture Memory</Heading>
            <Text fontSize="lg" color={textColor}>
              Start your journey of memorizing God's Word
            </Text>
          </Box>

          <Card bg={cardBg}>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="md" mb={2} color={headingColor}>Create Your Account</Heading>
                  <Text mb={4} color={textColor}>
                    Enter your email below to create your account. We'll send you a magic link to complete the registration.
                  </Text>
                  <Box as="form" onSubmit={handleSubmit}>
                    <VStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel color={headingColor}>Email</FormLabel>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                        />
                      </FormControl>
                      <Box ref={turnstileContainerRef} />
                      <FormControl>
                        <Checkbox 
                          isChecked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                          colorScheme="blue"
                          size="md"
                          color={headingColor}
                        >
                          I'd like to receive updates about new features, app improvements, and support.
                        </Checkbox>
                        <Text fontSize="xs" color={textColor} mt={1}>
                          We'll only send you relevant updates and you can unsubscribe any time! Since there is no official support system, unsubscribing from these messages means I can't really get in contact with you to tell you cool stuff that I add.
                        </Text>
                      </FormControl>
                      <Button
                        type="submit"
                        colorScheme="blue"
                        width="full"
                        isLoading={isLoading}
                        isDisabled={!turnstileToken}
                      >
                        Create Account
                      </Button>
                    </VStack>
                  </Box>
                </Box>

                <Box>
                  <Heading size="md" mb={2} color={headingColor}>Why Join?</Heading>
                  <VStack align="start" spacing={2}>
                    <Text color={textColor}>✓ Track your memorization progress</Text>
                    <Text color={textColor}>✓ Get personalized review schedules</Text>
                    <Text color={textColor}>✓ Access your verses anywhere</Text>
                    <Text color={textColor}>✓ Join a community of believers</Text>
                  </VStack>
                </Box>

                <Box>
                  <Heading size="md" mb={2} color={headingColor}>Support Our Mission</Heading>
                  <Text mb={4} color={textColor}>
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
            <Text color={textColor}>
              Already have an account?{' '}
              <Link color="blue.500" onClick={() => navigate('/')}>
                Sign in
              </Link>
            </Text>
          </Box>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 