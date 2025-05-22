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
  FormHelperText,
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
      <VStack spacing={4} align="stretch" role="form" aria-label="Add new verse form">
        <FormControl isRequired>
          <FormLabel htmlFor="reference">Verse Reference</FormLabel>
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., John 3:16"
            aria-required="true"
            aria-describedby="reference-helper"
          />
          <FormHelperText id="reference-helper">
            Enter the verse reference in the format "Book Chapter:Verse"
          </FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel htmlFor="text">Verse Text</FormLabel>
          <Textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the verse text..."
            aria-required="true"
            aria-describedby="text-helper"
          />
          <FormHelperText id="text-helper">
            Enter the complete verse text
          </FormHelperText>
        </FormControl>

        <Button
          colorScheme="blue"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          loadingText="Adding..."
          isDisabled={!reference || !text}
          aria-label="Add new verse"
        >
          Add Verse
        </Button>
      </VStack>
    </Box>
  );
}; 