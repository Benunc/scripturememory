import React from 'react';
import { Box, Heading, Text, VStack, HStack, Badge } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { BlogPost } from '../utils/content';
import { AuthorMeta } from './AuthorMeta';
import { TagList } from './TagList';

interface BlogCardProps {
  post: BlogPost;
  variant?: 'default' | 'featured';
}

export function BlogCard({ post, variant = 'default' }: BlogCardProps) {
  const isFeatured = variant === 'featured';

  return (
    <Box
      as={Link}
      to={`/news/blog/${post.slug}`}
      p={6}
      border="1px"
      borderColor="gray.200"
      borderRadius="lg"
      bg="white"
      _dark={{
        borderColor: 'whiteAlpha.200',
        bg: 'gray.800',
      }}
      _hover={{
        borderColor: 'blue.300',
        _dark: {
          borderColor: 'blue.400',
        },
        boxShadow: 'md',
        transform: 'translateY(-2px)',
        transition: 'all 0.2s'
      }}
      transition="all 0.2s"
    >
      <VStack align="start" spacing={4}>
        {isFeatured && (
          <Badge colorScheme="blue" variant="subtle">
            Featured
          </Badge>
        )}
        
        <VStack align="start" spacing={2}>
          <Heading 
            size={isFeatured ? 'md' : 'sm'} 
            lineHeight="tight"
          >
            {post.title}
          </Heading>
          
          <Text 
            fontSize="sm"
            noOfLines={3}
            lineHeight="tall"
            color="gray.600"
            _dark={{
              color: 'whiteAlpha.800',
            }}
          >
            {post.excerpt}
          </Text>
        </VStack>

        <VStack align="start" spacing={3} w="full">
          <AuthorMeta 
            author={post.author} 
            date={post.date} 
            readingTime={post.readingTime}
          />
          
          <TagList tags={post.tags} />
        </VStack>
      </VStack>
    </Box>
  );
} 