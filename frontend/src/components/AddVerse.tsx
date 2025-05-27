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
  Heading,
} from '@chakra-ui/react';
import { useAuth } from '../hooks/useAuth';
import { debug, handleError } from '../utils/debug';
import { Verse } from '../types';

interface AddVerseProps {
  onVerseAdded: (reference: string) => void;
  addVerse: (verse: Omit<Verse, 'lastReviewed'>) => Promise<void>;
}

export const AddVerse: React.FC<AddVerseProps> = ({ onVerseAdded, addVerse }) => {
  const [reference, setReference] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  const { userEmail } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    debug.log('verses', 'Form submission started');
    e.preventDefault();
    debug.log('verses', 'Default form submission prevented');
    
    if (!userEmail) {
      debug.log('verses', 'No user email found');
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
      debug.log('verses', 'Attempting to add verse:', { reference, text });
      await addVerse({ reference, text, status: 'not_started' });
      debug.log('verses', 'Verse added successfully');
      setReference('');
      setText('');
      onVerseAdded(reference);
      toast({
        title: 'Success',
        description: 'Your verse has been added successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      debug.error('verses', 'Error adding verse:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add verse. Please try again.';
      toast({
        title: 'Cannot Add Verse',
        description: errorMessage.includes('already exists') 
          ? 'This verse reference already exists. Please delete the existing verse first, then try adding it again.'
          : errorMessage,
        status: 'warning',
        duration: 8000,
        isClosable: true,
        position: 'top',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box 
      as="form" 
      onSubmit={handleSubmit} 
      p={4} 
      borderWidth={1} 
      borderRadius="lg"
      noValidate
    >
      <VStack spacing={4} align="stretch" role="form" aria-label="Add new verse form">
        <Heading size="md" textAlign="center" mb={2}>
          Add Your Own Verses Here!
        </Heading>
        <FormControl isRequired>
          <FormLabel htmlFor="reference">Verse Reference</FormLabel>
          <Input
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., John 3:16"
            aria-required="true"
            aria-describedby="reference-helper"
            required
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
            required
          />
          <FormHelperText id="text-helper">
            Enter the complete verse text
          </FormHelperText>
        </FormControl>

        <Button
          colorScheme="blue"
          type="submit"
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