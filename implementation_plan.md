# Scripture Memory App Enhancement Plan

## Overview
Implementation plan for adding gamification, detailed progress tracking, and mastery system to the Scripture Memory app.

## Completed Items

### Phase 1: Database Setup
- [x] Create new tables in development
  - Created all required tables with proper relationships
  - Added necessary indexes for performance
- [x] Add indexes for performance
  - Added indexes for foreign keys
  - Added indexes for frequently queried columns
- [x] Create database migration scripts
  - Created numbered migrations (0000-0003)
  - Added safe schema changes for production
- [x] Add database indexes
  - Added indexes for word_progress
  - Added indexes for verse_attempts
  - Added indexes for point_events
- [x] Test table relationships
  - Verified all foreign key constraints
  - Tested with sample data
  - Confirmed data integrity
- [x] Verify foreign key constraints
  - Tested valid and invalid operations
  - Confirmed constraints work as expected

### Phase 2: Backend API Development
- [x] Implement user authentication endpoints
- [x] Implement verse management endpoints
- [x] Implement progress tracking endpoints
- [x] Implement gamification endpoints
- [x] Add input validation and error handling
- [x] Write API documentation
- [x] Test API endpoints
- [x] Update mastery progress endpoint to handle multiple attempts per day
  - [x] Modify endpoint to track all attempts within a day
  - [x] Update progress calculation to consider all daily attempts
  - [x] Ensure proper error handling for concurrent attempts
  - [x] Add validation for attempt timestamps
  - [x] Test with multiple attempts in same day

### Phase 3: Frontend Development - Completed Items

#### Progress Tracking UI
- [x] Update verse card with input, and change status indicators to truly reflect attempts
  - Implemented input field with proper focus management
  - Added status tracking and visual feedback
  - Improved accessibility and keyboard navigation
  - Added input sanitization and punctuation handling

#### Word Progress Tracking
- [x] Create WordProgress interface for tracking individual word attempts
- [x] Add word progress queue for batching API calls
- [x] Implement debounced sync function for word progress
- [x] Add error handling and retry logic for failed API calls
- [x] Test word progress tracking with various scenarios

#### Progress Persistence
- [x] Implement local storage for pending changes
- [x] Add sync on component unmount
- [x] Handle offline/online state changes
- [x] Add progress recovery after errors

#### API Performance Optimization
- [x] Implement request batching
- [x] Add request debouncing
- [x] Implement rate limiting handling

## Remaining Items

### Phase 1: Database Setup
- [ ] Create backup of production database (waiting until the new front end is built)
- [ ] Deploy schema changes to production (waiting until the new front end is built)

### Phase 3: Frontend Development - Remaining Items

#### Mastery Mode UI Implementation
- [ ] Add Mastery Mode toggle to verse cards
  - [ ] Design and implement subtle mastery mode button
    - [ ] Add icon with tooltip
    - [ ] Only show for verses marked as "In Progress"
    - [ ] Add smooth transition animation
  - [ ] Create expanded mastery mode view
    - [ ] Design collapsible section
    - [ ] Add attempt counter display
    - [ ] Show accuracy percentage
    - [ ] Add "Start Attempt" button
    - [ ] Include recent attempt history
  - [ ] Implement mastery mode state management
    - [ ] Add state for tracking active mastery mode
    - [ ] Handle mode transitions
    - [ ] Persist mode preference
  - [ ] Add mastery mode input interface
    - [ ] Design full verse input area
    - [ ] Add character count
    - [ ] Implement auto-expanding textarea
    - [ ] Add submit button
  - [ ] Create attempt feedback display
    - [ ] Show correct/incorrect words
    - [ ] Display attempt score
    - [ ] Show progress towards mastery
    - [ ] Add encouraging messages
  - [ ] Implement attempt history
    - [ ] Design history display
    - [ ] Show attempt dates
    - [ ] Display accuracy trends
    - [ ] Add attempt details view
  - [ ] Add mastery requirements display
    - [ ] Show minimum attempts needed
    - [ ] Display current accuracy
    - [ ] Track consecutive perfect attempts
    - [ ] Add progress indicators
  - [ ] Create mode transition animations
    - [ ] Design smooth expand/collapse
    - [ ] Add loading states
    - [ ] Implement focus management
  - [ ] Add keyboard shortcuts
    - [ ] Toggle mastery mode
    - [ ] Submit attempt
    - [ ] Navigate history
    - [ ] Return to practice mode

#### Stats Panel
- [ ] Design collapsible panel
- [ ] Create streak badge
- [ ] Implement stats display
- [ ] Add progress graphs

#### Mastery System
- [ ] Design mastery indicators
- [ ] Create celebration animations
- [ ] Implement mastery badges

#### Points and Streaks
- [ ] Design streak display
- [ ] Create point system UI
- [ ] Implement milestone celebrations

#### Progressive Disclosure
- [ ] Design feature unlock system
- [ ] Create tooltips
- [ ] Implement advanced stats hiding

#### Initial Introduction Modal to Gamification
- [ ] Create welcome modal for new features
- [ ] Focus on "Track your progress and see your growth"
- [ ] Include "Don't show again" option
- [ ] Keep introduction light and non-overwhelming

#### Add types for gamification data
- [ ] Create GamificationContext for state management

#### Add StatsPanel component
- [ ] Add StatsPanel component

#### Integrate StatsPanel into main app layout
- [ ] Integrate StatsPanel into main app layout

#### Implement progress tracking UI
- [ ] Add word-by-word progress tracking
- [ ] Add verse attempt recording
- [ ] Add progress visualization

#### Implement gamification UI
- [ ] Add point system display
- [ ] Add streak tracking
- [ ] Add mastery indicators

#### Add loading states and error handling
- [ ] Add loading states and error handling

#### Test UI components
- [ ] Test UI components

#### Optimize performance
- [ ] Optimize performance

## Phase 4: Testing and Deployment
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Perform load testing
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor performance

## Point System

### Base Points
```typescript
const POINTS = {
    VERSE_ADDED: 100,        // Big bonus for adding a new verse
    WORD_CORRECT: 1,         // Base points per correct word
    STREAK_MULTIPLIER: 0.5,  // 50% bonus per word in streak
    MASTERY_ACHIEVED: 500,   // Big bonus for mastering a verse
    DAILY_STREAK: 50,        // Bonus for maintaining daily streak
};
```

### Point Events
1. Verse Added
2. Word Correct
3. Streak Bonus
4. Mastery Achieved
5. Daily Streak

## Testing Strategy

### Unit Tests
1. Point calculation tests
2. Progress tracking tests
3. Mastery system tests
4. Database operation tests

### Integration Tests
1. End-to-end flow tests
2. API endpoint tests
3. Database integration tests
4. UI component tests

### Performance Tests
1. Database query performance
2. Point calculation performance
3. UI rendering performance
4. API response times

### Edge Cases
1. Timezone handling
2. Concurrent updates
3. Network failures
4. Data consistency
5. Performance under load

### Load Testing
1. Multiple concurrent users
2. Rapid word input
3. Point calculation under load
4. Database performance
5. UI responsiveness

## Rollback Plan

### Database Rollback
1. Drop new tables
2. Restore from backup
3. Verify data integrity

### Code Rollback
1. Revert to previous version
2. Remove new features
3. Restore old functionality

### Data Migration
1. Backup all new tables
2. Export point events
3. Save user stats
4. Document current state

### Feature Flags
1. Implement feature flags for:
   - Word-by-word tracking
   - Point system
   - Mastery system
   - Analytics

## Monitoring

### Performance Metrics
1. Database query times
2. API response times
3. Point calculation times
4. UI render times

### Error Tracking
1. Database errors
2. API errors
3. UI errors
4. Point calculation errors

### Alerts
1. Point calculation errors
2. Mastery system issues
3. Performance degradation
4. Data inconsistency

### Metrics
1. Word recognition accuracy
2. Point calculation time
3. Mastery achievement rate
4. User engagement metrics

## Documentation

### Technical Documentation
1. Database schema
2. API endpoints
3. Point system
4. Mastery system

### User Documentation
1. New features
2. Point system
3. Mastery system
4. Progress tracking

## Notes
- Keep this document updated as implementation progresses
- Add any new considerations or changes
- Track completed items
- Note any issues or challenges
- Consider implementing feature flags for gradual rollout
- Plan for data migration and backup
- Consider timezone handling from the start
- Plan for performance optimization
- Consider implementing a staging environment

## Status
- [ ] Phase 1: Database Setup
- [ ] Phase 2: Core Tracking Implementation
- [ ] Phase 3: Mastery System
- [ ] Phase 4: Gamification
- [ ] Phase 5: Analytics 

## Scope and Constraints

### Desired Outcomes
1. **Core Functionality**
   - Accurate word-by-word progress tracking
   - Reliable mastery system based on consistent practice
   - Simple but engaging point system
   - Basic analytics for user progress

2. **User Experience**
   - Clear feedback on progress
   - Motivating but not overwhelming gamification
   - Intuitive mastery requirements
   - Easy-to-understand point system

3. **Technical Goals**
   - Maintainable and testable codebase
   - Reasonable database performance
   - Reliable data consistency
   - Scalable architecture

### Out of Scope
1. **Features**
   - Social features (sharing, competitions)
   - Complex achievements beyond basic mastery
   - Multiple difficulty levels
   - Custom point rules per user
   - Offline support
   - Mobile app version

2. **Technical**
   - Real-time multiplayer features
   - Complex caching strategies
   - Advanced analytics
   - Machine learning for progress prediction
   - Custom database optimizations beyond basic indexing

3. **UI/UX**
   - Complex animations
   - Custom themes
   - Advanced visualizations
   - Mobile-specific optimizations

### Implementation Constraints
1. **Must Maintain**
   - Existing verse management functionality
   - Current user authentication
   - Basic progress tracking
   - Current UI layout and navigation

2. **Must Not Impact**
   - Existing user data
   - Current verse content
   - Basic app performance
   - Core memorization features

3. **Must Consider**
   - Database performance
   - Data consistency
   - User experience
   - Code maintainability

### Success Criteria
1. **Functional**
   - All new features work as specified
   - No regression in existing features
   - All tests pass
   - No critical bugs

2. **Performance**
   - Page load < 2 seconds
   - API response < 200ms
   - Database queries < 100ms
   - Smooth UI interactions

3. **User Experience**
   - Clear progress indicators
   - Intuitive mastery system
   - Understandable point system
   - Helpful error messages

## Database Schema Changes

### New Tables

#### 1. `point_events`
```sql
CREATE TABLE point_events (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    event_type TEXT,  -- 'verse_added', 'word_correct', 'streak_bonus', 'mastery_achieved'
    points INTEGER,
    metadata JSON,    -- Flexible field for event-specific data
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 2. `verse_attempts`
```sql
CREATE TABLE verse_attempts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    verse_reference TEXT,
    attempt_date DATE,
    words_correct INTEGER,
    total_words INTEGER,
    streak_count INTEGER,
    points_earned INTEGER,
    completed BOOLEAN,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (verse_reference) REFERENCES verses(reference)
);
```

#### 3. `verse_mastery`
```sql
CREATE TABLE verse_mastery (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    verse_reference TEXT,
    current_streak INTEGER,
    longest_streak INTEGER,
    last_mastered_date DATE,
    days_mastered INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (verse_reference) REFERENCES verses(reference)
);
```

#### 4. `word_progress`
```sql
CREATE TABLE word_progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    verse_reference TEXT,
    word_index INTEGER,
    correct_count INTEGER,
    incorrect_count INTEGER,
    last_correct_date DATE,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (verse_reference) REFERENCES verses(reference)
);
```

#### 5. `user_stats`
```sql
CREATE TABLE user_stats (
    user_id INTEGER PRIMARY KEY,
    total_points INTEGER,
    current_streak INTEGER,
    longest_streak INTEGER,
    verses_mastered INTEGER,
    total_attempts INTEGER,
    last_activity_date DATE,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Notes
- Schema changes (like adding a UNIQUE constraint) should be done in a new, numbered migration (e.g., 0003_add_unique_constraint_to_verses_reference.sql), not by modifying 0000_2_gamification_update.sql. This ensures the live DB is updated safely and reproducibly.
- All wrangler commands must specify the environment (e.g., --env development) and use the database binding name (DB) instead of the database ID. 