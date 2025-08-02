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
import { getAllChangelogEntries, ChangelogEntry as ChangelogEntryType } from '../utils/content';
import { ChangelogEntry } from '../components/ChangelogEntry';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';

export function Changelog() {
  const [changelogEntries, setChangelogEntries] = useState<ChangelogEntryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      try {
        const entries = await getAllChangelogEntries();
        setChangelogEntries(entries);
      } catch (error) {
        console.error('Error loading changelog entries:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
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
              Changelog
            </Heading>
            <Text fontSize="lg" color="gray.600" _dark={{ color: 'whiteAlpha.700' }}>
              Track the latest updates, features, and improvements to Scripture Memory.
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full">
            {changelogEntries.map((entry) => (
              <ChangelogEntry key={entry.version} entry={entry} />
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
} 