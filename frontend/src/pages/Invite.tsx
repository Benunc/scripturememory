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
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { debug } from '../utils/debug';
import { Footer } from '../components/Footer';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { useColorMode } from '@chakra-ui/react';

// Add Turnstile types
declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

// Verse set descriptions
const VERSE_SET_DESCRIPTIONS: Record<string, { title: string; description: string; badge: string }> = {
  childrens_verses: {
    title: "Children's Verses",
    description: "Perfect for young learners with simple, foundational Bible verses.",
    badge: "Kids"
  },
  beginners: {
    title: "Beginner Verses", 
    description: "Great starting point for new believers with essential verses.",
    badge: "Beginner"
  },
  gpc_youth: {
    title: "GPC Youth Challenge",
    description: "For GPC Youth. Start with Pastor-Paul approved verses.",
    badge: "GPC Youth"
  }
};

export function Invite() {
  const [searchParams] = useSearchParams();
  const verseSet = searchParams.get('verseSet');
  const prefillEmail = searchParams.get('email');
  
  const [email, setEmail] = useState(prefillEmail || '');
  const [isLoading, setIsLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isTurnstileReady, setIsTurnstileReady] = useState(false);
  const { signIn } = useAuthContext();
  const navigate = useNavigate();
  const toast = useToast();
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const { colorMode, toggleColorMode } = useColorMode();

  // Get verse set info
  const verseSetInfo = verseSet ? VERSE_SET_DESCRIPTIONS[verseSet] : null;

  // Load Turnstile script (same as Register component)
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

  // Render Turnstile when ready (same as Register component)
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

      // Pass the verseSet to the signIn function
      await signIn(email, true, turnstileToken, verseSet);
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
    <Box minH="100vh" display="flex" flexDirection="column">
      {/* Skip to main content link for accessibility */}
      <Link
        href="#main-content"
        position="absolute"
        left="-9999px"
        top="auto"
        width="1px"
        height="1px"
        overflow="hidden"
        zIndex="9999"
        _focus={{
          left: "10px",
          top: "10px",
          width: "auto",
          height: "auto",
          padding: "10px",
          backgroundColor: "white",
          border: "1px solid",
          borderColor: "blue.500",
          borderRadius: "md",
        }}
      >
        Skip to main content
      </Link>

      {/* Color mode toggle */}
      <Box position="absolute" top={4} right={4}>
        <IconButton
          aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
          icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
          onClick={toggleColorMode}
          variant="ghost"
        />
      </Box>

      {/* Main content */}
      <Box id="main-content" flex="1" p={8} tabIndex={-1}>
        <Container maxW="container.md" py={8}>
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Heading size="xl" mb={4}>You're Invited!</Heading>
              {verseSetInfo && (
                <Box mb={4}>
                  <Badge colorScheme="blue" fontSize="md" mb={2}>
                    {verseSetInfo.badge}
                  </Badge>
                  <Text fontSize="lg" color="gray.600">
                    {verseSetInfo.description}
                  </Text>
                </Box>
              )}
              <Text fontSize="lg" color="gray.600">
                Join Scripture Memory with a custom verse set
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
                        <Box ref={turnstileContainerRef} />
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
                    <Heading size="md" mb={2}>What You'll Get</Heading>
                    <VStack align="start" spacing={2}>
                      <Text>✓ Custom verse set tailored for you</Text>
                      <Text>✓ Track your memorization progress</Text>
                      <Text>✓ Get personalized review schedules</Text>
                      <Text>✓ Access your verses anywhere</Text>
                      <Text>✓ Join a community of believers</Text>
                    </VStack>
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
      </Box>

      {/* Footer */}
      <Footer />
    </Box>
  );
}