import React from 'react';
import { HStack, Tag, TagLabel } from '@chakra-ui/react';

interface TagListProps {
  tags: string[];
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: string;
}

export function TagList({ tags, size = 'sm', colorScheme = 'blue' }: TagListProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <HStack spacing={2} wrap="wrap">
      {tags.map((tag) => (
        <Tag
          key={tag}
          size={size}
          colorScheme={colorScheme}
          variant="subtle"
          borderRadius="full"
        >
          <TagLabel>{tag}</TagLabel>
        </Tag>
      ))}
    </HStack>
  );
} 