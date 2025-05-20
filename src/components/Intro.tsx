import { Box, Button, Heading, Text, VStack, Link } from '@chakra-ui/react'
import { useState } from 'react'
import { PrivacyPolicy } from './PrivacyPolicy'

interface IntroProps {
  onLogin: () => void;
}

export const Intro = ({ onLogin }: IntroProps) => {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  if (showPrivacyPolicy) {
    return <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />;
  }

  return (
    <Box>
      <Box as="header">
        <Heading as="h1" size="xl">Scripture Memory</Heading>
      </Box>
      <Box as="main" p={8}>
        <VStack spacing={6} align="stretch" maxW="600px" mx="auto">
          <Text fontSize="lg">
            Welcome to Scripture Memory! This app helps you track your scripture memory progress.
          </Text>
          <Text>
            To get started, you'll need to sign in with your Google account to access your scripture memory spreadsheet.
          </Text>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={onLogin}
          >
            Sign in with Google
          </Button>
          <Text fontSize="sm" textAlign="center" mt={4}>
            By signing in, you agree to our{' '}
            <Link 
              color="blue.500" 
              textDecoration="underline" 
              onClick={() => setShowPrivacyPolicy(true)}
            >
              Privacy Policy
            </Link>
          </Text>
        </VStack>
      </Box>
    </Box>
  )
} 