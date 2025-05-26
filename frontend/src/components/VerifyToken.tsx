import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Box, Spinner, Text, VStack, Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';

export function VerifyToken() {
  console.log('=== VerifyToken component rendering ===');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyToken, error: authError } = useAuth();
  const token = searchParams.get('token');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const hasVerified = useRef(false);

  console.log('Current token from URL:', token);
  console.log('Current auth error:', authError);

  useEffect(() => {
    console.log('=== VerifyToken useEffect running ===');
    console.log('Token from URL:', token);
    
    const verify = async () => {
      if (!token || hasVerified.current) {
        console.log('No token provided or already verified');
        return;
      }

      try {
        console.log('Starting verification with token:', token);
        setIsVerifying(true);
        hasVerified.current = true;
        
        // Use the worker URL directly
        const apiUrl = `https://scripture-memory.ben-2e6.workers.dev/auth/verify?token=${token}`;
        console.log('Making API call to:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Verification failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Verification result:', result);
        
        if (result) {
          console.log('Verification successful, will redirect in 1 second');
          setTimeout(() => {
            console.log('Navigating to home page');
            navigate('/');
          }, 1000);
        } else {
          console.log('Verification returned false');
          setVerificationError('Verification failed');
          setIsVerifying(false);
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationError(error instanceof Error ? error.message : 'Failed to verify token');
        setIsVerifying(false);
      }
    };

    verify();
  }, [token, navigate]);

  console.log('Current state:', { token, verificationError, isVerifying });

  if (verificationError) {
    console.log('Rendering error state:', verificationError);
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

  console.log('Rendering loading state');
  return (
    <Box p={4}>
      <VStack spacing={4}>
        <Spinner size="xl" />
        <Text>{isVerifying ? 'Verifying your login...' : 'Login successful! Redirecting...'}</Text>
      </VStack>
    </Box>
  );
} 