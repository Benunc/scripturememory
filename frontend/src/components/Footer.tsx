import React from 'react';
import { Box, Container, Text, VStack, HStack, Link, Divider } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

export const Footer = () => {
  return (
    <Box as="footer" py={8} borderTop="1px" borderColor="gray.200">
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          <HStack spacing={8} justify="center">
            <Link as={RouterLink} to="/about" color="blue.500" _hover={{ textDecoration: 'underline' }}>
              About Us
            </Link>
            <Link as={RouterLink} to="/privacy" color="blue.500" _hover={{ textDecoration: 'underline' }}>
              Privacy Policy
            </Link>
            <Link href="https://github.com/benmeredith/scripturememory" isExternal color="blue.500" _hover={{ textDecoration: 'underline' }}>
              GitHub
            </Link>
          </HStack>

          <Divider />

          <Text fontSize="sm" color="gray.600" textAlign="center">
            Sample/Starter verses are from the ESV translation, copyright 2001 by Crossway, a publishing ministry of Good News Publishers.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}; 