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
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';

interface AddVerseProps {
  onVerseAdded: () => void;
}

export const AddVerse: React.FC<AddVerseProps> = ({ onVerseAdded }) => {
  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const { userEmail } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) {
      toast({
        title: 'Error',
        description: 'You must be signed in to add verses',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addVerse(userEmail, { reference, text, status: 'not_started' });
      setReference('');
      setText('');
      onVerseAdded();
      toast({
        title: 'Verse added',
        description: 'Your verse has been added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      debug.error('verses', 'Error adding verse:', error);
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