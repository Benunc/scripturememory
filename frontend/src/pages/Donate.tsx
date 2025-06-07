import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  Card,
  CardBody,
  Divider,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function Donate() {
  const navigate = useNavigate();

  const handleDonate = () => {
    const isProd = window.location.hostname === 'scripture.wpsteward.com';
    const stripeUrl = isProd 
      ? 'https://donate.stripe.com/fZu4gAdZUepr67t3yf8ww03'
      : 'https://donate.stripe.com/test_eVqdRa094gxz0N99WD8ww00';
    window.location.href = stripeUrl;
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Box textAlign="center">
            <Heading size="xl" mb={4}>Support Scripture Memory</Heading>
            <Text fontSize="lg" color="gray.600">
              Help us continue building tools for memorizing God's Word
            </Text>
          </Box>

          <Card>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="md" mb={2}>Why Support Us?</Heading>
                  <VStack align="start" spacing={2}>
                    <Text>✓ Keep the service free for everyone</Text>
                    <Text>✓ Cover hosting and development costs</Text>
                    <Text>✓ Fund new features and improvements</Text>
                    <Text>✓ Support ongoing maintenance</Text>
                  </VStack>
                </Box>

                <Divider />

                <Box textAlign="center">
                  <Heading size="md" mb={4}>Make a Donation</Heading>
                  <Text mb={4}>
                    Click below to make a donation. You can adjust the amount on the next page.
                  </Text>
                  <Button
                    onClick={handleDonate}
                    size="lg"
                    colorScheme="blue"
                    width="200px"
                  >
                    Donate Now
                  </Button>
                </Box>

                <Divider />

                <Box>
                  <Heading size="md" mb={2}>Other Ways to Support</Heading>
                  <Text mb={4}>
                    Can't donate right now? You can still help by:
                  </Text>
                  <VStack align="start" spacing={2}>
                    <Text>• Share Scripture Memory with others</Text>
                    <Text>• Provide feedback and suggestions</Text>
                    <Text>• Pray for the project</Text>
                  </VStack>
                </Box>
              </VStack>
            </CardBody>
          </Card>

          <Box textAlign="center">
            <Button variant="link" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </Box>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 