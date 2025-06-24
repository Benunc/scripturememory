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

  // Check if user can create groups (100+ points or 5+ verses mastered)
  useEffect(() => {
    const checkCreatePermission = async () => {
      if (!isAuthenticated || !token) return;
      
      try {
        const response = await fetch(`${getApiUrl()}/gamification/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const stats = await response.json();
          const hasEnoughPoints = stats.total_points >= 5000;
          const hasEnoughVerses = stats.verses_mastered >= 5;
          setCanCreateGroup(hasEnoughPoints || hasEnoughVerses);
        }
      } catch (error) {
        console.error('Error checking create permission:', error);
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
        <Container maxW="container.xl">
          <VStack spacing={6} align="stretch">
            {/* Header */}
            <VStack align="start" spacing={2}>
              <Heading size="lg">Groups</Heading>
              <Text align="left" color="gray.500">Groups are a way to challenge yourself and others to memorize the Bible together. Users who have amassed at least 5000 points and mastered 5 verses can create a group.</Text>
            </VStack>

            {/* Tabs */}
            <Tabs>
              <TabList>
                <Tab>My Groups</Tab>
                <Tab>Join Group</Tab>
                <Tab>Profile Settings</Tab>
              </TabList>

              <TabPanels>
                {/* My Groups Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    {/* Group Creation */}
                    {canCreateGroup && (
                      <Card>
                        <CardBody>
                          <VStack spacing={4} align="stretch">
                            <HStack justify="space-between">
                              <VStack align="start" spacing={1}>
                                <Heading size="md">Create New Group</Heading>
                                <Text fontSize="sm" color="gray.600">
                                  You've proven your commitment! Start a new scripture study group
                                </Text>
                              </VStack>
                              <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={onOpen}>
                                Create Group
                              </Button>
                            </HStack>
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
                      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                        {groups.map((group) => (
                          <Card key={group.id} _hover={{ shadow: 'md' }} transition="shadow 0.2s">
                            <CardHeader>
                              <VStack align="start" spacing={2}>
                                <Heading size="md">{group.name}</Heading>
                                {group.description && (
                                  <Text fontSize="sm" color="gray.600">
                                    {group.description}
                                  </Text>
                                )}
                              </VStack>
                            </CardHeader>
                            <CardBody pt={0}>
                              <VStack spacing={4} align="stretch">
                                <Flex justify="space-between" align="center">
                                  <Badge 
                                    colorScheme={
                                      group.role === 'creator' ? 'purple' : 
                                      group.role === 'leader' ? 'blue' : 'gray'
                                    }
                                  >
                                    {group.role}
                                  </Badge>
                                </Flex>
                                <Flex justify="space-between" align="center">
                                  <Text fontSize="sm" color="gray.500">
                                    {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                                  </Text>
                                  <Button 
                                    size="sm" 
                                    colorScheme="blue" 
                                    onClick={() => navigate(`/groups/${group.id}`)}
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

                {/* Join Group Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Card>
                      <CardHeader>
                        <Heading size="md">Join a Group</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={4} align="stretch">
                          <Text color="gray.600">
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
                              size="lg"
                              value={joinInput}
                              onChange={(e) => setJoinInput(e.target.value)}
                            />
                            <FormHelperText>
                              You can enter a full invitation link or just the invitation code.
                            </FormHelperText>
                          </FormControl>
                          <Button 
                            colorScheme="blue" 
                            size="lg" 
                            onClick={handleJoinGroup}
                            isLoading={joining}
                            loadingText="Joining..."
                            isDisabled={!joinInput.trim()}
                          >
                            Join Group
                          </Button>
                        </VStack>
                      </CardBody>
                    </Card>
                  </VStack>
                </TabPanel>

                {/* Profile Settings Tab */}
                <TabPanel>
                  <VStack spacing={6} align="stretch">
                    <Card>
                      <CardHeader>
                        <Heading size="md">Profile Settings</Heading>
                      </CardHeader>
                      <CardBody>
                        <VStack spacing={6} align="stretch">
                          <Text color="gray.600">
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
                            />
                            <FormHelperText>
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
                            <FormLabel htmlFor="privacy-toggle" mb="0">
                              Public Profile
                            </FormLabel>
                            <Switch 
                              id="privacy-toggle"
                              isChecked={isPublic}
                              onChange={(e) => setIsPublic(e.target.checked)}
                            />
                          </FormControl>
                          <FormControl>
                            <FormHelperText>
                              When enabled, other group members can see your profile and stats in leaderboards.
                            </FormHelperText>
                          </FormControl>

                          <Button 
                            colorScheme="blue" 
                            onClick={updateProfileSettings}
                            isLoading={updatingProfile}
                            loadingText="Updating..."
                            isDisabled={!displayName.trim() || displayName.trim().length < 2 || !!profanityError}
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
            <Modal isOpen={isOpen} onClose={onClose}>
              <ModalOverlay />
              <ModalContent>
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
                  <Button variant="ghost" mr={3} onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    colorScheme="blue" 
                    onClick={handleCreateGroup}
                    isLoading={creating}
                    loadingText="Creating..."
                    isDisabled={!createForm.name.trim() || createForm.name.trim().length < 2 || !!groupProfanityErrors.name || !!groupProfanityErrors.description}
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