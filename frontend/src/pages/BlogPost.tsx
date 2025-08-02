import React from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { 
  Container, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  Box,
  Button,
  Divider,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink
} from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { getBlogPost, BlogPost } from '../utils/content';
import { AuthorMeta } from '../components/AuthorMeta';
import { TagList } from '../components/TagList';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = React.useState<BlogPost | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadPost() {
      if (!slug) return;
      
      try {
        const foundPost = await getBlogPost(slug);
        setPost(foundPost);
      } catch (error) {
        console.error('Error loading blog post:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.md" py={8} flex="1">
          <VStack spacing={6} align="center" justify="center" h="full">
            <Text>Loading...</Text>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  if (!post) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.md" py={8} flex="1">
          <VStack spacing={6}>
            <Heading size="lg">
              Post Not Found
            </Heading>
            <Text color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              The blog post you're looking for doesn't exist.
            </Text>
            <Button as={Link} to="/news" colorScheme="blue">
              Back to News
            </Button>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
      <VStack spacing={8} align="start">
        {/* Breadcrumb */}
        <Breadcrumb 
          spacing="8px" 
          separator={<ChevronRightIcon color="gray.500" />}
          fontSize="sm"
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/news" color="blue.500">
              News
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/news/blog" color="blue.500">
              Blog
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink color="gray.500">
              {post.title}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Article Header */}
        <Box w="full">
          <Heading size="xl" mb={4} color="gray.800" _dark={{ color: 'white' }}>
            {post.title}
          </Heading>
          
          <VStack align="center" spacing={4}>
            <AuthorMeta 
              author={post.author} 
              date={post.date} 
              readingTime={post.readingTime}
            />
            
           {/* <TagList align="center" tags={post.tags} /> */}
          </VStack>
        </Box>

        <Divider />

        {/* Article Content */}
        <Box w="full">
          <Box
            fontSize="lg" 
            color="gray.700" 
            _dark={{ color: 'whiteAlpha.900' }}
            lineHeight="tall"
            textAlign="left"
            sx={{
              'h1': {
                fontSize: '3xl',
                fontWeight: 'bold',
                mt: 8,
                mb: 6,
                color: 'gray.800',
                _dark: { color: 'white' }
              },
              'h2': {
                fontSize: '2xl',
                fontWeight: 'semibold',
                mt: 6,
                mb: 4,
                color: 'gray.800',
                _dark: { color: 'white' }
              },
              'h3': {
                fontSize: 'xl',
                fontWeight: 'semibold',
                mt: 5,
                mb: 3,
                color: 'gray.800',
                _dark: { color: 'white' }
              },
              'p': {
                mb: 4,
                lineHeight: 'tall',
                color: 'gray.700',
                _dark: { color: 'whiteAlpha.900' }
              },
              'ul, ol': {
                mb: 4,
                pl: 6,
                color: 'gray.700',
                _dark: { color: 'whiteAlpha.900' }
              },
              'li': {
                mb: 1,
                color: 'gray.700',
                _dark: { color: 'whiteAlpha.900' }
              },
              'blockquote': {
                borderLeft: '4px solid',
                borderColor: 'blue.500',
                pl: 4,
                py: 2,
                my: 4,
                bg: 'blue.50',
                color: 'gray.700',
                _dark: {
                  bg: 'blue.900',
                  borderColor: 'blue.400',
                  color: 'whiteAlpha.900'
                }
              },
              'a': {
                color: 'blue.500',
                textDecoration: 'underline',
                _hover: {
                  color: 'blue.600',
                  textDecoration: 'none'
                },
                _dark: {
                  color: 'blue.400',
                  _hover: {
                    color: 'blue.300'
                  }
                }
              }
            }}
          >
            <ReactMarkdown>{post.content}</ReactMarkdown>
          </Box>
        </Box>

        <Divider />

        {/* Article Footer */}
        <Box w="full">
          <VStack spacing={4} align="start">
            <Text fontSize="sm" color="gray.500">
              Share this post:
            </Text>
            <HStack spacing={4}>
              <Button size="sm" variant="outline" colorScheme="blue">
                Twitter
              </Button>
              <Button size="sm" variant="outline" colorScheme="blue">
                Facebook
              </Button>
              <Button size="sm" variant="outline" colorScheme="blue">
                Email
              </Button>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Container>
    <Footer />
  </Box>
  );
} 