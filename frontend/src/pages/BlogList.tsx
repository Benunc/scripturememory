import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Heading, 
  Text, 
  VStack, 
  SimpleGrid,
  Box,
  Spinner,
  Center
} from '@chakra-ui/react';
import { getAllBlogPosts, BlogPost } from '../utils/content';
import { BlogCard } from '../components/BlogCard';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function BlogList() {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const posts = await getAllBlogPosts();
        setBlogPosts(posts);
      } catch (error) {
        console.error('Error loading blog posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  if (loading) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.xl" py={8} flex="1">
          <Center>
            <Spinner size="xl" />
          </Center>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.xl" py={8} flex="1">
        <VStack spacing={8} align="center">
          <Box>
            <Heading size="xl" mb={2}>
              Blog
            </Heading>
            <Text fontSize="lg" color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              Latest news, updates, and insights from the Scripture Memory App.
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} w="full">
            {blogPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 