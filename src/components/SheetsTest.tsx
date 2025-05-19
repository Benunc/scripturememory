import React, { useEffect, useState } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';
import { testSheetsConnection } from '../utils/sheets';

export const SheetsTest: React.FC = () => {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    try {
      const result = await testSheetsConnection();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    }
  };

  return (
    <Box p={4}>
      <Button onClick={handleTest} colorScheme="blue" mb={4}>
        Test Google Sheets Connection
      </Button>
      
      {error && (
        <Text color="red.500" mb={4}>
          Error: {error}
        </Text>
      )}
      
      {data && (
        <Box>
          <Text fontWeight="bold" mb={2}>Data from Google Sheets:</Text>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </Box>
      )}
    </Box>
  );
}; 