# Verse Streaks Implementation Plan

## Overview

Currently, the app tracks guess streaks globally across all verses, which can be demotivating for users who have achieved very long streaks on specific verses. This plan introduces verse streak tracking to encourage users to try new verses while maintaining motivation for their existing achievements.

## Current Database Structure Analysis

### Existing Tables
- **`user_stats`**: Contains global streak tracking
  - `longest_word_guess_streak` (global best)
  - `current_verse_streak` (current verse being practiced)
  - `current_verse_reference` (which verse is being practiced)
- **`verse_mastery`**: Tracks mastery progress per verse
  - `current_streak` (mastery streak, not guess streak)
  - `longest_streak` (mastery streak, not guess streak)
- **`point_events`**: Records all point-earning events
  - `event_type`: 'word_correct', 'verse_added', etc.
  - `metadata`: JSON with streak information

### Current Streak Logic
- Global `longest_word_guess_streak` tracks best across all verses
- `current_verse_streak` tracks current verse being practiced
- Streaks reset when switching verses or making mistakes

## Proposed Solution

### 1. Database Schema Changes

#### New Table: `verse_streaks`
```sql
CREATE TABLE IF NOT EXISTS verse_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verse_reference TEXT NOT NULL,
  longest_guess_streak INTEGER NOT NULL DEFAULT 0,
  current_guess_streak INTEGER NOT NULL DEFAULT 0,
  last_guess_date INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, verse_reference)
);
```

#### Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_verse_streaks_user ON verse_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_verse_streaks_verse ON verse_streaks(verse_reference);
CREATE INDEX IF NOT EXISTS idx_verse_streaks_user_verse ON verse_streaks(user_id, verse_reference);
```

### 2. Backend API Changes

#### New Endpoints
- `GET /api/verses/{reference}/streak` - Get streak info for specific verse
- `GET /api/verses/streaks` - Get all verse streaks for user
- `POST /api/verses/{reference}/streak/reset` - Reset streak for specific verse

#### Modified Endpoints
- `POST /api/gamification/points` - Update to handle per-verse streaks
- `GET /api/gamification/stats` - Include per-verse streak data

#### Gamification Logic Updates
- Track current verse being practiced
- Update verse streak when words are guessed correctly
- Reset verse streak when mistakes are made
- Maintain global streak for overall achievements
- Handle verse switching (pause one streak, resume another)

### 3. Frontend Changes

#### PointsContext Updates
- Add `currentVerseStreak` state
- Add `currentVerseReference` state
- Add `verseStreaks` state (map of verse reference to streak data)
- Add functions to update verse streaks
- Display both global and verse-specific streaks

#### VerseList Component Updates
- Show current verse streak alongside global streak
- Display verse streak on verse cards
- Handle streak switching when changing verses
- Update streak display in real-time

#### PointsStats Page Updates
- Add section showing top verse streaks
- Show verse-specific achievements
- Add social sharing for verse streaks

#### Verse Cards Updates
- Display longest streak for each verse
- Show streak progress indicator
- Add visual cues for high-performing verses

### 4. User Experience Design

#### Streak Display Strategy
1. **Active Verse**: Show both current verse streak and global best
2. **Verse Cards**: Show longest streak achieved on each verse
3. **Points Page**: Show top 5 verse streaks and global best
4. **Social Sharing**: Allow sharing both global and verse-specific achievements

#### Motivation Features
- **Verse Streak Badges**: Visual indicators for 10, 25, 50, 100+ word streaks
- **Progressive Goals**: Encourage users to improve streaks on different verses
- **Streak Comparison**: Show how current verse streak compares to global best
- **Achievement Unlocking**: Special achievements for maintaining streaks across multiple verses

### 5. Implementation Phases

#### Phase 1: Database & Backend Foundation
1. Create migration for `verse_streaks` table
2. Update gamification logic to track verse streaks
3. Add new API endpoints for verse streak data
4. Update existing endpoints to include verse streak information
5. Add comprehensive tests for new functionality

#### Phase 2: Frontend Integration
1. Update PointsContext with verse streak state
2. Modify VerseList to display verse streaks
3. Update verse cards to show streak information
4. Add streak switching logic when changing verses
5. Update real-time streak display

#### Phase 3: Enhanced Features
1. Add verse streak badges and visual indicators
2. Implement verse-specific social sharing
3. Add streak comparison features
4. Create achievement system for verse streaks
5. Add streak analytics and progress tracking

#### Phase 4: Polish & Optimization
1. Performance optimization for streak calculations
2. Add streak export/import functionality
3. Implement streak backup and recovery
4. Add advanced streak analytics
5. User testing and feedback integration

### 6. Technical Considerations

#### Data Migration
- Create `verse_streaks` table with empty initial state
- No historical data migration - streaks will only be tracked for verses attempted after the feature is deployed
- Existing users will start with clean slate for verse streaks
- Global streak data remains unchanged and continues to work as before

#### Performance
- Index optimization for frequent streak lookups
- Caching strategy for verse streak data
- Efficient streak calculation algorithms

#### Consistency
- Ensure streak data consistency across global and verse-specific tracking
- Handle edge cases (verse deletion, user deletion, etc.)
- Maintain data integrity during concurrent operations

#### Backward Compatibility
- Maintain existing global streak functionality
- Ensure existing social sharing continues to work
- Preserve current user achievements and progress

### 7. Testing Strategy

#### Unit Tests
- Verse streak calculation logic
- Streak switching behavior
- Edge cases and error conditions
- API endpoint functionality

#### Integration Tests
- End-to-end streak tracking workflow
- Database consistency checks
- Frontend-backend synchronization
- Performance under load

#### User Acceptance Tests
- Streak display accuracy
- User interface intuitiveness
- Motivation and engagement metrics
- Social sharing functionality

### 8. Success Metrics

#### Engagement Metrics
- Increase in verse variety (users trying more verses)
- Higher retention rates for new users
- Increased time spent practicing
- More social sharing of achievements

#### Technical Metrics
- Database query performance
- API response times
- Error rates and data consistency
- User feedback and satisfaction scores

### 9. Risk Mitigation

#### Data Loss Prevention
- Comprehensive backup strategy
- Data validation and integrity checks
- Rollback procedures for failed migrations

#### Performance Impact
- Gradual rollout with monitoring
- Performance testing before full deployment
- Optimization strategies for high-traffic scenarios

#### User Experience
- A/B testing for UI changes
- User feedback collection
- Iterative improvement based on usage data

## Conclusion

This plan provides a comprehensive approach to implementing verse streaks while maintaining the existing global streak system. The phased implementation allows for careful testing and validation at each step, ensuring a smooth user experience and robust technical foundation.

The key benefits include:
- **Increased motivation** for trying new verses
- **Preserved achievements** for existing long streaks
- **Enhanced engagement** through verse-specific goals
- **Improved social sharing** with more granular achievements
- **Better user retention** through progressive challenges

This implementation will transform the app from a global streak competition to a more nuanced system that encourages both depth (long streaks on favorite verses) and breadth (trying new verses and building streaks across multiple passages). 