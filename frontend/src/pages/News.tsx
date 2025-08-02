import React from 'react';
import { 
  Container, 
  Heading, 
  Text, 
  VStack, 
  HStack, 
  SimpleGrid, 
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider
} from '@chakra-ui/react';
import { getAllBlogPosts, getAllChangelogEntries, BlogPost, ChangelogEntry as ChangelogEntryType } from '../utils/content';
import { BlogCard } from '../components/BlogCard';
import { ChangelogEntry } from '../components/ChangelogEntry';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function News() {
  const [blogPosts, setBlogPosts] = React.useState<BlogPost[]>([]);
  const [changelogEntries, setChangelogEntries] = React.useState<ChangelogEntryType[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadContent() {
      try {
        const [posts, entries] = await Promise.all([
          getAllBlogPosts(),
          getAllChangelogEntries()
        ]);
        setBlogPosts(posts);
        setChangelogEntries(entries);
      } catch (error) {
        console.error('Error loading content:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadContent();
  }, []);

  if (loading) {
    return (
      <Box minH="100vh" display="flex" flexDirection="column">
        <AppHeader />
        <Container maxW="container.xl" py={8} flex="1">
          <VStack spacing={8} align="center" justify="center" h="full">
            <Text>Loading...</Text>
          </VStack>
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
              News, Changelogs, and Updates!
            </Heading>
            <Text fontSize="lg" color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              The Scripture Memory app is constantly being updated with new features, improvements, and bug fixes.
              Here you can find the latest news, changelogs, and updates. <a style={{ color: 'var(--chakra-colors-blue-500)', textDecoration: 'underline' }} href="https://mail.wpsteward.com/subscription?f=WX9MYpCEmxmKjfH5kyB5Luf892RDKti892dRIylFAknOdyQUHgvlyt9WdjIJUNbvR5Ns">Subscribe to our newsletter</a> to get notified when we release new features.
            </Text>
          </Box>

        <Tabs variant="enclosed" w="full">
          <TabList>
            <Tab>Blog Posts</Tab>
            <Tab>Changelog</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <VStack spacing={6} align="start">
                <Heading size="md" color="gray.700">
                  Latest Posts
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} w="full">
                  {blogPosts.map((post) => (
                    <BlogCard key={post.slug} post={post} />
                  ))}
                </SimpleGrid>
              </VStack>
            </TabPanel>

            <TabPanel>
              <VStack spacing={6} align="start">
                <Heading size="md" color="gray.700">
                  Recent Updates
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
                  {changelogEntries.map((entry) => (
                    <ChangelogEntry key={entry.version} entry={entry} />
                  ))}
                </SimpleGrid>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 