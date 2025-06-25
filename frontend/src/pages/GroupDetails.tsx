import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  Link,
  FormControl,
  FormLabel,
  Input,
  FormHelperText,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Textarea,
} from '@chakra-ui/react';
import { ArrowBackIcon, ExternalLinkIcon, CopyIcon } from '@chakra-ui/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { getApiUrl } from '../utils/api';

interface GroupMember {
  user_id: number;
  member_email: string;
  display_name: string;
  role: string;
  joined_at: string;
}

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
  verses_mastered: number;
  current_streak: number;
  longest_streak: number;
  is_public: boolean;
}

interface GroupStats {
  total_members: number;
  active_members: number;
  total_points: number;
  total_verses_mastered: number;
  average_points_per_member: number;
  top_performer: {
    user_id: number;
    display_name: string;
    points: number;
  };
  recent_activity: {
    new_members_this_week: number;
    verses_mastered_this_week: number;
    points_earned_this_week: number;
  };
}

const GroupDetails: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthContext();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [groupDescription, setGroupDescription] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token || !groupId) {
      navigate('/groups');
      return;
    }

    const loadGroupData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load group info from user's groups list
        const groupsResponse = await fetch(`${getApiUrl()}/groups/mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          const currentGroup = groupsData.groups.find((g: any) => g.id === parseInt(groupId));
          
          if (currentGroup) {
            setGroupName(currentGroup.name);
            setGroupDescription(currentGroup.description || '');
            setUserRole(currentGroup.role);
          } else {
            setError('Group not found or you are not a member');
            return;
          }
        }

        // Load members
        const membersResponse = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }

        // Load leaderboard
        const leaderboardResponse = await fetch(`${getApiUrl()}/groups/${groupId}/leaderboard?metric=points`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (leaderboardResponse.ok) {
          const leaderboardData = await leaderboardResponse.json();
          setLeaderboard(leaderboardData.leaderboard || []);
        }

        // Load stats
        const statsResponse = await fetch(`${getApiUrl()}/groups/${groupId}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.stats);
        }

      } catch (error) {
        setError('Failed to load group data');
        console.error('Error loading group data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGroupData();
  }, [isAuthenticated, token, groupId, navigate]);

  const handleInviteMember = async () => {
    if (!isAuthenticated || !token || !groupId || !inviteEmail.trim()) return;
    
    try {
      setInviting(true);
      setInviteError(null);
      setInviteSuccess(null);
      setInvitationCode(null);
      
      // First, check if an invitation already exists for this email
      const existingResponse = await fetch(`${getApiUrl()}/groups/${groupId}/invitations/existing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim() })
      });

      if (existingResponse.ok) {
        // An invitation already exists, show it
        const existingData = await existingResponse.json();
        setInvitationCode(existingData.invitation.code);
        setInviteSuccess(`An invitation already exists for ${inviteEmail}`);
        setInviteEmail('');
        return;
      }

      // No existing invitation, create a new one
      const response = await fetch(`${getApiUrl()}/groups/${groupId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim() })
      });

      if (response.ok) {
        const result = await response.json();
        setInvitationCode(result.invitation.code);
        setInviteSuccess(`Invitation created for ${inviteEmail}`);
        setInviteEmail('');
      } else {
        const error = await response.json();
        setInviteError(error.error || 'Failed to create invitation');
      }
    } catch (error) {
      setInviteError('Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const copyInvitationCode = async () => {
    if (invitationCode) {
      try {
        await navigator.clipboard.writeText(invitationCode);
        toast({
          title: 'Code copied!',
          description: 'Invitation code copied to clipboard',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Copy failed',
          description: 'Failed to copy code to clipboard',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center>
          <Spinner size="xl" />
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
        <Button mt={4} leftIcon={<ArrowBackIcon />} onClick={() => navigate('/groups')}>
          Back to Groups
        </Button>
      </Container>
    );
  }

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />

      <Box id="main-content" flex="1" p={8} tabIndex={-1}>
        <Container maxW="container.xl" px={{ base: 1, md: 1 }}>
          <VStack spacing={6} align="stretch">
            {/* Header */}
            <HStack justify="space-between" align="start" wrap="wrap" gap={4}>
              <VStack align="start" spacing={2} flex="1" minW="0">
                <Button 
                  leftIcon={<ArrowBackIcon />} 
                  variant="ghost" 
                  onClick={() => navigate('/groups')}
                  size={{ base: "sm", md: "md" }}
                >
                  Back to Groups
                </Button>
                <Heading size="lg" fontSize={{ base: "xl", md: "2xl" }}>{groupName}</Heading>
                {groupDescription && (
                  <Text color="gray.600" fontSize={{ base: "sm", md: "md" }} noOfLines={2}>
                    {groupDescription}
                  </Text>
                )}
                <HStack wrap="wrap" gap={2}>
                  <Badge 
                    colorScheme={
                      userRole === 'creator' ? 'purple' : 
                      userRole === 'leader' ? 'blue' : 'gray'
                    }
                    fontSize="xs"
                  >
                    {userRole}
                  </Badge>
                  <Text fontSize="sm" color="gray.500">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </Text>
                </HStack>
              </VStack>
            </HStack>

            {/* Tabs */}
            <Tabs index={activeTab} onChange={setActiveTab}>
              <TabList overflowX="auto" css={{
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <Tab whiteSpace="nowrap">Overview</Tab>
                <Tab whiteSpace="nowrap">Members</Tab>
                <Tab whiteSpace="nowrap">Leaderboard</Tab>
                {(userRole === 'creator' || userRole === 'leader') && (
                  <Tab whiteSpace="nowrap">Invite Members</Tab>
                )}
              </TabList>

              <TabPanels>
                {/* Overview Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  {stats && (
                    <VStack spacing={6} align="stretch">
                      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: 3, md: 6 }}>
                        <Stat>
                          <StatLabel fontSize={{ base: "xs", md: "sm" }}>Total Members</StatLabel>
                          <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.total_members}</StatNumber>
                          <StatHelpText fontSize="xs">Active: {stats.active_members}</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel fontSize={{ base: "xs", md: "sm" }}>Total Points</StatLabel>
                          <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.total_points.toLocaleString()}</StatNumber>
                          <StatHelpText fontSize="xs">Group total</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel fontSize={{ base: "xs", md: "sm" }}>Verses Mastered</StatLabel>
                          <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.total_verses_mastered}</StatNumber>
                          <StatHelpText fontSize="xs">Group total</StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel fontSize={{ base: "xs", md: "sm" }}>Avg Points/Member</StatLabel>
                          <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.average_points_per_member}</StatNumber>
                          <StatHelpText fontSize="xs">Active members only</StatHelpText>
                        </Stat>
                      </SimpleGrid>

                      <Divider />

                      <Box>
                        <Heading size="md" mb={4} fontSize={{ base: "lg", md: "xl" }}>Top Performer</Heading>
                        <Card>
                          <CardBody>
                            <HStack justify="space-between">
                              <VStack align="start" spacing={1}>
                                <Text fontWeight="bold" fontSize={{ base: "md", md: "lg" }}>{stats.top_performer.display_name}</Text>
                                <Text fontSize="sm" color="gray.500">
                                  {stats.top_performer.points.toLocaleString()} points
                                </Text>
                              </VStack>
                              <Badge colorScheme="gold" fontSize="xs">#1</Badge>
                            </HStack>
                          </CardBody>
                        </Card>
                      </Box>

                      <Divider />

                      <Box>
                        <Heading size="md" mb={4} fontSize={{ base: "lg", md: "xl" }}>Recent Activity</Heading>
                        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 2, md: 4 }}>
                          <Card>
                            <CardBody>
                              <Stat>
                                <StatLabel fontSize="xs">New Members</StatLabel>
                                <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.recent_activity.new_members_this_week}</StatNumber>
                                <StatHelpText fontSize="xs">This week</StatHelpText>
                              </Stat>
                            </CardBody>
                          </Card>
                          <Card>
                            <CardBody>
                              <Stat>
                                <StatLabel fontSize="xs">Verses Mastered</StatLabel>
                                <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.recent_activity.verses_mastered_this_week}</StatNumber>
                                <StatHelpText fontSize="xs">This week</StatHelpText>
                              </Stat>
                            </CardBody>
                          </Card>
                          <Card>
                            <CardBody>
                              <Stat>
                                <StatLabel fontSize="xs">Points Earned</StatLabel>
                                <StatNumber fontSize={{ base: "lg", md: "xl" }}>{stats.recent_activity.points_earned_this_week}</StatNumber>
                                <StatHelpText fontSize="xs">This week</StatHelpText>
                              </Stat>
                            </CardBody>
                          </Card>
                        </SimpleGrid>
                      </Box>
                    </VStack>
                  )}
                </TabPanel>

                {/* Members Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  <VStack spacing={4} align="stretch">
                    <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>Group Members</Heading>
                    <Card>
                      <CardBody p={{ base: 1, md: 6 }}>
                        {/* Mobile-friendly member list */}
                        <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
                          {members.map((member) => (
                            <Box key={member.user_id} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                              <VStack align="start" spacing={2}>
                                <Text fontWeight="bold" fontSize="sm">{member.display_name}</Text>
                                <HStack spacing={2}>
                                  <Badge 
                                    colorScheme={
                                      member.role === 'creator' ? 'purple' : 
                                      member.role === 'leader' ? 'blue' : 'gray'
                                    }
                                    fontSize="xs"
                                  >
                                    {member.role}
                                  </Badge>
                                  <Text fontSize="xs" color="gray.500">
                                    Joined {new Date(member.joined_at).toLocaleDateString()}
                                  </Text>
                                </HStack>
                              </VStack>
                            </Box>
                          ))}
                        </VStack>
                        
                        {/* Desktop table */}
                        <Box display={{ base: "none", md: "block" }}>
                          <Table variant="simple">
                            <Thead>
                              <Tr>
                                <Th>Member</Th>
                                <Th>Role</Th>
                                <Th>Joined</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {members.map((member) => (
                                <Tr key={member.user_id}>
                                  <Td>{member.display_name}</Td>
                                  <Td>
                                    <Badge 
                                      colorScheme={
                                        member.role === 'creator' ? 'purple' : 
                                        member.role === 'leader' ? 'blue' : 'gray'
                                      }
                                    >
                                      {member.role}
                                    </Badge>
                                  </Td>
                                  <Td>{new Date(member.joined_at).toLocaleDateString()}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                {/* Leaderboard Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  <VStack spacing={4} align="stretch">
                    <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>Leaderboard</Heading>
                    <Card>
                      <CardBody p={{ base: 1, md: 6 }}>
                        {/* Mobile-friendly leaderboard */}
                        <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
                          {leaderboard.map((entry) => (
                            <Box key={entry.user_id} p={3} border="1px" borderColor="gray.200" borderRadius="md">
                              <VStack align="start" spacing={2}>
                                <HStack justify="space-between" width="full">
                                  <Badge 
                                    colorScheme={
                                      entry.rank === 1 ? 'gold' : 
                                      entry.rank === 2 ? 'gray' : 
                                      entry.rank === 3 ? 'orange' : 'gray'
                                    }
                                    fontSize="xs"
                                  >
                                    #{entry.rank}
                                  </Badge>
                                  <Text fontWeight="bold" fontSize="sm">{entry.display_name}</Text>
                                </HStack>
                                <SimpleGrid columns={2} spacing={2} width="full">
                                  <Text fontSize="xs" color="gray.500">Points: {entry.points.toLocaleString()}</Text>
                                  <Text fontSize="xs" color="gray.500">Verses: {entry.verses_mastered}</Text>
                                  <Text fontSize="xs" color="gray.500">Current: {entry.current_streak}</Text>
                                  <Text fontSize="xs" color="gray.500">Longest: {entry.longest_streak}</Text>
                                </SimpleGrid>
                              </VStack>
                            </Box>
                          ))}
                        </VStack>
                        
                        {/* Desktop table */}
                        <Box display={{ base: "none", md: "block" }}>
                          <Table variant="simple">
                            <Thead>
                              <Tr>
                                <Th>Rank</Th>
                                <Th>Member</Th>
                                <Th>Points</Th>
                                <Th>Verses</Th>
                                <Th>Current Streak</Th>
                                <Th>Longest Streak</Th>
                              </Tr>
                            </Thead>
                            <Tbody>
                              {leaderboard.map((entry) => (
                                <Tr key={entry.user_id}>
                                  <Td>
                                    <Badge 
                                      colorScheme={
                                        entry.rank === 1 ? 'gold' : 
                                        entry.rank === 2 ? 'gray' : 
                                        entry.rank === 3 ? 'orange' : 'gray'
                                      }
                                    >
                                      #{entry.rank}
                                    </Badge>
                                  </Td>
                                  <Td>{entry.display_name}</Td>
                                  <Td>{entry.points.toLocaleString()}</Td>
                                  <Td>{entry.verses_mastered}</Td>
                                  <Td>{entry.current_streak}</Td>
                                  <Td>{entry.longest_streak}</Td>
                                </Tr>
                              ))}
                            </Tbody>
                          </Table>
                        </Box>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                {/* Invite Members Tab - Only for leaders/creators */}
                {(userRole === 'creator' || userRole === 'leader') && (
                  <TabPanel px={{ base: 0, md: 4 }}>
                    <VStack spacing={4} align="stretch">
                      <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>Invite Members</Heading>
                      <Card>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                              Create an invitation code to share with someone you want to invite to this group. The user must already have an account in the system.
                            </Text>
                            
                            {inviteError && (
                              <Alert status="error">
                                <AlertIcon />
                                {inviteError}
                              </Alert>
                            )}

                            {inviteSuccess && (
                              <Alert status="success">
                                <AlertIcon />
                                {inviteSuccess}
                              </Alert>
                            )}

                            <FormControl>
                              <FormLabel>Email Address</FormLabel>
                              <Input 
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="Enter email address"
                                type="email"
                                size={{ base: "md", md: "lg" }}
                              />
                              <FormHelperText fontSize="xs">
                                Only users who already have accounts in the system can be invited.
                              </FormHelperText>
                            </FormControl>

                            <Button 
                              colorScheme="blue" 
                              onClick={handleInviteMember}
                              isLoading={inviting}
                              loadingText="Creating Invitation..."
                              isDisabled={!inviteEmail.trim()}
                              size={{ base: "md", md: "lg" }}
                              width={{ base: "full", md: "auto" }}
                            >
                              Create Invitation
                            </Button>

                            {invitationCode && (
                              <VStack spacing={3} align="stretch" mt={4}>
                                <Text fontWeight="bold" color="gray.700" fontSize={{ base: "sm", md: "md" }}>
                                  Invitation Code:
                                </Text>
                                <InputGroup>
                                  <Input 
                                    value={invitationCode}
                                    isReadOnly
                                    pr="4.5rem"
                                    size={{ base: "md", md: "lg" }}
                                  />
                                  <InputRightElement width="4.5rem">
                                    <IconButton
                                      h="1.75rem"
                                      size="sm"
                                      icon={<CopyIcon />}
                                      onClick={copyInvitationCode}
                                      aria-label="Copy invitation code"
                                    />
                                  </InputRightElement>
                                </InputGroup>
                                <Text fontSize="xs" color="gray.600">
                                  Share this code with the person you want to invite. They can use it in the "Join Group" tab to join this group.
                                </Text>
                              </VStack>
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    </VStack>
                  </TabPanel>
                )}
              </TabPanels>
            </Tabs>
          </VStack>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default GroupDetails; 