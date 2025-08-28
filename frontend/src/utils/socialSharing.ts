// Social sharing utilities

export interface ShareMessage {
  text: string;
  url: string;
}

export type SocialPlatform = 'twitter' | 'facebook' | 'linkedin' | 'whatsapp' | 'email';

// Platform-specific share URLs
const SHARE_URLS = {
  twitter: 'https://twitter.com/intent/tweet',
  facebook: 'https://www.facebook.com/sharer/sharer.php',
  linkedin: 'https://www.linkedin.com/sharing/share-offsite',
  whatsapp: 'https://wa.me',
  email: 'mailto:'
};

// App URL for sharing
const APP_URL = 'https://scripture.wpsteward.com';

/**
 * Generate message templates for different social platforms
 */
export function generateShareMessages(streak: number): Record<SocialPlatform, ShareMessage> {
  const messages = {
    twitter: {
      text: `🎉 Can you beat my longest streak of ${streak} words correct in a row? 

Try it yourself: ${APP_URL}`,
      url: APP_URL
    },
    facebook: {
      text: `🎉 Can you beat my longest streak of ${streak} words correct in a row? 

Try it yourself: ${APP_URL}`,
      url: APP_URL
    },
    linkedin: {
      text: `📈 Personal Achievement: ${streak}-Word Scripture Memory Streak

My personal best is a ${streak}-word streak while memorizing scripture using Scripture Memory. This tool has revolutionized my approach to scripture memorization through its innovative gamification system.

Key benefits I've experienced:
• Consistent daily practice
• Measurable progress tracking
• Community accountability
• Engaging learning experience

For anyone interested in strengthening their spiritual discipline through technology, I recommend checking out: ${APP_URL}

#ScriptureMemory #PersonalDevelopment #Faith #Technology`,
      url: APP_URL
    },
    whatsapp: {
      text: `🎉 Can you beat my longest streak of ${streak} words correct in a row? 

This app has been amazing for helping me stay consistent with scripture memorization. The gamification keeps it engaging and I can actually see my progress improving.

Thought you might be interested in trying it too: ${APP_URL}`,
      url: APP_URL
    },
    email: {
      text: `Hey! I just wanted to share that I reached a ${streak}-word streak while memorizing scripture using Scripture Memory.

This app has been amazing for helping me stay consistent with scripture memorization. The gamification keeps it engaging and I can actually see my progress improving.

Thought you might be interested in trying it too: ${APP_URL}`,
      url: APP_URL
    }
  };

  return messages;
}

/**
 * Generate share URL for a specific platform
 */
export function generateShareUrl(platform: SocialPlatform, message: string, url: string): string {
  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent(url);
  
  switch (platform) {
    case 'twitter':
      return `${SHARE_URLS.twitter}?text=${encodedMessage}`;
    case 'facebook':
      return `${SHARE_URLS.facebook}?u=${encodedUrl}&quote=${encodedMessage}`;
    case 'linkedin':
      return `${SHARE_URLS.linkedin}?url=${encodedUrl}&title=${encodeURIComponent('Scripture Memory Achievement')}&summary=${encodedMessage}`;
    case 'whatsapp':
      return `${SHARE_URLS.whatsapp}?text=${encodedMessage}`;
    case 'email':
      return `${SHARE_URLS.email}?subject=${encodeURIComponent('Scripture Memory Achievement')}&body=${encodedMessage}`;
    default:
      return '';
  }
}

/**
 * Share to a specific platform
 */
export function shareToPlatform(platform: SocialPlatform, streak: number): void {
  const messages = generateShareMessages(streak);
  const message = messages[platform];
  const shareUrl = generateShareUrl(platform, message.text, message.url);
  
  if (shareUrl) {
    // Open in new window/tab
    window.open(shareUrl, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
  }
}

/**
 * Copy share message to clipboard
 */
export async function copyToClipboard(streak: number, platform: SocialPlatform = 'twitter'): Promise<boolean> {
  try {
    const messages = generateShareMessages(streak);
    const message = messages[platform];
    const fullMessage = `${message.text}`;
    
    await navigator.clipboard.writeText(fullMessage);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

/**
 * Get platform display names
 */
export function getPlatformDisplayName(platform: SocialPlatform): string {
  const names = {
    twitter: 'Twitter/X',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    whatsapp: 'WhatsApp',
    email: 'Email'
  };
  
  return names[platform];
}

/**
 * Get platform icon names (for Chakra UI icons)
 */
export function getPlatformIconName(platform: SocialPlatform): string {
  const icons = {
    twitter: 'FaTwitter',
    facebook: 'FaFacebook',
    linkedin: 'FaLinkedin',
    whatsapp: 'FaWhatsapp',
    email: 'FaEnvelope'
  };
  
  return icons[platform];
} 