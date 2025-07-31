import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Switch,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  useToast,
  Container,
  Heading,
  useColorModeValue,
  useBreakpointValue,
  useColorMode,
  Select,
  Badge,
  SimpleGrid,
} from '@chakra-ui/react';
import { useAuth } from '../hooks/useAuth';
import { getApiUrl } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { AppHeader } from '../components/AppHeader';
import { verseSets, verseSetDescriptions } from '../data/verses';

interface MarketingPreferences {
  marketing_opt_in: boolean;
  marketing_opt_in_date: number | null;
  marketing_opt_out_date: number | null;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth(navigate);
  const [preferences, setPreferences] = useState<MarketingPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verse set states
  const [selectedVerseSet, setSelectedVerseSet] = useState<string>('');
  const [addingVerseSet, setAddingVerseSet] = useState(false);
  const [verseSetError, setVerseSetError] = useState<string | null>(null);
  
  // Notification management states (super admin only)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false }) || false;
  const { colorMode, toggleColorMode } = useColorMode();

  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    if (token) {
      fetchPreferences();
      checkSuperAdminStatus();
    }
  }, [token]);

  const checkSuperAdminStatus = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/admin/check-super-admin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsSuperAdmin(data.isSuperAdmin);
        
        if (data.isSuperAdmin) {
          fetchNotificationData();
        }
      }
    } catch (error) {
      console.error('Error checking super admin status:', error);
    }
  };

  const fetchNotificationData = async () => {
    setLoadingNotifications(true);
    try {
      // Fetch notification logs
      const logsResponse = await fetch(`${getApiUrl()}/admin/notification-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (logsResponse.ok) {
        const logs = await logsResponse.json();
        setNotificationLogs(logs);
      }

      // Fetch notification settings
      const settingsResponse = await fetch(`${getApiUrl()}/admin/notification-settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        setNotificationSettings(settings);
      }
    } catch (error) {
      console.error('Error fetching notification data:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${getApiUrl()}/marketing/preferences`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
        setMarketingOptIn(data.marketing_opt_in);
      } else {
        console.error('Failed to fetch preferences');
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMarketingPreferences = async () => {
    setUpdating(true);
    try {
      const response = await fetch(`${getApiUrl()}/marketing/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          marketing_opt_in: marketingOptIn
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences({
          ...preferences!,
          marketing_opt_in: data.marketing_opt_in
        });
        setError(null); // Clear any previous errors
        toast({
          title: 'Preferences Updated',
          description: marketingOptIn 
            ? 'You have been subscribed to app update informational emails.'
            : 'You have been unsubscribed from app update informational emails.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to update preferences.';
        setError(errorMessage);
        toast({
          title: 'Update Failed',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      const errorMessage = 'An error occurred while updating preferences.';
      setError(errorMessage);
      toast({
        title: 'Update Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdating(false);
    }
  };

  const addVerseSet = async () => {
    if (!selectedVerseSet) return;
    
    setAddingVerseSet(true);
    setVerseSetError(null);
    
    try {
      const verseSetData = verseSets[selectedVerseSet as keyof typeof verseSets];
      if (!verseSetData) {
        throw new Error('Invalid verse set selected');
      }

      let addedCount = 0;
      let skippedCount = 0;

      // Add each verse from the set
      for (const verse of verseSetData) {
        try {
          console.log(`Attempting to add verse: ${verse.reference}`);
          const response = await fetch(`${getApiUrl()}/verses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              reference: verse.reference,
              text: verse.text,
              translation: 'ESV' // Default translation for verse sets
            })
          });

          console.log(`Response status for ${verse.reference}:`, response.status);
          
          if (response.ok) {
            addedCount++;
            console.log(`Successfully added: ${verse.reference}`);
          } else if (response.status === 409) {
            // Verse already exists
            skippedCount++;
            console.log(`Verse already exists: ${verse.reference}`);
          } else {
            const errorText = await response.text();
            console.error(`Failed to add verse ${verse.reference}:`, errorText);
          }
        } catch (error) {
          console.error(`Error adding verse ${verse.reference}:`, error);
        }
      }

      // Show success message
      let description = addedCount > 0 
        ? `Added ${addedCount} new verse${addedCount > 1 ? 's' : ''} to your collection.`
        : 'All verses from this set are already in your collection.';
      
      if (skippedCount > 0) {
        description += ` ${skippedCount} verse${skippedCount > 1 ? 's' : ''} were already present.`;
      }

      toast({
        title: 'Verse Set Added',
        description,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });

      setSelectedVerseSet('');
    } catch (error) {
      console.error('Error adding verse set:', error);
      const errorMessage = 'Failed to add verse set. Please try again.';
      setVerseSetError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setAddingVerseSet(false);
    }
  };

  const updateNotificationSettings = async (settings: any[]) => {
    setUpdatingNotifications(true);
    try {
      const response = await fetch(`${getApiUrl()}/admin/notification-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        const data = await response.json();
        setNotificationSettings(settings);
        toast({
          title: 'Settings Updated',
          description: 'Notification settings have been updated successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Update Failed',
          description: 'Failed to update notification settings.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: 'Update Failed',
        description: 'An error occurred while updating notification settings.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdatingNotifications(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <AppHeader />
        <Container maxW="container.lg" py={8}>
          <VStack spacing={8} align="stretch">
            <Box textAlign="center">
              <Spinner size="xl" />
              <Text mt={4}>Loading settings...</Text>
            </Box>
          </VStack>
        </Container>
        <Footer />
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <AppHeader />
      <Container maxW="container.lg" py={8}>
        <VStack spacing={8} align="stretch">
          <Heading size="lg" textAlign="center">Settings</Heading>

          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>

          {/* Marketing Preferences */}
          <Box
            px={4}
            py={5}
            bg={cardBg}
            rounded="lg"
            border="1px"
            borderColor={borderColor}
          >
            <Heading size="md" mb={4}>Marketing Preferences</Heading>
            <FormControl>
              <FormLabel htmlFor="marketing-opt-in" color={useColorModeValue('gray.800', 'gray.100')}>
                Receive email updates
              </FormLabel>
              <HStack justify="space-between">
                <FormHelperText color={useColorModeValue('gray.600', 'gray.300')}>
                  {marketingOptIn 
                    ? 'You will receive updates about new features and improvements.'
                    : 'You will not receive email updates.'
                  }
                </FormHelperText>
                <Switch
                  id="marketing-opt-in"
                  isChecked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  colorScheme="blue"
                  size="lg"
                />
              </HStack>
            </FormControl>

                          {preferences && (
                <Box mt={4} p={4} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                  <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                    <strong>Current Status:</strong> {preferences.marketing_opt_in ? 'Opted In' : 'Opted Out'}
                  </Text>
                  {preferences.marketing_opt_in_date && (
                    <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                      <strong>Opt-in Date:</strong> {new Date(preferences.marketing_opt_in_date).toLocaleDateString()}
                    </Text>
                  )}
                  {preferences.marketing_opt_out_date && (
                    <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.300')}>
                      <strong>Opt-out Date:</strong> {new Date(preferences.marketing_opt_out_date).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
              )}

            <Button
              colorScheme="blue"
              onClick={updateMarketingPreferences}
              isLoading={updating}
              loadingText="Updating..."
              mt={4}
              isDisabled={preferences?.marketing_opt_in === marketingOptIn}
            >
              Update Preferences
            </Button>

            {error && (
              <Alert status="error" mt={4}>
                <AlertIcon />
                <Box>
                  <AlertTitle>Update Failed</AlertTitle>
                  <AlertDescription>
                    {error}
                    <br />
                    <br />
                    <Text fontSize="sm">
                      If you're having trouble with the automatic opt-in, you can manually subscribe to our mailing list:
                    </Text>
                    <Button
                      as="a"
                      href="https://mail.wpsteward.com/subscription?f=WX9MYpCEmxmKjfH5kyB5Luf892RDKti892dRIylFAknOdyQUHgvlyt9WdjIJUNbvR5Ns"
                      target="_blank"
                      rel="noopener noreferrer"
                      colorScheme="blue"
                      size="sm"
                      mt={2}
                    >
                      Subscribe Now
                    </Button>
                  </AlertDescription>
                </Box>
              </Alert>
            )}
          </Box>

          {/* Verse Sets */}
          <Box
            px={4}
            py={5}
            bg={cardBg}
            rounded="lg"
            border="1px"
            borderColor={borderColor}
          >
            <Heading size="md" mb={4}>Add Verse Sets</Heading>
            <Text color={useColorModeValue('gray.600', 'gray.300')} mb={4}>
              Need some new verses? Select a "verse set" for your personal list.
            </Text>
            
            <FormControl>
              <Select 
                value={selectedVerseSet}
                onChange={(e) => setSelectedVerseSet(e.target.value)}
                placeholder="Choose a verse set to add"
                size={{ base: "md", md: "lg" }}
              >
                {Object.entries(verseSetDescriptions).map(([key, description]) => (
                  <option key={key} value={key}>
                    {description.name} <Badge colorScheme="blue" ml={2}>(includes {description.description})</Badge>
                  </option>
                ))}
              </Select>
              <FormHelperText color={useColorModeValue('gray.600', 'gray.300')}>
                {selectedVerseSet && verseSetDescriptions[selectedVerseSet as keyof typeof verseSetDescriptions] && (
                  <Text>
                    {verseSetDescriptions[selectedVerseSet as keyof typeof verseSetDescriptions].description}
                  </Text>
                )}
              </FormHelperText>
            </FormControl>

            <Button 
              colorScheme="green" 
              onClick={addVerseSet}
              isLoading={addingVerseSet}
              loadingText="Adding Verse Set..."
              isDisabled={!selectedVerseSet}
              size={{ base: "md", md: "lg" }}
              width={{ base: "full", md: "auto" }}
              mt={4}
            >
              Add Verse Set to My Collection
            </Button>

            {verseSetError && (
              <Alert status="error" mt={4}>
                <AlertIcon />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{verseSetError}</AlertDescription>
              </Alert>
            )}
          </Box>
          </SimpleGrid>

          {/* Notification Management (Super Admin Only) */}
          {isSuperAdmin && (
            <>
              <Box
                px={4}
                py={5}
                bg={cardBg}
                rounded="lg"
                border="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Notification Settings</Heading>
                <Text color={useColorModeValue('gray.600', 'gray.300')} mb={4}>
                  Manage which types of notifications are sent to ben@wpsteward.com
                </Text>
                
                {loadingNotifications ? (
                  <Box textAlign="center" py={4}>
                    <Spinner size="lg" />
                    <Text mt={2}>Loading notification settings...</Text>
                  </Box>
                ) : (
                  <VStack spacing={4} align="stretch">
                    {notificationSettings.map((setting) => (
                      <FormControl key={setting.notification_type}>
                        <HStack justify="space-between">
                          <Box>
                            <FormLabel htmlFor={`notification-${setting.notification_type}`} color={useColorModeValue('gray.800', 'gray.100')}>
                              {setting.notification_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </FormLabel>
                            <FormHelperText color={useColorModeValue('gray.600', 'gray.300')}>
                              {setting.notification_type === 'new_user' && 'Notify when new users register'}
                              {setting.notification_type === 'verse_mastered' && 'Notify when users master verses'}
                              {setting.notification_type === 'guess_streak' && 'Notify when users reach 100+ word guess streaks'}
                              {setting.notification_type === 'login_streak' && 'Notify when users reach significant login streaks'}
                              {setting.notification_type === 'marketing_error' && 'Notify when marketing email opt-ins fail'}
                              {setting.notification_type === 'system_error' && 'Notify when system errors occur'}
                            </FormHelperText>
                          </Box>
                          <Switch
                            id={`notification-${setting.notification_type}`}
                            isChecked={setting.enabled}
                            onChange={(e) => {
                              const updatedSettings = notificationSettings.map(s => 
                                s.notification_type === setting.notification_type 
                                  ? { ...s, enabled: e.target.checked }
                                  : s
                              );
                              updateNotificationSettings(updatedSettings);
                            }}
                            colorScheme="blue"
                            size="lg"
                            isDisabled={updatingNotifications}
                          />
                        </HStack>
                      </FormControl>
                    ))}
                  </VStack>
                )}
              </Box>

              <Box
                px={4}
                py={5}
                bg={cardBg}
                rounded="lg"
                border="1px"
                borderColor={borderColor}
              >
                <Heading size="md" mb={4}>Notification Logs</Heading>
                <Text color={useColorModeValue('gray.600', 'gray.300')} mb={4}>
                  Recent notification activity (last 100 entries)
                </Text>
                
                {loadingNotifications ? (
                  <Box textAlign="center" py={4}>
                    <Spinner size="lg" />
                    <Text mt={2}>Loading notification logs...</Text>
                  </Box>
                ) : (
                  <VStack spacing={3} align="stretch" maxH="400px" overflowY="auto">
                    {notificationLogs.length === 0 ? (
                      <Text color={useColorModeValue('gray.500', 'gray.400')} textAlign="center" py={4}>
                        No notification logs found
                      </Text>
                    ) : (
                      notificationLogs.map((log) => (
                        <Box
                          key={log.id}
                          p={3}
                          bg={useColorModeValue('white', 'gray.600')}
                          borderRadius="md"
                          border="1px"
                          borderColor={log.success ? 'green.200' : 'red.200'}
                        >
                          <HStack justify="space-between" mb={2}>
                            <Text fontWeight="bold" fontSize="sm">
                              {log.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Text>
                            <Badge colorScheme={log.success ? 'green' : 'red'} size="sm">
                              {log.success ? 'Success' : 'Failed'}
                            </Badge>
                          </HStack>
                          <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.300')}>
                            {new Date(log.sent_at).toLocaleString()}
                          </Text>
                          {log.user_email && (
                            <Text fontSize="xs" color={useColorModeValue('gray.600', 'gray.300')}>
                              User: {log.user_email}
                            </Text>
                          )}
                          {!log.user_email && (
                            <Text fontSize="xs" color={useColorModeValue('gray.500', 'gray.400')}>
                              User: Email not available
                            </Text>
                          )}
                          {log.details && (
                            <Box mt={2} p={2} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                              <Text fontSize="xs" fontWeight="bold" mb={1}>Details:</Text>
                              {(() => {
                                try {
                                  const details = JSON.parse(log.details);
                                  switch (log.type) {
                                    case 'new_user':
                                      const verseSetName = details.verseSet ? 
                                        details.verseSet.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                                        'None (Default signup)';
                                      const newUserTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {newUserTime} EST</Text>
                                          <Text fontSize="xs">Email: {log.user_email || 'Not available'}</Text>
                                          <Text fontSize="xs">Verse Set: {verseSetName}</Text>
                                          <Text fontSize="xs">User ID: {log.user_id}</Text>
                                        </VStack>
                                      );
                                    case 'verse_mastered':
                                      const verseMasteredTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {verseMasteredTime} EST</Text>
                                          <Text fontSize="xs">Reference: {details.reference}</Text>
                                          <Text fontSize="xs">Translation: {details.translation}</Text>
                                        </VStack>
                                      );
                                    case 'guess_streak':
                                      const guessStreakTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {guessStreakTime} EST</Text>
                                          <Text fontSize="xs">Streak: {details.streak} words</Text>
                                          <Text fontSize="xs">Previous Best: {details.previousBest}</Text>
                                        </VStack>
                                      );
                                    case 'login_streak':
                                      const loginStreakTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {loginStreakTime} EST</Text>
                                          <Text fontSize="xs">Streak: {details.streak} days</Text>
                                          <Text fontSize="xs">Previous Best: {details.previousBest}</Text>
                                        </VStack>
                                      );
                                    case 'marketing_error':
                                      const marketingErrorTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {marketingErrorTime} EST</Text>
                                          <Text fontSize="xs">Error: {details.error}</Text>
                                        </VStack>
                                      );
                                    case 'system_error':
                                      const systemErrorTime = new Date(log.sent_at).toLocaleString('en-US', {
                                        timeZone: 'America/New_York',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                      });
                                      return (
                                        <VStack align="start" spacing={1}>
                                          <Text fontSize="xs">Time: {systemErrorTime} EST</Text>
                                          <Text fontSize="xs">Error: {details.error}</Text>
                                          <Text fontSize="xs">Context: {details.context}</Text>
                                        </VStack>
                                      );
                                    default:
                                      return (
                                        <Text fontSize="xs" fontFamily="mono">
                                          {JSON.stringify(details, null, 2)}
                                        </Text>
                                      );
                                  }
                                } catch (e) {
                                  return (
                                    <Text fontSize="xs" color="red.500">
                                      Invalid JSON: {log.details}
                                    </Text>
                                  );
                                }
                              })()}
                            </Box>
                          )}
                          {!log.success && log.error_message && (
                            <Text fontSize="xs" color="red.500" mt={1}>
                              Error: {log.error_message}
                            </Text>
                          )}
                        </Box>
                      ))
                    )}
                  </VStack>
                )}
              </Box>
            </>
          )}

          <Box
            px={4}
            py={5}
            bg={cardBg}
            rounded="lg"
            border="1px"
            borderColor={borderColor}
          >
            <Heading size="md" mb={4}>Privacy</Heading>
            <Text color={useColorModeValue('gray.600', 'gray.300')}>
              We respect your privacy. Your email address is only used for the purposes you've explicitly consented to.
              You can unsubscribe from marketing emails at any time by changing your preferences above.
            </Text>
          </Box>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
};

export default Settings; 