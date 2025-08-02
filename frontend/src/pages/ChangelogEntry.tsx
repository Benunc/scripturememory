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
  BreadcrumbLink,
  Badge,
  List,
  ListItem
} from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { getChangelogEntry } from '../utils/content';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function ChangelogEntryPage() {
  const { version } = useParams<{ version: string }>();
  const [entry, setEntry] = React.useState<any>(undefined);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadEntry() {
      if (!version) {
        setLoading(false);
        return;
      }
      
      try {
        const foundEntry = await getChangelogEntry(version);
        setEntry(foundEntry);
      } catch (error) {
        console.error('Error loading changelog entry:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadEntry();
  }, [version]);

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

  if (!entry) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.md" py={8} flex="1">
          <VStack spacing={6}>
            <Heading size="lg">
              Version Not Found
            </Heading>
            <Text color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              The changelog entry you're looking for doesn't exist.
            </Text>
            <Button as={Link} to="/news/changelog" colorScheme="blue">
              Back to Changelog
            </Button>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'major': return 'red';
      case 'minor': return 'orange';
      case 'patch': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
      <VStack spacing={8} align="start">
        {/* Breadcrumb */}
        <Breadcrumb 
          spacing="8px" 
          separator={<ChevronRightIcon color="gray.500" _dark={{ color: 'whiteAlpha.400' }} />}
          fontSize="sm"
        >
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/news" color="blue.500" _dark={{ color: 'blue.400' }}>
              News
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink as={Link} to="/news/changelog" color="blue.500" _dark={{ color: 'blue.400' }}>
              Changelog
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink color="gray.500" _dark={{ color: 'whiteAlpha.600' }}>
              {entry.version}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Version Header */}
        <Box w="full">
          <Heading size="xl" mb={4} color="gray.800" _dark={{ color: 'white' }}>
            {entry.version}
          </Heading>
          
          <HStack spacing={4} mb={4}>
            <Badge colorScheme={getTypeColor(entry.type)} variant="subtle" size="lg">
              {entry.type}
            </Badge>
            <Text fontSize="lg" color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              {new Date(entry.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </HStack>
        </Box>

        <Divider />

        {/* Features */}
        {entry.features.length > 0 && (
          <Box w="full">
            <Heading size="md" color="gray.700" _dark={{ color: 'white' }} mb={4}>
              New Features
            </Heading>
            <List spacing={3}>
              {entry.features.map((feature, index) => (
                <ListItem key={index} fontSize="lg" color="gray.700" _dark={{ color: 'whiteAlpha.900' }}>
                  • {feature}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Fixes */}
        {entry.fixes.length > 0 && (
          <Box w="full">
            <Heading size="md" color="gray.700" _dark={{ color: 'white' }} mb={4}>
              Bug Fixes
            </Heading>
            <List spacing={3}>
              {entry.fixes.map((fix, index) => (
                <ListItem key={index} fontSize="lg" color="gray.700" _dark={{ color: 'whiteAlpha.900' }}>
                  • {fix}
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {/* Content */}
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
            <ReactMarkdown>{entry.content}</ReactMarkdown>
          </Box>
        </Box>

        <Divider />

        {/* Footer */}
        <Box w="full">
          <VStack spacing={4} align="start">
            <Text fontSize="sm" color="gray.500" _dark={{ color: 'whiteAlpha.600' }}>
              Share this update:
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