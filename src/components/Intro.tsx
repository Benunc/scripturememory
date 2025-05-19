import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react'

interface IntroProps {
  onLogin: () => void;
}

export const Intro = ({ onLogin }: IntroProps) => {
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
        </VStack>
      </Box>
    </Box>
  )
} 