import { Box, Text, Link } from '@chakra-ui/react';
import { ESV_COPYRIGHT } from '../utils/sampleVerses';

export const Footer: React.FC = () => {
  return (
    <Box 
      as="footer" 
      bg="gray.50"
      borderTop="1px"
      borderColor="gray.200"
      py={2}
      px={4}
      mt="auto"
    >
      <Text fontSize="xs" color="gray.600" textAlign="center">
        {ESV_COPYRIGHT}
      </Text>
      <Text fontSize="xs" color="gray.500" textAlign="center" mt={1}>
        <Link href="https://www.esv.org" isExternal color="blue.500">
          Learn more about the ESV Bible
        </Link>
      </Text>
    </Box>
  );
}; 