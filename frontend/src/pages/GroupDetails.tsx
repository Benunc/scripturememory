import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Select,
} from '@chakra-ui/react';
import { ArrowBackIcon, ExternalLinkIcon, CopyIcon } from '@chakra-ui/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { getApiUrl } from '../utils/api';
import { getCachedData, setCachedData, getLeaderboardCacheKey, clearLeaderboardCache } from '../utils/cache';

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
  metric_value?: number;
  total_events?: number;
  time_filtered_points?: number;
  time_filtered_verses_mastered?: number;
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
  const { isAuthenticated, token, isLoading } = useAuthContext();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  const [hasAdminPrivileges, setHasAdminPrivileges] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedVerseSet, setSelectedVerseSet] = useState<string>('');
  const [assigningUser, setAssigningUser] = useState(false);
  const [assigningVerseSet, setAssigningVerseSet] = useState(false);
  const [selectedGroupMember, setSelectedGroupMember] = useState<string>('');
  const [removingMember, setRemovingMember] = useState<number | null>(null);
  const [makingLeader, setMakingLeader] = useState<string | null>(null);
  const [demotingLeader, setDemotingLeader] = useState<string | null>(null);
  
  // Leaderboard filter state
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<string>('all');
  const [leaderboardSortColumn, setLeaderboardSortColumn] = useState<string>('points');
  const [leaderboardSortDirection, setLeaderboardSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Read tab from URL params on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const tabIndex = parseInt(tabParam);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 3) { // 0-3 for our 4 tabs
        setActiveTab(tabIndex);
      }
    }
  }, [searchParams]);

  // Handle tab change and update URL
  const handleTabChange = (index: number) => {
    setActiveTab(index);
    setSearchParams({ tab: index.toString() });
  };

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !token || !groupId)) {
      navigate('/groups');
      return;
    }

    if (isLoading) {
      return; // Don't load data while still checking authentication
    }

    // Type guard to ensure groupId is defined
    if (!groupId) {
      return;
    }

    const loadGroupData = async () => {
      try {
        setLoading(true);
        setError('');

        // First check if user is super admin
        let isSuperAdmin = false;
        const superAdminResponse = await fetch(`${getApiUrl()}/admin/check-super-admin`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (superAdminResponse.ok) {
          const superAdminData = await superAdminResponse.json();
          isSuperAdmin = superAdminData.isSuperAdmin;
        }

        // Load group info - different approach for super admins vs regular users
        if (isSuperAdmin) {
          // Super admins can access any group - get group info from admin endpoint
          const allGroupsResponse = await fetch(`${getApiUrl()}/admin/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (allGroupsResponse.ok) {
            const allGroupsData = await allGroupsResponse.json();
            const currentGroup = allGroupsData.groups.find((g: any) => g.id === parseInt(groupId));
            
            if (currentGroup) {
              setGroupName(currentGroup.name);
              setGroupDescription(currentGroup.description || '');
              setUserRole('admin'); // Super admins have admin role for any group
            } else {
              setError('Group not found');
              return;
            }
          } else {
            setError('Failed to load group data');
            return;
          }
        } else {
          // Regular users - check if they're a member of the group
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
          } else {
            setError('Failed to load group data');
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

        // Load stats
        const statsResponse = await fetch(`${getApiUrl()}/groups/${groupId}/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData.stats);
        }
      } catch (error) {
        console.error('Error loading group data:', error);
        setError('Failed to load group data');
      } finally {
        setLoading(false);
      }
    };

    loadGroupData();
  }, [isAuthenticated, token, groupId, navigate]);

  // Separate useEffect for leaderboard loading
  useEffect(() => {
    if (isAuthenticated && token && groupId && activeTab === 2) {
      reloadLeaderboard();
    }
  }, [leaderboardTimeframe, leaderboardSortColumn, leaderboardSortDirection, activeTab, isAuthenticated, token, groupId]);

  // Check if user has admin privileges and load admin data
  useEffect(() => {
    const checkAdminPrivileges = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        // Check if user has super admin privileges
        const response = await fetch(`${getApiUrl()}/admin/check-super-admin`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        let isSuperAdmin = false;
        if (response.ok) {
          const data = await response.json();
          isSuperAdmin = data.isSuperAdmin;
        }
        
        // Check if user is a leader or creator of this group
        const isGroupLeader = userRole === 'creator' || userRole === 'leader';
        
        // User has admin privileges if they're either a super admin or a group leader
        const hasPrivileges = isSuperAdmin || isGroupLeader;
        setHasAdminPrivileges(hasPrivileges);
        setIsSuperAdmin(isSuperAdmin);
        
        // Only super admins can see all users (for adding users to groups)
        // Group leaders can only assign verse sets to existing members
        if (isSuperAdmin) {
          const usersResponse = await fetch(`${getApiUrl()}/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            setAllUsers(usersData.users || []);
          }
        }
      } catch (error) {
        console.error('Error checking admin privileges:', error);
      }
    };

    checkAdminPrivileges();
  }, [isAuthenticated, token, userRole]);

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

  // Assign user to this group (admin function)
  const handleAssignUserToGroup = async () => {
    if (!isAuthenticated || !token || !groupId || !selectedUser) return;
    
    try {
      setAssigningUser(true);
      
      // Get the user ID from the email
      const user = allUsers.find(u => u.email === selectedUser);
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not found',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // Directly add user to group
      const response = await fetch(`${getApiUrl()}/groups/${groupId}/add-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: user.id })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || `User ${selectedUser} has been added to this group`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setSelectedUser('');
        // Refresh members list
        const membersResponse = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to add user to group',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add user to group',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setAssigningUser(false);
    }
  };

  // Assign verse set to existing group member (admin function)
  const handleAssignVerseSetToMember = async () => {
    if (!isAuthenticated || !token || !selectedGroupMember || !selectedVerseSet) return;
    
    try {
      setAssigningVerseSet(true);
      
      // Get the group member details
      const member = members.find(m => m.member_email === selectedGroupMember);
      if (!member) {
        toast({
          title: 'Error',
          description: 'Group member not found',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // Get the user ID from allUsers
      const user = allUsers.find(u => u.email === selectedGroupMember);
      if (!user) {
        toast({
          title: 'Error',
          description: 'User not found in system',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // Directly assign verse set to user
      const response = await fetch(`${getApiUrl()}/verses/assign-set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: user.id,
          verseSet: selectedVerseSet,
          groupId: groupId
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || `Verse set ${selectedVerseSet} has been assigned to ${member.display_name || selectedGroupMember}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        setSelectedGroupMember('');
        setSelectedVerseSet('');
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to assign verse set',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign verse set',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setAssigningVerseSet(false);
    }
  };

  // Remove member from group (super admin function)
  const handleRemoveMember = async (memberId: number) => {
    if (!isAuthenticated || !token || !groupId) return;
    
    try {
      setRemovingMember(memberId);
      
      const response = await fetch(`${getApiUrl()}/admin/groups/${groupId}/members/${memberId}/remove`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || 'Member removed successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh members list
        const membersResponse = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to remove member',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setRemovingMember(null);
    }
  };

  // Make member a leader
  const handleMakeLeader = async (memberEmail: string) => {
    if (!isAuthenticated || !token || !groupId) return;
    
    try {
      setMakingLeader(memberEmail);
      
      const response = await fetch(`${getApiUrl()}/groups/${groupId}/leaders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: memberEmail })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || 'Member promoted to leader successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh members list
        const membersResponse = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to promote member to leader',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to promote member to leader',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setMakingLeader(null);
    }
  };

  // Demote leader to member
  const handleDemoteLeader = async (memberEmail: string) => {
    if (!isAuthenticated || !token || !groupId) return;
    
    try {
      setDemotingLeader(memberEmail);
      
      const response = await fetch(`${getApiUrl()}/groups/${groupId}/leaders/demote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: memberEmail })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || `${memberEmail} has been demoted to member`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh members list
        const membersResponse = await fetch(`${getApiUrl()}/groups/${groupId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setMembers(membersData.members || []);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to demote leader',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to demote leader',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDemotingLeader(null);
    }
  };

  // Reload leaderboard with current filters
  const reloadLeaderboard = async () => {
    if (!isAuthenticated || !token || !groupId) return;
    
    // Generate cache key
    const cacheKey = getLeaderboardCacheKey(groupId, leaderboardTimeframe, leaderboardSortColumn, leaderboardSortDirection);
    const url = `${getApiUrl()}/gamification/leaderboard/${groupId}?timeframe=${leaderboardTimeframe}&metric=${leaderboardSortColumn}&direction=${leaderboardSortDirection}`;
    
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      setLeaderboard(cachedData);
      return; // No API call needed
    }
    
    try {
      setLoadingLeaderboard(true);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const leaderboardData = data.leaderboard || [];
        
        // Cache the result
        setCachedData(cacheKey, leaderboardData);
        setLeaderboard(leaderboardData);
      } else {
        console.error('Failed to load leaderboard');
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Handle filter changes
  const handleTimeframeChange = (timeframe: string) => {
    setLeaderboardTimeframe(timeframe);
  };

  const handleSortChange = (sortColumn: string) => {
    if (sortColumn === leaderboardSortColumn) {
      // Toggle direction if clicking the same column
      setLeaderboardSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      // Set new column and default to descending
      setLeaderboardSortColumn(sortColumn);
      setLeaderboardSortDirection('desc');
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
            <Tabs index={activeTab} onChange={handleTabChange}>
              <TabList overflowX="auto" css={{
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <Tab whiteSpace="nowrap">Overview</Tab>
                <Tab whiteSpace="nowrap">Members</Tab>
                <Tab whiteSpace="nowrap">Leaderboard</Tab>
                {hasAdminPrivileges && (
                  <Tab whiteSpace="nowrap">
                    {isSuperAdmin ? "Admin" : "Group Management"}
                  </Tab>
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
                                {hasAdminPrivileges && member.role !== 'creator' && (
                                  <VStack spacing={2} width="full">
                                    <Button 
                                      size="xs" 
                                      colorScheme="red" 
                                      onClick={() => handleRemoveMember(member.user_id)}
                                      isLoading={removingMember === member.user_id}
                                      loadingText="Removing..."
                                      width="full"
                                    >
                                      Remove Member
                                    </Button>
                                    {member.role === 'member' && (
                                      <Button 
                                        size="xs" 
                                        colorScheme="blue" 
                                        onClick={() => handleMakeLeader(member.member_email)}
                                        isLoading={makingLeader === member.member_email}
                                        loadingText="Promoting..."
                                        width="full"
                                      >
                                        Make Leader
                                      </Button>
                                    )}
                                    {member.role === 'leader' && (
                                      <Button 
                                        size="xs" 
                                        colorScheme="orange" 
                                        onClick={() => handleDemoteLeader(member.member_email)}
                                        isLoading={demotingLeader === member.member_email}
                                        loadingText="Demoting..."
                                        width="full"
                                      >
                                        Demote to Member
                                      </Button>
                                    )}
                                  </VStack>
                                )}
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
                                {hasAdminPrivileges && <Th>Actions</Th>}
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
                                  {hasAdminPrivileges && (
                                    <Td>
                                      {member.role !== 'creator' && (
                                        <VStack spacing={2} align="start">
                                          <Button 
                                            size="xs" 
                                            colorScheme="red" 
                                            onClick={() => handleRemoveMember(member.user_id)}
                                            isLoading={removingMember === member.user_id}
                                            loadingText="Removing..."
                                          >
                                            Remove
                                          </Button>
                                          {member.role === 'member' && (
                                            <Button 
                                              size="xs" 
                                              colorScheme="blue" 
                                              onClick={() => handleMakeLeader(member.member_email)}
                                              isLoading={makingLeader === member.member_email}
                                              loadingText="Promoting..."
                                            >
                                              Make Leader
                                            </Button>
                                          )}
                                          {member.role === 'leader' && (
                                            <Button 
                                              size="xs" 
                                              colorScheme="orange" 
                                              onClick={() => handleDemoteLeader(member.member_email)}
                                              isLoading={demotingLeader === member.member_email}
                                              loadingText="Demoting..."
                                            >
                                              Demote to Member
                                            </Button>
                                          )}
                                        </VStack>
                                      )}
                                    </Td>
                                  )}
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
                  <VStack spacing={0} align="stretch">
                    {/* Filter Controls */}
                    <HStack justify="space-between" align="center" mb={4}>
                      <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>Leaderboard</Heading>
                      <HStack spacing={2}>
                        {loadingLeaderboard && <Spinner size="sm" />}
                        <Select 
                          value={leaderboardTimeframe}
                          onChange={(e) => handleTimeframeChange(e.target.value)}
                          size="sm"
                          maxW="150px"
                        >
                          <option value="all">All Time</option>
                          <option value="this_week">This Week</option>
                          <option value="last_week">Last Week</option>
                          <option value="this_month">This Month</option>
                          <option value="last_month">Last Month</option>
                          <option value="this_year">This Year</option>
                          <option value="last_year">Last Year</option>
                        </Select>
                      </HStack>
                    </HStack>
                    
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
                                  <Text fontSize="xs" color="gray.500">
                                    Points: {entry.time_filtered_points?.toLocaleString() || '0'}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    Verses: {entry.time_filtered_verses_mastered || 0}
                                  </Text>
                                </SimpleGrid>
                                <SimpleGrid columns={2} spacing={2} width="full">
                                  <Text fontSize="xs" color="gray.500">
                                    Current: {entry.current_streak}
                                  </Text>
                                  <Text fontSize="xs" color="gray.500">
                                    Longest: {entry.longest_streak}
                                  </Text>
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
                                <Th 
                                  cursor="pointer" 
                                  onClick={() => handleSortChange('points')}
                                  _hover={{ bg: 'blue.50', color: 'gray.800' }}
                                  _dark={{ _hover: { bg: 'blue.900', color: 'white' } }}
                                  transition="background-color 0.2s"
                                  userSelect="none"
                                >
                                  <HStack spacing={1}>
                                    <Text>Points</Text>
                                    {leaderboardSortColumn === 'points' && (
                                      <Text fontSize="xs" color="blue.500">
                                        {leaderboardSortDirection === 'desc' ? '↓' : '↑'}
                                      </Text>
                                    )}
                                  </HStack>
                                </Th>
                                <Th 
                                  cursor="pointer" 
                                  onClick={() => handleSortChange('verses_mastered')}
                                  _hover={{ bg: 'blue.50', color: 'gray.800' }}
                                  _dark={{ _hover: { bg: 'blue.900', color: 'white' } }}
                                  transition="background-color 0.2s"
                                  userSelect="none"
                                >
                                  <HStack spacing={1}>
                                    <Text>Verses Mastered</Text>
                                    {leaderboardSortColumn === 'verses_mastered' && (
                                      <Text fontSize="xs" color="blue.500">
                                        {leaderboardSortDirection === 'desc' ? '↓' : '↑'}
                                      </Text>
                                    )}
                                  </HStack>
                                </Th>
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
                                  <Td>{entry.time_filtered_points?.toLocaleString() || '0'}</Td>
                                  <Td>{entry.time_filtered_verses_mastered || 0}</Td>
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

                {/* Admin Tab - Only for super admins */}
                {hasAdminPrivileges && (
                  <TabPanel px={{ base: 0, md: 4 }}>
                    <VStack spacing={6} align="stretch">
                      {/* Add User to Group - Only for super admins */}
                      {isSuperAdmin && (
                        <Card>
                          <CardHeader>
                            <Heading size="md">Add User to Group</Heading>
                          </CardHeader>
                          <CardBody>
                            <VStack spacing={4} align="stretch">
                              <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                                Add a new user to this group
                              </Text>
                              
                              <FormControl>
                                <FormLabel>Select User</FormLabel>
                                <Select 
                                  value={selectedUser}
                                  onChange={(e) => setSelectedUser(e.target.value)}
                                  placeholder="Select a user to add"
                                  size={{ base: "md", md: "lg" }}
                                >
                                  {allUsers.map((user) => (
                                    <option key={user.id} value={user.email}>
                                      {user.email} (ID: {user.id})
                                    </option>
                                  ))}
                                </Select>
                                <FormHelperText fontSize="xs">
                                  Select a user from the system to add to this group
                                </FormHelperText>
                              </FormControl>

                              <Button 
                                colorScheme="blue" 
                                onClick={handleAssignUserToGroup}
                                isLoading={assigningUser}
                                loadingText="Adding User..."
                                isDisabled={!selectedUser}
                                size={{ base: "md", md: "lg" }}
                                width={{ base: "full", md: "auto" }}
                              >
                                Add User to Group
                              </Button>
                            </VStack>
                          </CardBody>
                        </Card>
                      )}

                      {/* Assign Verse Set to Group Member - Available for all group leaders */}
                      <Card>
                        <CardHeader>
                          <Heading size="md">Assign Verse Set to Group Member</Heading>
                        </CardHeader>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                              Assign a verse set to an existing member of this group
                            </Text>
                            
                            <FormControl>
                              <FormLabel>Select Group Member</FormLabel>
                              <Select 
                                value={selectedGroupMember}
                                onChange={(e) => setSelectedGroupMember(e.target.value)}
                                placeholder="Select a group member"
                                size={{ base: "md", md: "lg" }}
                              >
                                {members.map((member) => (
                                  <option key={member.user_id} value={member.member_email}>
                                    {member.display_name || member.member_email} ({member.role})
                                  </option>
                                ))}
                              </Select>
                              <FormHelperText fontSize="xs">
                                Select an existing member of this group
                              </FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Select Verse Set</FormLabel>
                              <Select 
                                value={selectedVerseSet}
                                onChange={(e) => setSelectedVerseSet(e.target.value)}
                                placeholder="Select a verse set"
                                size={{ base: "md", md: "lg" }}
                              >
                                <option value="default">Default Verses</option>
                                <option value="childrens_verses">Children's Verses</option>
                                <option value="gpc_youth">GPC Youth Starter Verses</option>
                              </Select>
                              <FormHelperText fontSize="xs">
                                Select a verse set to assign to the member
                              </FormHelperText>
                            </FormControl>

                            <Button 
                              colorScheme="green" 
                              onClick={handleAssignVerseSetToMember}
                              isLoading={assigningVerseSet}
                              loadingText="Assigning Verse Set..."
                              isDisabled={!selectedGroupMember || !selectedVerseSet}
                              size={{ base: "md", md: "lg" }}
                              width={{ base: "full", md: "auto" }}
                            >
                              Assign Verse Set to Member
                            </Button>
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