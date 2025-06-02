import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, Spinner, Text, VStack, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';
import { debug } from '../utils/debug';

export function VerifyToken() {
  debug.log('auth', '=== VerifyToken component rendering ===');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyToken, error: authError } = useAuth();
  const token = searchParams.get('token');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const hasVerified = useRef(false);

  debug.log('auth', 'Current token from URL:', token);
  debug.log('auth', 'Current auth error:', authError);

  useEffect(() => {
    debug.log('auth', '=== VerifyToken useEffect running ===');
    debug.log('auth', 'Token from URL:', token);
    debug.log('auth', 'Current window location:', window.location.href);
    
    const verify = async () => {
      if (!token || hasVerified.current) {
        debug.log('auth', 'No token provided or already verified');
        return;
      }

      try {
        debug.log('auth', 'Starting verification with token:', token);
        setIsVerifying(true);
        hasVerified.current = true;
        
        // Use the verifyToken function from useAuth
        const success = await verifyToken(token);
        debug.log('auth', 'Verification result:', success);
        
        if (success) {
          debug.log('auth', 'Verification successful, reloading page');
          // Replace the current URL with the home page to prevent back navigation
          window.history.replaceState({}, '', '/');
          // Force a page reload to ensure auth state is properly initialized
          window.location.reload();
        } else {
          debug.log('auth', 'Verification returned false');
          setVerificationError('Verification failed');
          setIsVerifying(false);
        }
      } catch (error) {
        debug.error('auth', 'Verification error:', error);
        setVerificationError(error instanceof Error ? error.message : 'Failed to verify token');
        setIsVerifying(false);
      }
    };

    verify();
  }, [token, verifyToken]);

  debug.log('auth', 'Current state:', { token, verificationError, isVerifying });

  if (verificationError) {
    debug.log('auth', 'Rendering error state:', verificationError);
    return (
      <Box p={4}>
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Verification Failed</AlertTitle>
          <AlertDescription>{verificationError}</AlertDescription>
        </Alert>
      </Box>
    );
  }

  debug.log('auth', 'Rendering loading state');
  return (
    <Box p={4}>
      <VStack spacing={4}>
        <Spinner size="xl" />
        <Text>{isVerifying ? 'Verifying your login...' : 'Login successful! Redirecting...'}</Text>
      </VStack>
    </Box>
  );
} 