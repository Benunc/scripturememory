import React from 'react';
import { Box, Heading, Text, VStack, HStack, Badge, List, ListItem } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { ChangelogEntry as ChangelogEntryType } from '../utils/content';

interface ChangelogEntryProps {
  entry: ChangelogEntryType;
  variant?: 'default' | 'compact';
}

export function ChangelogEntry({ entry, variant = 'default' }: ChangelogEntryProps) {
  const isCompact = variant === 'compact';

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'major': return 'red';
      case 'minor': return 'orange';
      case 'patch': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Box
      as={Link}
      to={`/news/changelog/${entry.version}`}
      p={isCompact ? 4 : 6}
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
        <HStack justify="space-between" w="full">
          <Heading size={isCompact ? 'sm' : 'md'}>
            {entry.version}
          </Heading>
          <Badge colorScheme={getTypeColor(entry.type)} variant="subtle">
            {entry.type}
          </Badge>
        </HStack>

        <Text fontSize="sm" color="gray.500" _dark={{ color: 'whiteAlpha.600' }}>
          {new Date(entry.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </Text>

        {!isCompact && (
          <>
            {entry.features.length > 0 && (
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" fontWeight="medium" color="gray.700" _dark={{ color: 'whiteAlpha.900' }}>
                  New Features:
                </Text>
                <List spacing={1}>
                  {entry.features.map((feature, index) => (
                    <ListItem key={index} fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.800' }}>
                      • {feature}
                    </ListItem>
                  ))}
                </List>
              </VStack>
            )}

            {entry.fixes.length > 0 && (
              <VStack align="start" spacing={2}>
                <Text fontSize="sm" fontWeight="medium" color="gray.700" _dark={{ color: 'whiteAlpha.900' }}>
                  Bug Fixes:
                </Text>
                <List spacing={1}>
                  {entry.fixes.map((fix, index) => (
                    <ListItem key={index} fontSize="sm" color="gray.600" _dark={{ color: 'whiteAlpha.800' }}>
                      • {fix}
                    </ListItem>
                  ))}
                </List>
              </VStack>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
} 