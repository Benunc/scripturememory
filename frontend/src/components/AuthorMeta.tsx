import React from 'react';
import { HStack, Avatar, Text, VStack } from '@chakra-ui/react';

interface AuthorMetaProps {
  author: string;
  date: string;
  readingTime?: number;
  showAvatar?: boolean;
}

export function AuthorMeta({ author, date, readingTime, showAvatar = true }: AuthorMetaProps) {
  return (
    <HStack spacing={3} align="center">
      {showAvatar && (
        <Avatar 
          size="sm" 
          name={author}
          bg="blue.500"
          color="white"
        />
      )}
      <VStack align="start" spacing={0}>
        <Text fontSize="sm" fontWeight="medium" color="gray.700" _dark={{ color: 'whiteAlpha.900' }}>
          {author}
        </Text>
        <HStack spacing={2}>
          <Text fontSize="xs" color="gray.500" _dark={{ color: 'whiteAlpha.600' }}>
            {new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
          {readingTime && (
            <>
              <Text fontSize="xs" color="gray.400" _dark={{ color: 'whiteAlpha.400' }}>•</Text>
              <Text fontSize="xs" color="gray.500" _dark={{ color: 'whiteAlpha.600' }}>
                {readingTime} min read
              </Text>
            </>
          )}
        </HStack>
      </VStack>
    </HStack>
  );
} 