import { Box, Heading, Text, VStack, Link } from '@chakra-ui/react'
import { useState, useEffect } from 'react'

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy = ({ onBack }: PrivacyPolicyProps) => {
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Obfuscated email parts
    const parts = [
      'ben',
      '@',
      'benandjacq',
      '.',
      'com'
    ];
    setEmail(parts.join(''));
  }, []);

  return (
    <Box>
      <Box as="header">
        <Heading as="h1" size="xl">Scripture Memory</Heading>
      </Box>
      <Box as="main" p={8}>
        <VStack spacing={6} align="stretch" maxW="800px" mx="auto">
          <Link onClick={onBack} color="blue.500" textDecoration="underline">
            ← Back to Home
          </Link>
          
          <Heading as="h2" size="lg">Privacy Policy</Heading>
          
          <Text>
            Last updated: {new Date().toLocaleDateString()}
          </Text>

          <VStack align="stretch" spacing={4}>
            <Box>
              <Heading as="h3" size="md" mb={2}>Information We Collect</Heading>
              <Text>
                Scripture Memory collects and stores the following information:
              </Text>
              <Box pl={4} mt={2}>
                <Text>• Your Google account email address</Text>
                <Text>• Scripture verses you choose to memorize</Text>
                <Text>• Your progress in memorizing these verses</Text>
              </Box>
            </Box>

            <Box>
              <Heading as="h3" size="md" mb={2}>How We Use Your Information</Heading>
              <Text>
                We use your information solely to:
              </Text>
              <Box pl={4} mt={2}>
                <Text>• Provide you with access to your personal scripture memory list</Text>
                <Text>• Track your progress in memorizing verses</Text>
                <Text>• Store your verses in your personal Google Sheet</Text>
              </Box>
            </Box>

            <Box>
              <Heading as="h3" size="md" mb={2}>Data Storage</Heading>
              <Text>
                Your data is stored in a Google Sheet that is:
              </Text>
              <Box pl={4} mt={2}>
                <Text>• Accessible only to you and the administrator</Text>
                <Text>• Protected by Google's security measures</Text>
                <Text>• Stored in your own personal tab within the sheet</Text>
              </Box>
            </Box>

            <Box>
              <Heading as="h3" size="md" mb={2}>Third-Party Services</Heading>
              <Text>
                We use the following third-party services:
              </Text>
              <Box pl={4} mt={2}>
                <Text>• Google OAuth for authentication</Text>
                <Text>• Google Sheets API for data storage</Text>
              </Box>
            </Box>

            <Box>
              <Heading as="h3" size="md" mb={2}>Your Rights</Heading>
              <Text>
                You have the right to:
              </Text>
              <Box pl={4} mt={2}>
                <Text>• Access your data at any time</Text>
                <Text>• Request deletion of your data</Text>
                <Text>• Export your data from your Google Sheet</Text>
              </Box>
            </Box>

            <Box>
              <Heading as="h3" size="md" mb={2}>Contact</Heading>
              <Text>
                If you have any questions about this privacy policy, please contact:
              </Text>
              <Text mt={2}>
                Ben Meredith<br />
                <Link 
                  href={`mailto:${email}`}
                  color="blue.500"
                  textDecoration="underline"
                >
                  {email}
                </Link>
              </Text>
            </Box>
          </VStack>
        </VStack>
      </Box>
    </Box>
  )
} 