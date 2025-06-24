# Groups Frontend Progress & Next Steps (as of 2024-06-09)

## ✅ Current Implementation
- **/groups page is live and isolated**: Not linked from the main app, accessible only via direct URL.
- **Authentication-aware**: Uses AuthContext; only signed-in users can access.
- **Displays user email**: For clarity and debugging.
- **Group creation access control**: Only users with 100+ points or 5+ verses mastered see the "Create New Group" button.
- **Create group modal**: UI for group creation, with validation.
- **Empty state**: Shows a message if the user isn't in any groups.
- **Join group section**: UI for entering an invitation link or code (not yet functional).
- **Chakra UI**: All UI uses Chakra components for consistency and accessibility.
- **Real group data**: Connected to backend `/api/groups/mine` endpoint.
- **Group cards**: Display group name, description, role, and member count with proper pluralization.
- **GroupDetails page**: New page at `/groups/:groupId` with tabs for Overview, Members, and Leaderboard.
- **Navigation**: "View Group" button navigates to group details page.
- **Backend endpoints**: All group-related endpoints implemented and tested.

## 🟦 Next Steps (Clear & Testable)
1. **Connect to Real Group Data**
   - Fetch and display the list of groups the user belongs to from the backend.
   - Show group cards for each group.
2. **Implement Group Creation**
   - Wire up the create group modal to actually create a group via the backend.
   - On success, show the new group in the list.
3. **Join Group by Invitation**
   - Implement the logic to join a group using an invitation link or code.
   - Show success/error feedback.
4. **Group Details Page**
   - Clicking "View Group" navigates to `/groups/:groupId`.
   - Show group info, leaderboard, and stats.
5. **Loading & Error States**
   - Add spinners and error messages for all async actions.
6. **Testing**
   - Manual: Test all flows with real and test users.
   - Automated: (Optional) Add Cypress or React Testing Library tests.

---

# Groups & Leaderboards Frontend Implementation Plan

## Overview

This document outlines the frontend implementation plan for the groups and leaderboards functionality using **Chakra UI**. The goal is to create an intuitive, engaging interface that encourages group participation and friendly competition while respecting user privacy.

## Design System - Chakra UI Integration

### Chakra UI Components We'll Use
- **Layout**: `Box`, `Flex`, `Grid`, `Stack`, `Container`
- **Typography**: `Text`, `Heading`, `Badge`
- **Forms**: `Input`, `Textarea`, `Button`, `FormControl`, `FormLabel`
- **Data Display**: `Table`, `TableContainer`, `Thead`, `Tbody`, `Tr`, `Th`, `Td`
- **Feedback**: `Alert`, `AlertDialog`, `Toast`, `Spinner`
- **Navigation**: `Tabs`, `TabList`, `TabPanels`, `Tab`, `TabPanel`
- **Overlay**: `Modal`, `Drawer`, `Popover`, `Tooltip`
- **Media**: `Avatar`, `Image`
- **Disclosure**: `Accordion`, `Collapse`

### Chakra UI Color Scheme
We'll use Chakra's built-in color system:
- **Primary**: `blue.500` - Group actions and highlights
- **Success**: `green.500` - Achievements and positive metrics  
- **Warning**: `orange.500` - Streaks and progress indicators
- **Gray**: `gray.500` - Secondary text and borders
- **Background**: `gray.50` - Light backgrounds
- **Surface**: `white` - Cards and containers

### Chakra UI Theme Customization
```typescript
// Extend the theme for groups-specific styling
const theme = extendTheme({
  colors: {
    group: {
      50: '#eff6ff',
      500: '#3b82f6',
      600: '#2563eb',
    }
  },
  components: {
    Card: {
      baseStyle: {
        container: {
          borderRadius: 'lg',
          boxShadow: 'sm',
          bg: 'white',
        }
      }
    }
  }
});
```

## Component Architecture with Chakra UI

### Core Components

#### 1. GroupCard
```typescript
import { Box, Card, CardBody, CardHeader, Heading, Text, Badge, Button, Flex, Avatar, Stack } from '@chakra-ui/react';

interface GroupCardProps {
  group: {
    id: number;
    name: string;
    description?: string;
    memberCount: number;
    userRole: 'creator' | 'leader' | 'member';
    lastActivity?: string;
  };
  onView: (groupId: number) => void;
  onManage?: (groupId: number) => void;
}

const GroupCard = ({ group, onView, onManage }: GroupCardProps) => (
  <Card>
    <CardHeader>
      <Flex justify="space-between" align="center">
        <Heading size="md">{group.name}</Heading>
        <Badge colorScheme={group.userRole === 'creator' ? 'purple' : group.userRole === 'leader' ? 'blue' : 'gray'}>
          {group.userRole}
        </Badge>
      </Flex>
    </CardHeader>
    <CardBody>
      <Stack spacing={3}>
        <Text color="gray.600">{group.description}</Text>
        <Flex justify="space-between" align="center">
          <Text fontSize="sm" color="gray.500">
            {group.memberCount} members
          </Text>
          <Button size="sm" colorScheme="blue" onClick={() => onView(group.id)}>
            View
          </Button>
        </Flex>
      </Stack>
    </CardBody>
  </Card>
);
```

#### 2. LeaderboardTable
```typescript
import { Table, Thead, Tbody, Tr, Th, Td, Badge, Flex, Select, Tabs, TabList, Tab } from '@chakra-ui/react';

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  metric: 'points' | 'verses_mastered' | 'current_streak' | 'longest_streak';
  timeframe: 'all' | 'week' | 'month' | 'year';
  currentUserId?: number;
  onMetricChange: (metric: string) => void;
  onTimeframeChange: (timeframe: string) => void;
}

const LeaderboardTable = ({ data, metric, timeframe, currentUserId, onMetricChange, onTimeframeChange }: LeaderboardTableProps) => (
  <Box>
    <Flex mb={4} gap={4}>
      <Tabs onChange={(index) => {
        const metrics = ['points', 'verses_mastered', 'current_streak', 'longest_streak'];
        onMetricChange(metrics[index]);
      }}>
        <TabList>
          <Tab>Points</Tab>
          <Tab>Verses</Tab>
          <Tab>Streaks</Tab>
        </TabList>
      </Tabs>
      <Select value={timeframe} onChange={(e) => onTimeframeChange(e.target.value)}>
        <option value="all">All Time</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
      </Select>
    </Flex>
    
    <TableContainer>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Rank</Th>
            <Th>Name</Th>
            <Th isNumeric>Points</Th>
            <Th isNumeric>Streak</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.map((entry, index) => (
            <Tr key={entry.user_id} bg={entry.user_id === currentUserId ? 'blue.50' : undefined}>
              <Td>
                <Flex align="center" gap={2}>
                  {index < 3 && (
                    <Badge colorScheme={index === 0 ? 'yellow' : index === 1 ? 'gray' : 'orange'}>
                      {index + 1}
                    </Badge>
                  )}
                  {index >= 3 && <Text>{index + 1}</Text>}
                </Flex>
              </Td>
              <Td>{entry.display_name}</Td>
              <Td isNumeric>{entry.points.toLocaleString()}</Td>
              <Td isNumeric>{entry.current_streak} days</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  </Box>
);
```

#### 3. GroupStats
```typescript
import { SimpleGrid, Stat, StatLabel, StatNumber, StatHelpText, Box, Avatar, Text } from '@chakra-ui/react';

interface GroupStatsProps {
  stats: {
    total_members: number;
    active_members: number;
    total_points: number;
    total_verses_mastered: number;
    average_points_per_member: number;
    top_performer: TopPerformer;
    recent_activity: RecentActivity;
  };
}

const GroupStats = ({ stats }: GroupStatsProps) => (
  <Box>
    <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
      <Stat>
        <StatLabel>Total Members</StatLabel>
        <StatNumber>{stats.total_members}</StatNumber>
        <StatHelpText>{stats.active_members} active</StatHelpText>
      </Stat>
      
      <Stat>
        <StatLabel>Total Points</StatLabel>
        <StatNumber>{stats.total_points.toLocaleString()}</StatNumber>
        <StatHelpText>Group achievement</StatHelpText>
      </Stat>
      
      <Stat>
        <StatLabel>Verses Mastered</StatLabel>
        <StatNumber>{stats.total_verses_mastered}</StatNumber>
        <StatHelpText>Collective progress</StatHelpText>
      </Stat>
      
      <Stat>
        <StatLabel>Avg Points/Member</StatLabel>
        <StatNumber>{stats.average_points_per_member}</StatNumber>
        <StatHelpText>Group average</StatHelpText>
      </Stat>
    </SimpleGrid>
    
    {stats.top_performer && (
      <Box mt={6} p={4} bg="blue.50" borderRadius="lg">
        <Text fontWeight="bold" mb={2}>Top Performer</Text>
        <Flex align="center" gap={3}>
          <Avatar size="sm" name={stats.top_performer.display_name} />
          <Box>
            <Text fontWeight="medium">{stats.top_performer.display_name}</Text>
            <Text fontSize="sm" color="gray.600">{stats.top_performer.points} points</Text>
          </Box>
        </Flex>
      </Box>
    )}
  </Box>
);
```

#### 4. MemberProfile
```typescript
import { Box, Avatar, Text, Switch, FormControl, FormLabel, Input, Button, VStack, HStack } from '@chakra-ui/react';

interface MemberProfileProps {
  profile: {
    user_id: number;
    display_name: string;
    email: string;
    role: string;
    joined_at: string;
    is_public: boolean;
  };
  ranking?: MemberRanking;
  canEdit: boolean;
  onUpdateProfile: (updates: ProfileUpdates) => void;
}

const MemberProfile = ({ profile, ranking, canEdit, onUpdateProfile }: MemberProfileProps) => (
  <Box p={6} bg="white" borderRadius="lg" boxShadow="sm">
    <VStack spacing={4} align="stretch">
      <HStack>
        <Avatar size="lg" name={profile.display_name} />
        <Box>
          <Text fontWeight="bold" fontSize="lg">{profile.display_name}</Text>
          <Text color="gray.600">{profile.email}</Text>
          <Badge colorScheme="blue">{profile.role}</Badge>
        </Box>
      </HStack>
      
      {canEdit && (
        <FormControl>
          <FormLabel>Display Name</FormLabel>
          <Input 
            value={profile.display_name}
            onChange={(e) => onUpdateProfile({ display_name: e.target.value })}
          />
        </FormControl>
      )}
      
      <FormControl display="flex" alignItems="center">
        <FormLabel htmlFor="privacy-toggle" mb="0">
          Public Profile
        </FormLabel>
        <Switch 
          id="privacy-toggle"
          isChecked={profile.is_public}
          onChange={(e) => onUpdateProfile({ is_public: e.target.checked })}
          isDisabled={!canEdit}
        />
      </FormControl>
      
      {ranking && (
        <Box p={4} bg="gray.50" borderRadius="md">
          <Text fontWeight="bold">Ranking</Text>
          <Text>Rank #{ranking.rank} of {ranking.total_members}</Text>
          <Text>Top {ranking.percentile}%</Text>
        </Box>
      )}
    </VStack>
  </Box>
);
```

### Page Components with Chakra UI

#### 1. GroupsListPage
```typescript
import { Container, Heading, Button, SimpleGrid, Box, Text, VStack } from '@chakra-ui/react';
import { AddIcon } from '@chakra-ui/icons';

const GroupsListPage = () => (
  <Container maxW="container.xl" py={8}>
    <Box mb={6}>
      <Flex justify="space-between" align="center">
        <Heading>My Groups</Heading>
        <Button leftIcon={<AddIcon />} colorScheme="blue">
          Create Group
        </Button>
      </Flex>
    </Box>
    
    {groups.length === 0 ? (
      <VStack spacing={4} py={12}>
        <Text fontSize="lg" color="gray.600">You haven't joined any groups yet</Text>
        <Text color="gray.500">Create a group to start memorizing with friends!</Text>
        <Button colorScheme="blue">Create Your First Group</Button>
      </VStack>
    ) : (
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {groups.map(group => (
          <GroupCard key={group.id} group={group} onView={handleViewGroup} />
        ))}
      </SimpleGrid>
    )}
  </Container>
);
```

#### 2. GroupDetailsPage
```typescript
import { Container, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Box } from '@chakra-ui/react';

const GroupDetailsPage = () => (
  <Container maxW="container.xl" py={8}>
    <Heading mb={6}>{group.name}</Heading>
    
    <Tabs>
      <TabList>
        <Tab>Overview</Tab>
        <Tab>Leaderboard</Tab>
        <Tab>Members</Tab>
        <Tab>Settings</Tab>
      </TabList>
      
      <TabPanels>
        <TabPanel>
          <GroupStats stats={groupStats} />
        </TabPanel>
        
        <TabPanel>
          <LeaderboardTable 
            data={leaderboard}
            metric={currentMetric}
            timeframe={currentTimeframe}
            currentUserId={currentUser.id}
            onMetricChange={setCurrentMetric}
            onTimeframeChange={setCurrentTimeframe}
          />
        </TabPanel>
        
        <TabPanel>
          <GroupMembers members={members} />
        </TabPanel>
        
        <TabPanel>
          <GroupSettings group={group} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Container>
);
```

#### 3. CreateGroupPage
```typescript
import { Container, VStack, FormControl, FormLabel, Input, Textarea, Button, Heading } from '@chakra-ui/react';

const CreateGroupPage = () => (
  <Container maxW="container.md" py={8}>
    <VStack spacing={6} align="stretch">
      <Heading>Create New Group</Heading>
      
      <FormControl isRequired>
        <FormLabel>Group Name</FormLabel>
        <Input 
          placeholder="Enter group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
      </FormControl>
      
      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea 
          placeholder="Tell others about your group (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormControl>
      
      <Button colorScheme="blue" size="lg" onClick={handleCreateGroup}>
        Create Group
      </Button>
    </VStack>
  </Container>
);
```

## Responsive Design with Chakra UI

### Chakra UI Responsive Props
```typescript
// Responsive grid columns
<SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>

// Responsive spacing
<Box p={{ base: 4, md: 6, lg: 8 }}>

// Responsive text sizes
<Heading size={{ base: "md", md: "lg", lg: "xl" }}>

// Responsive container widths
<Container maxW={{ base: "container.sm", md: "container.md", lg: "container.xl" }}>
```

### Mobile-First Breakpoints
Chakra UI uses these default breakpoints:
- `base`: 0px (mobile)
- `sm`: 480px (large mobile)
- `md`: 768px (tablet)
- `lg`: 992px (desktop)
- `xl`: 1280px (large desktop)
- `2xl`: 1536px (extra large)

## State Management with Chakra UI

### Toast Notifications
```typescript
import { useToast } from '@chakra-ui/react';

const GroupsContext = () => {
  const toast = useToast();
  
  const createGroup = async (data: CreateGroupData) => {
    try {
      await GroupsAPI.createGroup(data);
      toast({
        title: "Group created!",
        description: "Your group has been created successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };
};
```

### Loading States
```typescript
import { Spinner, Skeleton, SkeletonText } from '@chakra-ui/react';

const GroupCard = ({ group, loading }: GroupCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton height="20px" width="60%" />
        </CardHeader>
        <CardBody>
          <SkeletonText mt="4" noOfLines={3} spacing="4" />
        </CardBody>
      </Card>
    );
  }
  
  // ... rest of component
};
```

## Accessibility with Chakra UI

### Built-in Accessibility Features
- **ARIA Labels**: Automatically provided by Chakra components
- **Keyboard Navigation**: Built into interactive components
- **Focus Management**: Proper focus handling in modals and forms
- **Color Contrast**: Follows WCAG guidelines
- **Screen Reader Support**: Semantic HTML and proper labeling

### Custom Accessibility Enhancements
```typescript
// Add custom ARIA labels
<Button aria-label="Create new group">
  <AddIcon />
</Button>

// Provide descriptions for complex components
<Box role="region" aria-label="Group leaderboard">
  <LeaderboardTable data={data} />
</Box>
```

## Performance with Chakra UI

### Chakra UI Optimizations
- **CSS-in-JS**: Efficient styling with emotion
- **Component Composition**: Reusable component patterns
- **Theme System**: Consistent design tokens
- **Bundle Size**: Tree-shakeable components

### Custom Optimizations
```typescript
// Memoize expensive components
const GroupCard = React.memo(({ group, onView }: GroupCardProps) => {
  // Component implementation
});

// Lazy load components
const GroupSettings = React.lazy(() => import('./GroupSettings'));

// Use Chakra's built-in loading states
const { data, isLoading } = useQuery(['groups'], fetchGroups);
```

## Implementation Phases (Updated for Chakra UI)

### Phase 1: Core Groups (Week 1-2)
- [ ] Set up Chakra UI theme extensions for groups
- [ ] Create GroupsContext with Chakra toast notifications
- [ ] Build GroupCard component with Chakra Card
- [ ] Implement GroupsListPage with responsive grid
- [ ] Create CreateGroupPage with Chakra forms

### Phase 2: Member Management (Week 3)
- [ ] Build MemberProfile component with Chakra Avatar and forms
- [ ] Create GroupMembersPage with Chakra Table
- [ ] Implement invite member modal with Chakra Modal
- [ ] Add role management with Chakra Badge components

### Phase 3: Leaderboards (Week 4-5)
- [ ] Build LeaderboardTable with Chakra Table and Tabs
- [ ] Create GroupStats component with Chakra Stat components
- [ ] Implement metric switching with Chakra Tabs
- [ ] Add timeframe filtering with Chakra Select

### Phase 4: Privacy & Polish (Week 6)
- [ ] Implement privacy settings with Chakra Switch
- [ ] Add display name editing with Chakra Input
- [ ] Create responsive layouts for all screen sizes
- [ ] Add loading states and error handling

### Phase 5: Testing & Optimization (Week 7)
- [ ] Test all Chakra UI components for accessibility
- [ ] Optimize bundle size and performance
- [ ] Cross-browser testing with Chakra components
- [ ] User acceptance testing and feedback

---

This updated plan leverages Chakra UI's powerful component library and design system, making development faster and more consistent while maintaining excellent accessibility and performance. 