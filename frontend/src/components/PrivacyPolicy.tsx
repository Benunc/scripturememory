import React from 'react';
import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react';
import { Footer } from './Footer';
import { AppHeader } from './AppHeader';

export const PrivacyPolicy: React.FC = () => {
  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl">Privacy Policy</Heading>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Information We Collect</Heading>
            <Text>
              We collect minimal information necessary to provide our service:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text>• Email address (for account creation and login)</Text>
              <Text>• Verses you choose to memorize</Text>
              <Text>• Your progress in memorizing verses</Text>
              <Text>• Points and streaks you earn</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>How We Use Your Information</Heading>
            <Text>
              Your information is used solely to provide and improve the Scripture Memory service:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text>• To maintain your account and progress</Text>
              <Text>• To track your memorization achievements</Text>
              <Text>• To improve our service based on usage patterns</Text>
              <Text>• To communicate important updates about the service</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Data Security</Heading>
            <Text>
              We take the security of your data seriously. All data is encrypted in transit and at rest. 
              We use industry-standard security measures to protect your information.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Third-Party Services</Heading>
            <Text>
              We use the following third-party services:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text>• Cloudflare (for hosting and security)</Text>
              <Text>• Google (for authentication)</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Your Rights</Heading>
            <Text>
              You have the right to:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text>• Access your personal data</Text>
              <Text>• Request deletion of your account and data</Text>
              <Text>• Opt out of non-essential communications</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4}>Contact</Heading>
            <Text>
              If you have any questions about this privacy policy or our data practices, 
              please contact us at ben@scripturememory.app
            </Text>
          </Box>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 