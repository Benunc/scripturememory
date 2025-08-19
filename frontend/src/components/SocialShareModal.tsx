import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  Text,
  IconButton,
  useToast,
  useColorModeValue,
  Box,
  Divider,
  Badge
} from '@chakra-ui/react';
import { 
  ExternalLinkIcon,
  CopyIcon,
  EmailIcon
} from '@chakra-ui/icons';
import { FaTwitter, FaFacebook, FaLinkedin, FaWhatsapp } from 'react-icons/fa';
import { 
  saveAchievementForSharing, 
  markAchievementAsShared, 
  clearPendingAchievement,
  type AchievementData 
} from '../utils/achievements';
import { 
  shareToPlatform, 
  copyToClipboard, 
  getPlatformDisplayName,
  type SocialPlatform 
} from '../utils/socialSharing';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementData;
}

export function SocialShareModal({ isOpen, onClose, achievement }: SocialShareModalProps) {
  const [isCopying, setIsCopying] = useState(false);
  const toast = useToast();
  
  // Color mode values
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedTextColor = useColorModeValue('gray.600', 'gray.300');

  // Platform configurations with icons
  const platforms: Array<{ platform: SocialPlatform; label: string; color: string; icon: React.ComponentType }> = [
    { platform: 'twitter', label: 'X', color: '#1DA1F2', icon: FaTwitter },
    { platform: 'facebook', label: 'Facebook', color: '#1877F2', icon: FaFacebook },
    { platform: 'linkedin', label: 'LinkedIn', color: '#0A66C2', icon: FaLinkedin },
    { platform: 'whatsapp', label: 'WhatsApp', color: '#25D366', icon: FaWhatsapp },
    { platform: 'email', label: 'Email', color: '#EA4335', icon: EmailIcon }
  ];

  const handleShare = async (platform: SocialPlatform) => {
    try {
      // Share to platform
      shareToPlatform(platform, achievement.streak);
      
      // Mark as shared
      markAchievementAsShared();
      
      // Show success toast
      toast({
        title: 'Shared successfully!',
        description: `Your achievement has been shared on ${getPlatformDisplayName(platform)}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Error sharing to platform:', error);
      toast({
        title: 'Sharing failed',
        description: 'There was an error sharing your achievement. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCopyToClipboard = async () => {
    setIsCopying(true);
    try {
      const success = await copyToClipboard(achievement.streak);
      
      if (success) {
        toast({
          title: 'Copied to clipboard!',
          description: 'Your achievement message has been copied to your clipboard.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error('Copy failed');
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: 'Copy failed',
        description: 'There was an error copying to clipboard. Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsCopying(false);
    }
  };

  const handleDismiss = () => {
    // Clear the pending achievement
    clearPendingAchievement();
    onClose();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader color={textColor}>
          🎉 Share Your Achievement!
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Achievement Summary */}
            <Box textAlign="center" p={4} bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="md">
              <Badge colorScheme="blue" fontSize="lg" mb={2}>
                New Record!
              </Badge>
              <Text fontSize="2xl" fontWeight="bold" color={textColor}>
                {achievement.streak} Words
              </Text>
              <Text fontSize="sm" color={mutedTextColor}>
                Achieved on {formatDate(achievement.achieved_at)}
              </Text>
            </Box>

            <Divider />

            {/* Share Message Preview */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color={textColor} mb={2}>
                Share this message:
              </Text>
              <Box 
                p={3} 
                bg={useColorModeValue('gray.50', 'gray.700')} 
                borderRadius="md"
                fontSize="sm"
                color={mutedTextColor}
                maxH="100px"
                overflowY="auto"
              >
                🎉 I just got {achievement.streak} words correct in a row memorizing scripture with Scripture Memory! 

                Hiding God's Word in my heart, one verse at a time. 📖✨

                Try it yourself: https://scripture.wpsteward.com
              </Box>
            </Box>

            <Divider />

            {/* Social Platform Buttons */}
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color={textColor} mb={3}>
                Share on social media:
              </Text>
              <HStack spacing={3} justify="center" wrap="wrap">
                {platforms.map(({ platform, label, color, icon: Icon }) => (
                  <Button
                    key={platform}
                    aria-label={`Share on ${getPlatformDisplayName(platform)}`}
                    colorScheme="gray"
                    variant="outline"
                    size="md"
                    onClick={() => handleShare(platform)}
                    leftIcon={<Icon />}
                    _hover={{
                      bg: color,
                      color: 'white',
                      borderColor: color
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </HStack>
            </Box>

            {/* Copy to Clipboard Button */}
            <Box textAlign="center">
              <Button
                leftIcon={<CopyIcon />}
                onClick={handleCopyToClipboard}
                isLoading={isCopying}
                loadingText="Copying..."
                variant="outline"
                colorScheme="blue"
              >
                Copy Message
              </Button>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={handleDismiss}>
              Maybe Later
            </Button>
            <Button 
              leftIcon={<ExternalLinkIcon />}
              colorScheme="blue" 
              onClick={() => handleShare('twitter')}
            >
              Share Now
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
} 