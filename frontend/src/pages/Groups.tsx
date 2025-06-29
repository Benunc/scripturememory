import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Spinner,
  Center,
  Alert,
  AlertIcon,
  FormControl,
  FormLabel,
  Input,
  Switch,
  useToast,
  Divider,
  Link,
  SimpleGrid,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Textarea,
  FormHelperText,
  useDisclosure,
  Select,
} from '@chakra-ui/react';
import { AddIcon, ViewIcon } from '@chakra-ui/icons';
import { useAuthContext } from '../contexts/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { Footer } from '../components/Footer';
import { containsProfanity, getProfanityErrorMessage } from '../utils/profanityFilter';
import { getApiUrl } from '../utils/api';

interface Group {
  id: number;
  name: string;
  description?: string;
  member_count: number;
  role: 'creator' | 'leader' | 'member';
  user_id?: number;
  creator_email?: string;
  created_at?: number;
}

interface CreateGroupData {
  name: string;
  description?: string;
}

const Groups: React.FC = () => {
  const { isAuthenticated, userEmail, token } = useAuthContext();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreateGroup, setCanCreateGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedVerseSet, setSelectedVerseSet] = useState<string>('');
  const [assigningUser, setAssigningUser] = useState(false);
  const [assigningVerseSet, setAssigningVerseSet] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [createForm, setCreateForm] = useState<CreateGroupData>({
    name: '',
    description: ''
  });
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [profanityError, setProfanityError] = useState<string | null>(null);
  const [groupProfanityErrors, setGroupProfanityErrors] = useState<{name?: string, description?: string}>({});
  const [joinInput, setJoinInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  
  // Super admin state
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [deletingGroup, setDeletingGroup] = useState<number | null>(null);
  const [removingMember, setRemovingMember] = useState<{groupId: number, userId: number} | null>(null);

  const navigate = useNavigate();
  const toast = useToast();

  // Get user ID from backend
  const loadUserId = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      const response = await fetch(`${getApiUrl()}/gamification/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // The stats endpoint returns user_id in the response
        if (data.user_id) {
          setUserId(data.user_id);
        }
      }
    } catch (error) {
      console.error('Error loading user ID:', error);
    }
  };

  // Check if user can create groups (permission-based)
  useEffect(() => {
    const checkCreatePermission = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        // Check if user has create_groups permission
        const response = await fetch(`${getApiUrl()}/groups/can-create`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setCanCreateGroup(data.canCreate);
        } else {
          // Fallback: check gamification stats for backward compatibility
          const statsResponse = await fetch(`${getApiUrl()}/gamification/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (statsResponse.ok) {
            const stats = await statsResponse.json();
            const hasEnoughPoints = stats.total_points >= 5000;
            const hasEnoughVerses = stats.verses_mastered >= 5;
            setCanCreateGroup(hasEnoughPoints || hasEnoughVerses);
          }
        }
      } catch (error) {
        console.error('Error checking create permission:', error);
        // Fallback: check gamification stats
        try {
          const statsResponse = await fetch(`${getApiUrl()}/gamification/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (statsResponse.ok) {
            const stats = await statsResponse.json();
            const hasEnoughPoints = stats.total_points >= 5000;
            const hasEnoughVerses = stats.verses_mastered >= 5;
            setCanCreateGroup(hasEnoughPoints || hasEnoughVerses);
          }
        } catch (fallbackError) {
          console.error('Error checking gamification stats:', fallbackError);
        }
      }
    };

    checkCreatePermission();
  }, [isAuthenticated, token]);

  // Load user ID when component mounts
  useEffect(() => {
    loadUserId();
  }, [isAuthenticated, token]);

  // Load user's groups from backend
  useEffect(() => {
    const loadGroups = async () => {
      if (!isAuthenticated || !token) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${getApiUrl()}/groups/mine`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setGroups(data.groups || []);
        } else {
          const err = await response.json();
          setError(err.error || 'Failed to load groups');
        }
      } catch (error) {
        setError('Failed to load groups');
        console.error('Error loading groups:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [isAuthenticated, token]);

  // Check super admin status and load all groups for super admins
  useEffect(() => {
    const checkSuperAdminAndLoadAllGroups = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        // Check if user has super admin privileges
        const response = await fetch(`${getApiUrl()}/admin/check-super-admin`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(data.isSuperAdmin);
          
          // If super admin, load all groups
          if (data.isSuperAdmin) {
            const allGroupsResponse = await fetch(`${getApiUrl()}/admin/groups`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (allGroupsResponse.ok) {
              const allGroupsData = await allGroupsResponse.json();
              setAllGroups(allGroupsData.groups || []);
            }
          }
        }
      } catch (error) {
        console.error('Error checking super admin status:', error);
      }
    };

    checkSuperAdminAndLoadAllGroups();
  }, [isAuthenticated, token]);

  // Load profile settings when groups are loaded
  useEffect(() => {
    if (groups.length > 0 && userId) {
      loadProfileSettings();
    }
  }, [groups, userId]);

  // Load current profile settings
  const loadProfileSettings = async () => {
    if (!isAuthenticated || !token || !groups.length || !userId) return;
    
    try {
      // Get user profile from the first group to get current settings
      const firstGroup = groups[0];
      
      const response = await fetch(`${getApiUrl()}/groups/${firstGroup.id}/members/${userId}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDisplayName(data.profile.display_name || '');
        // Convert database boolean (0/1) to JavaScript boolean
        setIsPublic(Boolean(data.profile.is_public));
      }
    } catch (error) {
      console.error('Error loading profile settings:', error);
    }
  };

  // Update profile settings across all groups
  const updateProfileSettings = async () => {
    if (!isAuthenticated || !token || !groups.length || !userId) return;
    
    setUpdatingProfile(true);
    setProfileError(null);
    
    try {
      // Update settings for each group
      const updatePromises = groups.map(async group => {
        // Update display name
        const displayNameResponse = await fetch(`${getApiUrl()}/groups/${group.id}/members/${userId}/display-name`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ displayName: displayName.trim() })
        });
        
        if (!displayNameResponse.ok) {
          throw new Error(`Failed to update display name for group ${group.name}`);
        }
        
        // Update privacy settings
        const privacyResponse = await fetch(`${getApiUrl()}/groups/${group.id}/members/${userId}/privacy`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ isPublic })
        });
        
        if (!privacyResponse.ok) {
          throw new Error(`Failed to update privacy settings for group ${group.name}`);
        }
        
        return { displayNameResponse: await displayNameResponse.json(), privacyResponse: await privacyResponse.json() };
      });

      await Promise.all(updatePromises);
      
      toast({
        title: 'Profile updated',
        description: 'Your display name and privacy settings have been updated across all groups.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
    } catch (error) {
      setProfileError('Failed to update profile settings');
      console.error('Error updating profile:', error);
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      setCreating(true);
      const response = await fetch(`${getApiUrl()}/groups/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      });

      if (response.ok) {
        const newGroup = await response.json();
        setGroups(prev => [...prev, newGroup.group]);
        setCreateForm({ name: '', description: '' });
        onClose();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create group',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create group',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!isAuthenticated || !token || !joinInput.trim()) return;
    
    try {
      setJoining(true);
      setJoinError(null);
      setJoinSuccess(null);
      
      let groupId: number;
      let invitationId: string;
      
      // Parse the input - could be a full URL, invitation code, or group/invitation combo
      const input = joinInput.trim();
      
      // Check if it's a full URL like /groups/123/join/ABC12345
      const urlMatch = input.match(/\/groups\/(\d+)\/join\/([A-Z0-9]+)/);
      if (urlMatch) {
        groupId = parseInt(urlMatch[1]);
        invitationId = urlMatch[2]; // This is now the invitation code
      } else {
        // Check if it's just an invitation code (we'll need to get group ID from invitation details)
        const invitationCodeMatch = input.match(/^([A-Z0-9]{8})$/);
        if (invitationCodeMatch) {
          invitationId = invitationCodeMatch[1]; // This is the invitation code
          // Get invitation details to find group ID
          const detailsResponse = await fetch(`${getApiUrl()}/groups/invitations/code/${invitationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (detailsResponse.ok) {
            const details = await detailsResponse.json();
            groupId = details.invitation.group_id;
          } else {
            setJoinError('Invalid invitation code');
            return;
          }
        } else {
          setJoinError('Please enter a valid invitation link or invitation code');
          return;
        }
      }
      
      // Join the group using the invitation code
      const response = await fetch(`${getApiUrl()}/groups/${groupId}/join/${invitationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setJoinSuccess('Successfully joined the group!');
        setJoinInput('');
        // Refresh groups list
        const groupsResponse = await fetch(`${getApiUrl()}/groups/mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          setGroups(groupsData.groups || []);
        }
      } else {
        const error = await response.json();
        setJoinError(error.error || 'Failed to join group');
      }
    } catch (error) {
      setJoinError('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  // Super admin functions
  const handleDeleteGroup = async (groupId: number) => {
    if (!isAuthenticated || !token) return;
    
    try {
      setDeletingGroup(groupId);
      
      const response = await fetch(`${getApiUrl()}/admin/groups/${groupId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Success',
          description: result.message || 'Group deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh groups lists
        const groupsResponse = await fetch(`${getApiUrl()}/groups/mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          setGroups(groupsData.groups || []);
        }
        
        const allGroupsResponse = await fetch(`${getApiUrl()}/admin/groups`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (allGroupsResponse.ok) {
          const allGroupsData = await allGroupsResponse.json();
          setAllGroups(allGroupsData.groups || []);
        }
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete group',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete group',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setDeletingGroup(null);
    }
  };

  const handleRemoveMember = async (groupId: number, memberId: number) => {
    if (!isAuthenticated || !token) return;
    
    try {
      setRemovingMember({ groupId, userId: memberId });
      
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
        
        // Refresh all groups list
        const allGroupsResponse = await fetch(`${getApiUrl()}/admin/groups`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (allGroupsResponse.ok) {
          const allGroupsData = await allGroupsResponse.json();
          setAllGroups(allGroupsData.groups || []);
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

  if (!isAuthenticated) {
    return (
      <Container maxW="container.md" py={8}>
        <Center>
          <VStack spacing={6}>
            <Heading>Groups</Heading>
            <Text>Please sign in to access groups.</Text>
            <Button as={Link} href="/" colorScheme="blue">
              Go to Sign In
            </Button>
          </VStack>
        </Center>
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
            <VStack align="start" spacing={2}>
              <Heading size="lg">Groups</Heading>
              <Text align="left" color="gray.500" fontSize={{ base: "sm", md: "md" }}>
                Groups are a way to challenge yourself and others to memorize the Bible together. Users with group creation permissions can create new groups.
              </Text>
            </VStack>

            {/* Tabs */}
            <Tabs index={activeTab} onChange={setActiveTab}>
              <TabList overflowX="auto" css={{
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                <Tab whiteSpace="nowrap">My Groups</Tab>
                {isSuperAdmin && (
                  <Tab whiteSpace="nowrap">All Groups</Tab>
                )}
                <Tab whiteSpace="nowrap">Join Group</Tab>
                <Tab whiteSpace="nowrap">Profile Settings</Tab>
              </TabList>

              <TabPanels>
                {/* My Groups Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  <VStack spacing={6} align="stretch">
                    {/* Group Creation */}
                    {canCreateGroup && (
                      <Card>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            <VStack align="start" spacing={2}>
                              <Heading size="md">Create New Group</Heading>
                              <Text fontSize="sm" color="gray.600">
                                You have permission to create groups! Start a new scripture study group
                              </Text>
                            </VStack>
                            <Button 
                              leftIcon={<AddIcon />} 
                              colorScheme="blue" 
                              onClick={onOpen}
                              size={{ base: "md", md: "lg" }}
                              width={{ base: "full", md: "auto" }}
                            >
                              Create Group
                            </Button>
                          </VStack>
                        </CardBody>
                      </Card>
                    )}

                    {/* Groups List */}
                    {loading ? (
                      <Center py={8}>
                        <Spinner size="xl" />
                      </Center>
                    ) : error ? (
                      <Alert status="error">
                        <AlertIcon />
                        {error}
                      </Alert>
                    ) : groups.length === 0 ? (
                      <Card>
                        <CardBody>
                          <VStack spacing={4} textAlign="center">
                            <Text fontSize="lg" fontWeight="medium">
                              You're not in any groups yet
                            </Text>
                            <Text color="gray.600">
                              Join an existing group or create a new one to get started
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card>
                    ) : (
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
                        {groups.map((group) => (
                          <Card key={group.id} _hover={{ shadow: 'md' }} transition="shadow 0.2s">
                            <CardHeader pb={2}>
                              <VStack align="start" spacing={2}>
                                <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>{group.name}</Heading>
                                {group.description && (
                                  <Text fontSize="sm" color="gray.600" noOfLines={2}>
                                    {group.description}
                                  </Text>
                                )}
                              </VStack>
                            </CardHeader>
                            <CardBody pt={0}>
                              <VStack spacing={4} align="stretch">
                                <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                                  <Badge 
                                    colorScheme={
                                      group.role === 'creator' ? 'purple' : 
                                      group.role === 'leader' ? 'blue' : 'gray'
                                    }
                                    fontSize="xs"
                                  >
                                    {group.role}
                                  </Badge>
                                </Flex>
                                <Flex justify="space-between" align="center" direction={{ base: "column", sm: "row" }} gap={3}>
                                  <Text fontSize="sm" color="gray.500">
                                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                                  </Text>
                                  <Button 
                                    size="sm" 
                                    colorScheme="blue" 
                                    onClick={() => navigate(`/groups/${group.id}`)}
                                    width={{ base: "full", sm: "auto" }}
                                  >
                                    View Group
                                  </Button>
                                </Flex>
                              </VStack>
                            </CardBody>
                          </Card>
                        ))}
                      </SimpleGrid>
                    )}
                  </VStack>
                </TabPanel>

                {/* All Groups Tab - Super Admin Only */}
                {isSuperAdmin && (
                  <TabPanel px={{ base: 0, md: 4 }}>
                    <VStack spacing={6} align="stretch">
                      <Card>
                        <CardHeader>
                          <Heading size="md">All Groups (Super Admin View)</Heading>
                        </CardHeader>
                        <CardBody>
                          <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                            Manage all groups in the system. You can delete groups and remove members.
                          </Text>
                        </CardBody>
                      </Card>

                      {/* All Groups List */}
                      {allGroups.length === 0 ? (
                        <Card>
                          <CardBody>
                            <VStack spacing={4} textAlign="center">
                              <Text fontSize="lg" fontWeight="medium">
                                No groups found
                              </Text>
                              <Text color="gray.600">
                                There are no active groups in the system.
                              </Text>
                            </VStack>
                          </CardBody>
                        </Card>
                      ) : (
                        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 3, md: 6 }}>
                          {allGroups.map((group) => (
                            <Card key={group.id} _hover={{ shadow: 'md' }} transition="shadow 0.2s">
                              <CardHeader pb={2}>
                                <VStack align="start" spacing={2}>
                                  <Heading size="md" fontSize={{ base: "lg", md: "xl" }}>{group.name}</Heading>
                                  {group.description && (
                                    <Text fontSize="sm" color="gray.600" noOfLines={2}>
                                      {group.description}
                                    </Text>
                                  )}
                                </VStack>
                              </CardHeader>
                              <CardBody pt={0}>
                                <VStack spacing={4} align="stretch">
                                  <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                                    <Text fontSize="sm" color="gray.500">
                                      Created by: {group.creator_email}
                                    </Text>
                                  </Flex>
                                  <Flex justify="space-between" align="center" direction={{ base: "column", sm: "row" }} gap={3}>
                                    <Text fontSize="sm" color="gray.500">
                                      {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                                    </Text>
                                    <Text fontSize="sm" color="gray.500">
                                      {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Unknown date'}
                                    </Text>
                                  </Flex>
                                  <Flex justify="space-between" align="center" direction={{ base: "column", sm: "row" }} gap={3}>
                                    <Button 
                                      size="sm" 
                                      colorScheme="blue" 
                                      onClick={() => navigate(`/groups/${group.id}`)}
                                      width={{ base: "full", sm: "auto" }}
                                    >
                                      View Group
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      colorScheme="red" 
                                      onClick={() => handleDeleteGroup(group.id)}
                                      isLoading={deletingGroup === group.id}
                                      loadingText="Deleting..."
                                      width={{ base: "full", sm: "auto" }}
                                    >
                                      Delete Group
                                    </Button>
                                  </Flex>
                                </VStack>
                              </CardBody>
                            </Card>
                          ))}
                        </SimpleGrid>
                      )}
                    </VStack>
                  </TabPanel>
                )}

                {/* Join Group Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  <VStack spacing={6} align="stretch">
                    <Card>
                      <CardHeader>
                        <Heading size="md">Join a Group</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                            Enter an invitation link or invitation code to join an existing group
                          </Text>
                          
                          {joinError && (
                            <Alert status="error">
                              <AlertIcon />
                              {joinError}
                            </Alert>
                          )}

                          {joinSuccess && (
                            <Alert status="success">
                              <AlertIcon />
                              {joinSuccess}
                            </Alert>
                          )}

                          <FormControl>
                            <FormLabel>Invitation Link or Code</FormLabel>
                            <Input 
                              placeholder="e.g., /groups/123/join/ABC12345 or just ABC12345"
                              size={{ base: "md", md: "lg" }}
                              value={joinInput}
                              onChange={(e) => setJoinInput(e.target.value)}
                            />
                            <FormHelperText fontSize="xs">
                              You can enter a full invitation link or just the invitation code.
                            </FormHelperText>
                          </FormControl>
                          <Button 
                            colorScheme="blue" 
                            size={{ base: "md", md: "lg" }}
                            onClick={handleJoinGroup}
                            isLoading={joining}
                            loadingText="Joining..."
                            isDisabled={!joinInput.trim()}
                            width={{ base: "full", md: "auto" }}
                          >
                            Join Group
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                {/* Profile Settings Tab */}
                <TabPanel px={{ base: 0, md: 4 }}>
                  <VStack spacing={6} align="stretch">
                    <Card>
                      <CardHeader>
                        <Heading size="md">Profile Settings</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={6} align="stretch">
                          <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
                            Manage how you appear in your groups
                          </Text>
                          
                          {profileError && (
                            <Alert status="error">
                              <AlertIcon />
                              {profileError}
                            </Alert>
                          )}

                          <FormControl>
                            <FormLabel>Display Name</FormLabel>
                            <Input 
                              value={displayName}
                              onChange={(e) => {
                                setDisplayName(e.target.value);
                                setProfanityError(containsProfanity(e.target.value) ? getProfanityErrorMessage('Display name') : null);
                              }}
                              placeholder="Enter your display name"
                              maxLength={30}
                              size={{ base: "md", md: "lg" }}
                            />
                            <FormHelperText fontSize="xs">
                              This name will be shown to other group members. 2-30 characters, letters, numbers, spaces, hyphens, and underscores only.
                            </FormHelperText>
                          </FormControl>

                          {profanityError && (
                            <Alert status="error">
                              <AlertIcon />
                              {profanityError}
                            </Alert>
                          )}

                          <FormControl display="flex" alignItems="center">
                            <FormLabel htmlFor="privacy-toggle" mb="0" fontSize={{ base: "sm", md: "md" }}>
                              Public Profile
                            </FormLabel>
                            <Switch 
                              id="privacy-toggle"
                              isChecked={isPublic}
                              onChange={(e) => setIsPublic(e.target.checked)}
                            />
                          </FormControl>
                          <FormControl>
                            <FormHelperText fontSize="xs">
                              When enabled, other group members can see your profile and stats in leaderboards.
                            </FormHelperText>
                          </FormControl>

                          <Button 
                            colorScheme="blue" 
                            onClick={updateProfileSettings}
                            isLoading={updatingProfile}
                            loadingText="Updating..."
                            isDisabled={!displayName.trim() || displayName.trim().length < 2 || !!profanityError}
                            size={{ base: "md", md: "lg" }}
                            width={{ base: "full", md: "auto" }}
                          >
                            Update Profile
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>
              </TabPanels>
            </Tabs>

            {/* Create Group Modal */}
            <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "md" }}>
              <ModalOverlay />
              <ModalContent mx={{ base: 2, md: 0 }}>
                <ModalHeader>Create New Group</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel>Group Name</FormLabel>
                      <Input 
                        value={createForm.name}
                        onChange={(e) => {
                          setCreateForm({ ...createForm, name: e.target.value });
                          setGroupProfanityErrors({ ...groupProfanityErrors, name: containsProfanity(e.target.value) ? getProfanityErrorMessage('Group name') : undefined });
                        }}
                        placeholder="Enter group name"
                        maxLength={50}
                        size={{ base: "md", md: "lg" }}
                      />
                      {groupProfanityErrors.name && (
                        <Alert status="error" mt={2}>
                          <AlertIcon />
                          {groupProfanityErrors.name}
                        </Alert>
                      )}
                    </FormControl>
                    <FormControl>
                      <FormLabel>Description (Optional)</FormLabel>
                      <Textarea 
                        value={createForm.description}
                        onChange={(e) => {
                          setCreateForm({ ...createForm, description: e.target.value });
                          setGroupProfanityErrors({ ...groupProfanityErrors, description: containsProfanity(e.target.value) ? getProfanityErrorMessage('Group description') : undefined });
                        }}
                        placeholder="Describe your group's purpose"
                        maxLength={200}
                        rows={3}
                        size={{ base: "md", md: "lg" }}
                      />
                      {groupProfanityErrors.description && (
                        <Alert status="error" mt={2}>
                          <AlertIcon />
                          {groupProfanityErrors.description}
                        </Alert>
                      )}
                    </FormControl>
                  </VStack>
                </ModalBody>
                <ModalFooter>
                  <Button variant="ghost" mr={3} onClick={onClose} size={{ base: "md", md: "lg" }}>
                    Cancel
                  </Button>
                  <Button 
                    colorScheme="blue" 
                    onClick={handleCreateGroup}
                    isLoading={creating}
                    loadingText="Creating..."
                    isDisabled={!createForm.name.trim() || createForm.name.trim().length < 2 || !!groupProfanityErrors.name || !!groupProfanityErrors.description}
                    size={{ base: "md", md: "lg" }}
                  >
                    Create Group
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </VStack>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};

export default Groups; 