import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { addVerse } from '../utils/sheets';

export const AddVerse: React.FC = () => {
  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await addVerse(reference, text);
      setReference('');
      setText('');
      toast({
        title: 'Verse added',
        description: 'Your verse has been added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error adding verse:', error);
      toast({
        title: 'Error',
        description: 'Failed to add verse. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box as="form" onSubmit={handleSubmit} p={4} borderWidth={1} borderRadius="lg">
      <VStack spacing={4}>
        <FormControl isRequired>
          <FormLabel>Reference</FormLabel>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., John 3:16"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>Verse Text</FormLabel>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the verse text..."
            rows={4}
          />
        </FormControl>
        <Button
          type="submit"
          colorScheme="blue"
          isLoading={isSubmitting}
          loadingText="Adding..."
          width="full"
        >
          Add Verse
        </Button>
      </VStack>
    </Box>
  );
}; 