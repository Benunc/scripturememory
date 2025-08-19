// Achievement tracking utilities for social sharing

export interface AchievementData {
  streak: number;
  achieved_at: number;
  shared: boolean;
  share_count: number;
}

export interface SocialSharePending {
  social_share_pending: AchievementData;
}

// Minimum streak threshold for social sharing
const MIN_STREAK_FOR_SHARING = 50;

// Maximum verse length for automatic social sharing (regardless of streak)
// Short verses (≤ 10 words) will trigger social sharing even with low streaks
// Longer verses still require the 50-word minimum streak
const MAX_VERSE_LENGTH_FOR_AUTO_SHARING = 10;

/**
 * Check if a streak achievement qualifies for social sharing
 */
export function qualifiesForSocialSharing(streak: number): boolean {
  return streak >= MIN_STREAK_FOR_SHARING;
}

/**
 * Check if a verse completion qualifies for social sharing
 * For short verses (≤ 10 words), we trigger social sharing regardless of streak
 * For longer verses, we use the normal 50-word minimum
 */
export function qualifiesForVerseCompletionSharing(streak: number, verseWordCount: number): boolean {
  // For short verses, always trigger social sharing
  if (verseWordCount <= MAX_VERSE_LENGTH_FOR_AUTO_SHARING) {
    return true;
  }
  
  // For longer verses, use the normal streak threshold
  return streak >= MIN_STREAK_FOR_SHARING;
}

/**
 * Save achievement data to localStorage when user reaches a new record
 */
export function saveAchievementForSharing(streak: number): void {
  if (!qualifiesForSocialSharing(streak)) {
    return;
  }

  const achievementData: AchievementData = {
    streak,
    achieved_at: Date.now(),
    shared: false,
    share_count: 0
  };

  const socialShareData: SocialSharePending = {
    social_share_pending: achievementData
  };

  localStorage.setItem('social_share_pending', JSON.stringify(socialShareData));
}

/**
 * Save longest streak achievement for manual sharing from points page
 * Always saves the longest streak regardless of qualification thresholds
 */
export function saveLongestStreakForSharing(longestStreak: number): void {
  const achievementData: AchievementData = {
    streak: longestStreak,
    achieved_at: Date.now(),
    shared: false,
    share_count: 0
  };

  const socialShareData: SocialSharePending = {
    social_share_pending: achievementData
  };

  localStorage.setItem('social_share_pending', JSON.stringify(socialShareData));
}

/**
 * Save verse completion achievement data to localStorage
 * This can trigger social sharing for short verses regardless of streak length
 * Always uses the best streak ever for the share text, not just the completion streak
 */
export function saveVerseCompletionAchievement(streak: number, verseWordCount: number): void {
  if (!qualifiesForVerseCompletionSharing(streak, verseWordCount)) {
    return;
  }

  // Always use the best streak ever for sharing, not just the completion streak
  const bestStreakEver = Math.max(
    streak,
    parseInt(localStorage.getItem('longest_word_guess_streak') || '0', 10)
  );

  const achievementData: AchievementData = {
    streak: bestStreakEver, // Use best streak ever for sharing
    achieved_at: Date.now(),
    shared: false,
    share_count: 0
  };

  const socialShareData: SocialSharePending = {
    social_share_pending: achievementData
  };

  localStorage.setItem('social_share_pending', JSON.stringify(socialShareData));
}

/**
 * Get pending achievement data from localStorage
 */
export function getPendingAchievement(): AchievementData | null {
  try {
    const stored = localStorage.getItem('social_share_pending');
    if (!stored) {
      return null;
    }

    const data: SocialSharePending = JSON.parse(stored);
    return data.social_share_pending || null;
  } catch (error) {
    console.error('Error parsing pending achievement data:', error);
    return null;
  }
}

/**
 * Check if there's a pending achievement that hasn't been shared
 */
export function hasUnsharedAchievement(): boolean {
  const achievement = getPendingAchievement();
  return achievement !== null && !achievement.shared;
}

/**
 * Mark achievement as shared
 */
export function markAchievementAsShared(): void {
  try {
    const stored = localStorage.getItem('social_share_pending');
    if (!stored) {
      return;
    }

    const data: SocialSharePending = JSON.parse(stored);
    if (data.social_share_pending) {
      data.social_share_pending.shared = true;
      data.social_share_pending.share_count += 1;
      localStorage.setItem('social_share_pending', JSON.stringify(data));
    }
  } catch (error) {
    console.error('Error marking achievement as shared:', error);
  }
}

/**
 * Clear achievement data (after user dismisses or shares)
 */
export function clearPendingAchievement(): void {
  localStorage.removeItem('social_share_pending');
}

/**
 * Get the minimum streak threshold for social sharing
 */
export function getMinStreakForSharing(): number {
  return MIN_STREAK_FOR_SHARING;
}

/**
 * Get the maximum verse length for automatic social sharing
 */
export function getMaxVerseLengthForAutoSharing(): number {
  return MAX_VERSE_LENGTH_FOR_AUTO_SHARING;
} 