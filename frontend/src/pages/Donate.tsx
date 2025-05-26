import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

const DONATION_AMOUNTS = [5, 10, 25, 50, 100];

export function Donate() {
  const navigate = useNavigate();
  const toast = useToast();

  const handleDonate = (amount: number) => {
    // TODO: Implement donation flow
    toast({
      title: 'Coming Soon',
      description: 'Donation functionality will be available soon!',
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <Container maxW="container.md" py={8}>
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

              <Box>
                <Heading size="md" mb={4}>Choose an Amount</Heading>
                <HStack spacing={4} wrap="wrap" justify="center">
                  {DONATION_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      onClick={() => handleDonate(amount)}
                      size="lg"
                      width="100px"
                    >
                      ${amount}
                    </Button>
                  ))}
                </HStack>
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

        <HStack justify="center" spacing={4}>
          <Button variant="link" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
} 