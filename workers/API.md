# Scripture Memory API Documentation

## Overview

The Scripture Memory API is a RESTful API built with Cloudflare Workers and D1 SQLite database. It provides endpoints for managing scripture verses, tracking user progress, and implementing gamification features.

### Base URL

- Development: `http://localhost:8787`
- Production: `https://scripture-memory.ben-2e6.workers.dev`

### Authentication

All endpoints (except authentication endpoints) require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

### CORS

The API supports CORS and includes the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

### Rate Limiting

- Magic link requests are limited to 5 requests per minute per email
- Other endpoints are limited to 100 requests per minute per user

### Response Format

All responses are in JSON format with the following structure:
```json
{
  "data": {}, // Response data (if successful)
  "error": "Error message" // Error message (if failed)
}
```

### Common HTTP Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `204 No Content`: Request succeeded, no response body
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

### Point System

The API implements a point system with the following rewards:
- `VERSE_ADDED`: 10 points for adding a new verse (limited to 3 per day)
- `WORD_CORRECT`: 1 point per correct word
- `STREAK_MULTIPLIER`: 50% bonus per word in streak
- `MASTERY_ACHIEVED`: 500 points for mastering a verse
- `DAILY_STREAK`: 50 points for maintaining daily streak

### Mastery System

Verses can be mastered by meeting these criteria:
1. Minimum 5 attempts with at least 80% accuracy
2. 3 consecutive perfect attempts (100% accuracy)
3. Perfect attempts must be at least 24 hours apart

When mastery is achieved:
- Verse status is updated to "mastered"
- User receives 500 points
- Mastery is recorded in the database
- User stats are updated

Note: While the API accepts attempts with any accuracy, the frontend enforces a minimum of 80% accuracy before sending attempts to the API. This ensures that only meaningful attempts are recorded towards mastery.

## Authentication

The API uses a magic link authentication system. Users sign in by requesting a magic link sent to their email address.

### Endpoints

#### Request Magic Link
```http
POST /auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "isRegistration": false,
  "turnstileToken": "token-from-cloudflare-turnstile",
  "verseSet": "optional-verse-set-code",
  "groupCode": "optional-group-code"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "If an account exists with this email, you will receive a magic link shortly. Check your spam folder if you don't see it.",
  "email": "user@example.com"
}
```

**Security Note**: The same response is returned whether the email exists or not. This prevents email enumeration attacks by not revealing which emails are registered in the system.

**Rate Limiting**
- Limited to 5 requests per minute per email
- Returns 429 Too Many Requests when limit is exceeded

**Verse Set Feature**
- Optional `verseSet` parameter can be included to specify a predefined set of verses
- If provided, the verse set will be automatically added to new user accounts during registration
- Available verse sets: `default`, `childrens_verses`, `gpc_youth`
- If no verse set is specified, the `default` set is used for new users

**Group Code Feature**
- Optional `groupCode` parameter can be included to automatically join a group upon authentication
- The `groupCode` can be either a group name or group ID
- If provided, the user will be automatically added to the specified group during registration or login
- Works for both new user registration and existing user login
- If the group doesn't exist, the authentication will still succeed but no group joining will occur
- If the user is already a member of the group, no duplicate membership is created

#### Verify Magic Link
```http
GET /auth/verify?token=<magic-link-token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "token": "session-token",
  "email": "user@example.com"
}
```

**Response (400 Bad Request)**
```json
{
  "error": "Invalid or expired token"
}
```

#### Sign Out
```http
POST /auth/sign-out
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

**Features**
- Invalidates the current session token
- Removes the token from the database
- No error is returned if the token was already invalid
- Client should clear local storage after successful sign-out

**Error Responses**
- `401 Unauthorized`: Missing or invalid Authorization header
- `500 Internal Server Error`: Server error during sign-out process

#### Add Verse Set to Existing User
```http
POST /auth/add-verses
Content-Type: application/json

{
  "email": "user@example.com",
  "verseSet": "verse-set-code",
  "turnstileToken": "token-from-cloudflare-turnstile"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Successfully added 3 verses from gpc_youth",
  "added": 3,
  "total": 6,
  "verses": ["Deuteronomy 29:29", "Proverbs 1:7", "Psalm 119:105"]
}
```

**Features**
- Adds a predefined verse set to an existing user's account
- Requires Cloudflare Turnstile verification for security
- Only adds verses the user doesn't already have
- Returns count of verses added and total verses in the set
- Available verse sets: `default`, `childrens_verses`, `gpc_youth`

**Error Responses**
- `400 Bad Request`: Missing required fields or invalid Turnstile token
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error during verse addition

#### Delete User Account
```http
DELETE /auth/delete
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

**Features**
- Permanently deletes the user's account
- Removes all user data including verses, progress, and stats
- Invalidates all active sessions
- Cannot be undone
- Requires valid authentication token

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error during deletion

### Authentication Flow

1. **Sign In vs Registration**
   - Both flows use the same `/auth/magic-link` endpoint
   - `isRegistration` flag determines the behavior:
     - `false`: Only sends magic link if user exists
     - `true`: Creates new user if doesn't exist, then sends magic link
   - Same response message is returned in both cases for security

2. **Magic Link Process**
   - Magic link token is a UUID generated server-side
   - Token is stored in database with 15-minute expiration
   - Email is sent with link containing token
   - Token is single-use and deleted after verification
   - In development, token is logged to console instead of sending email
   - Optional verse set is stored with the magic link for new user registration

3. **Session Token**
   - Generated as UUID upon successful magic link verification
   - Stored in database with 30-day expiration
   - Used in Authorization header for all subsequent requests
   - Automatically invalidated after expiration
   - Can be manually invalidated by deleting user or signing out

### Session Management

- Magic links expire after 15 minutes
- Session tokens are valid for 30 days
- Sessions are stored in the database and can be invalidated server-side
- Each session is associated with a specific user and device
- Users can manually sign out to invalidate their session

### Security Features

1. **Cloudflare Turnstile**
   - Required for magic link requests and verse set addition
   - Prevents automated abuse

2. **Rate Limiting**
   - Prevents brute force attacks
   - Protects against email spam

3. **Secure Headers**
   - CORS protection
   - Content-Type validation
   - Authorization header validation

4. **Session Security**
   - UUID-based tokens
   - Server-side session storage
   - Automatic expiration
   - One-time use magic links
   - Manual session invalidation

5. **Email Enumeration Protection**
   - Identical responses for existing/non-existing users
   - No indication of account existence in error messages
   - Rate limiting per email address

### Available Verse Sets

The API provides several predefined verse sets that can be used during registration or added to existing accounts:

1. **default** (3 verses)
   - John 3:16
   - Philippians 4:13
   - Jeremiah 29:11

2. **childrens_verses** (3 verses)
   - Genesis 1:1
   - Psalm 119:105
   - Proverbs 3:5

3. **gpc_youth** (6 verses)
   - Deuteronomy 29:29
   - Proverbs 1:7
   - Psalm 119:105
   - Proverbs 3:5
   - Colossians 3:23
   - Romans 12:1

## Verses

The API provides endpoints for managing scripture verses. Each verse is associated with a specific user and includes metadata about its translation and status.

### Data Model

```typescript
interface Verse {
  reference: string;    // Unique identifier (e.g., "John 3:16")
  text: string;         // The verse text
  translation: string;  // Bible translation (e.g., "NIV", "NKJV")
  status: string;       // Progress status: "not_started" | "in_progress" | "mastered"
  created_at?: number;  // Timestamp of creation
}
```

### Endpoints

#### List Verses
```http
GET /verses
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
[
  {
    "reference": "John 3:16",
    "text": "For God so loved the world...",
    "translation": "NIV",
    "status": "active",
    "created_at": 1234567890
  }
]
```

#### Add Verse
```http
POST /verses
Authorization: Bearer <token>
Content-Type: application/json

{
  "reference": "John 3:16",
  "text": "For God so loved the world...",
  "translation": "NIV"
}
```

**Response (201 Created)**
- Empty response with 201 status code
- Awards 10 points for adding a verse (limited to 3 verses per day)

**Error Responses**
- `400 Bad Request`: Missing required fields
- `409 Conflict`: Verse already exists for user
- `401 Unauthorized`: Invalid or missing token

#### Delete Verse
```http
DELETE /verses/:reference
Authorization: Bearer <token>
```

**Response (204 No Content)**
- Empty response with 204 status code
- Requires verse ownership

**Error Responses**
- `400 Bad Request`: Missing reference
- `404 Not Found`: Verse not found
- `401 Unauthorized`: Invalid or missing token

#### Update Verse
```http
PUT /verses/:reference
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Updated verse text...",
  "translation": "NIV"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Verse updated successfully"
}
```

**Features**
- Updates an existing verse's text and/or translation
- Requires verse ownership
- Validates that the verse exists
- URL-encode the reference in the path

**Error Responses**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Verse not found or unauthorized

### Features

1. **Reference Uniqueness**
   - Each verse reference must be unique per user
   - References are case-sensitive
   - URL-encoded in API requests

2. **Ownership**
   - Verses are tied to specific users
   - Users can only access their own verses
   - All operations verify user ownership

3. **Points Integration**
   - Adding a verse awards 10 points (limited to 3 verses per day)
   - Points are tracked in user stats
   - Points events are recorded for history

4. **Error Handling**
   - Detailed error messages
   - Proper HTTP status codes
   - Consistent error response format

### Best Practices

1. **Reference Format**
   - Use consistent format (e.g., "Book Chapter:Verse")
   - Include spaces between components
   - URL-encode references in requests

2. **Translation Codes**
   - Use standard translation codes (e.g., "NIV", "NKJV")
   - Be consistent with translation codes
   - Include translation in all verse operations

3. **Error Handling**
   - Check for 401 responses to handle expired sessions
   - Handle 409 conflicts for duplicate verses
   - Implement proper error recovery

4. **Performance**
   - Verses are ordered by creation date
   - Efficient database queries
   - Proper indexing on reference and user_id 

## Progress

The API provides endpoints for tracking word-by-word progress and verse attempts. These endpoints are used to record user progress and trigger mastery achievements.

### Data Models

```typescript
interface WordProgress {
  verse_reference: string;  // Reference of the verse being practiced
  word_index: number;       // Index of the word in the verse
  word: string;            // The word being practiced
  is_correct: boolean;     // Whether the word was correctly recalled
  created_at?: number;     // Optional timestamp (defaults to current time)
}

interface VerseAttempt {
  verse_reference: string;  // Reference of the verse being attempted
  words_correct: number;    // Number of words correctly recalled
  total_words: number;      // Total number of words in the verse
  created_at?: number;      // Optional timestamp (defaults to current time)
}
```

### Endpoints

#### Record Word Progress
```http
POST /progress/word
Authorization: Bearer <token>
Content-Type: application/json

{
  "verse_reference": "John 3:16",
  "word_index": 0,
  "word": "For",
  "is_correct": true
}
```

**Response (200 OK)**
```json
{
  "success": true
}
```

**Features**
- Records individual word progress
- Awards 1 point per correct word
- Updates user stats and streak
- Records point events for correct words

**Error Responses**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Verse not found or unauthorized

#### Record Verse Attempt
```http
POST /progress/verse
Authorization: Bearer <token>
Content-Type: application/json

{
  "verse_reference": "John 3:16",
  "words_correct": 15,
  "total_words": 20
}
```

**Response (200 OK)**
```json
{
  "success": true
}
```

**Features**
- Records complete verse attempts
- Awards points for correct words
- Updates user stats and streak
- Checks for mastery achievement
- Records point events for attempts

**Error Responses**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Verse not found or unauthorized

#### Check Mastery Progress
```http
GET /progress/mastery/:reference
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "total_attempts": 5,
  "overall_accuracy": 0.95,
  "consecutive_perfect": 3,
  "is_mastered": true,
  "mastery_date": 1234567890
}
```

**Features**
- Returns mastery progress for a specific verse
- Calculates overall accuracy across all attempts
- Tracks consecutive perfect attempts
- Indicates if verse is mastered
- Includes mastery date if achieved

**Error Responses**
- `400 Bad Request`: Missing reference
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Verse not found or unauthorized

### Mastery System

Verses can be mastered by meeting these criteria:
1. Minimum 5 attempts with at least 80% accuracy
2. 3 consecutive perfect attempts (100% accuracy)
3. Perfect attempts must be at least 24 hours apart

When mastery is achieved:
- Verse status is updated to "mastered"
- User receives 500 points
- Mastery is recorded in the database
- User stats are updated

Note: While the API accepts attempts with any accuracy, the frontend enforces a minimum of 80% accuracy before sending attempts to the API. This ensures that only meaningful attempts are recorded towards mastery.

### Best Practices

1. **Word Progress**
   - Record progress for each word individually
   - Include word index for accurate tracking
   - Use consistent word boundaries
   - Handle punctuation appropriately

2. **Verse Attempts**
   - Record attempts after completing the verse
   - Include accurate word counts
   - Track both correct and total words
   - Use consistent timestamp handling

3. **Error Handling**
   - Handle 401 responses for expired sessions
   - Validate verse references before recording
   - Check for missing required fields
   - Implement proper error recovery

4. **Performance**
   - Efficient database queries
   - Proper indexing on user_id and verse_reference
   - Batch processing for multiple words
   - Optimized mastery checks 

## Gamification

The API provides endpoints for managing points, streaks, and user statistics. These features encourage consistent practice and track user progress.

### Data Models

```typescript
interface UserStats {
  total_points: number;      // Total points earned
  current_streak: number;    // Current daily streak
  longest_streak: number;    // Longest daily streak achieved
  verses_mastered: number;   // Number of verses mastered
  total_attempts: number;    // Total verse attempts
  last_activity_date: number; // Timestamp of last activity
}

interface PointEvent {
  event_type: string;       // Type of event (e.g., 'verse_added', 'word_correct')
  points: number;           // Points awarded
  metadata?: Record<string, unknown>; // Event-specific data
  created_at?: number;      // Optional timestamp
}
```

### Endpoints

#### Get User Stats
```http
GET /gamification/stats?timestamp=<optional-timestamp>
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "total_points": 1500,
  "current_streak": 5,
  "longest_streak": 10,
  "verses_mastered": 3,
  "total_attempts": 25,
  "last_activity_date": 1234567890
}
```

**Features**
- Returns current user statistics
- Updates streak based on activity
- Optional timestamp parameter for historical stats
- Creates initial stats if none exist

**Error Responses**
- `401 Unauthorized`: Invalid or missing token

#### Record Point Event
```http
POST /gamification/points
Authorization: Bearer <token>
Content-Type: application/json

{
  "event_type": "verse_added",
  "points": 100,
  "metadata": {
    "verse_reference": "John 3:16"
  }
}
```

**Response (200 OK)**
```json
{
  "success": true
}
```

**Features**
- Records point events with metadata
- Updates user stats
- Updates streak
- Creates initial stats if none exist

**Error Responses**
- `400 Bad Request`: Missing required fields
- `401 Unauthorized`: Invalid or missing token

#### Get Time-Based User Statistics
```http
GET /gamification/time-based-stats?timeframe=this_month&user_id=123
Authorization: Bearer <token>
```

**Query Parameters:**
- `timeframe` (optional): Time period for stats calculation
  - `all` (default): All-time statistics
  - `this_week`: Current week (Sunday to today)
  - `last_week`: Previous week (Sunday to Saturday)
  - `this_month`: Current month only
  - `last_month`: Previous month only
  - `this_year`: Current year only
  - `last_year`: Previous year only
  - `custom`: Custom date range (requires `start_date` and `end_date`)
- `start_date` (required if `timeframe=custom`): Start date in `YYYY-MM-DD` format
- `end_date` (required if `timeframe=custom`): End date in `YYYY-MM-DD` format
- `user_id` (optional): Target user ID (defaults to authenticated user)

**Custom Date Example:**
```http
GET /gamification/time-based-stats?timeframe=custom&start_date=2024-07-01&end_date=2024-07-07
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "timeframe": "this_month",
  "start_time": 1704067200000,
  "end_time": 1706745599999,
  "stats": {
    "total_points": 450,
    "total_events": 25,
    "verses_mastered": 2,
    "total_attempts": 15,
    "perfect_attempts": 8,
    "accuracy": 0.87,
    "current_streak": 5,
    "longest_streak": 10
  },
  "breakdown": {
    "mastery_points": 1000,
    "word_points": 200,
    "verse_points": 30,
    "streak_points": 100
  }
}
```

**Features**
- Returns time-based user statistics for the specified period
- Calculates points earned, verses mastered, and attempts within the timeframe
- Provides accuracy percentage based on words correct vs total words attempted
- Includes detailed breakdown of points by category
- Supports querying other users' stats (for admins)
- Current streak and longest streak are always current (not time-based)

**Error Responses**
- `400 Bad Request`: Invalid timeframe parameter, missing or invalid custom date parameters
- `401 Unauthorized`: Invalid or missing token

#### Get Time-Based Group Leaderboard
```http
GET /gamification/leaderboard/:groupId?timeframe=this_month&metric=points&direction=desc
Authorization: Bearer <token>
```

**Path Parameters:**
- `groupId`: Group ID for which to get leaderboard

**Query Parameters:**
- `timeframe` (optional): Time period for leaderboard calculation
  - `all` (default): All-time rankings
  - `this_week`: Current week (Sunday to today)
  - `last_week`: Previous week (Sunday to Saturday)
  - `this_month`: Current month only
  - `last_month`: Previous month only
  - `this_year`: Current year only
  - `last_year`: Previous year only
  - `custom`: Custom date range (requires `start_date` and `end_date`)
- `start_date` (required if `timeframe=custom`): Start date in `YYYY-MM-DD` format
- `end_date` (required if `timeframe=custom`): End date in `YYYY-MM-DD` format
- `metric` (optional): Ranking metric
  - `points` (default): Total points earned
  - `verses_mastered`: Number of verses mastered
- `direction` (optional): Sort direction
  - `desc` (default): Descending order (highest to lowest)
  - `asc`: Ascending order (lowest to highest)

**Custom Date Example:**
```http
GET /gamification/leaderboard/1?timeframe=custom&start_date=2024-07-01&end_date=2024-07-07&metric=points
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "user_id": 123,
      "display_name": "john@example.com (John Doe)",
      "metric_value": 450,
      "total_events": 25,
      "is_public": true
    },
    {
      "rank": 2,
      "user_id": 456,
      "display_name": "jane@example.com (Jane Smith)",
      "metric_value": 380,
      "total_events": 20,
      "is_public": true
    }
  ],
  "metadata": {
    "total_members": 10,
    "participating_members": 8,
    "metric": "points",
    "timeframe": "this_month",
    "start_time": 1704067200000,
    "end_time": 1706745599999
  }
}
```

**Features**
- Shows rankings based on selected metric within the specified timeframe
- Respects privacy settings (admins see emails, regular members see display names or "Anonymous")
- Handles ties properly (same rank for equal values)
- Includes metadata about participation and time boundaries
- Only accessible to group members or super admins
- Supports multiple metrics for different types of competition

**Error Responses**
- `400 Bad Request`: Invalid metric or timeframe parameter, missing group ID
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a member of the group
- `404 Not Found`: Group not found

### Point System

The API implements a point system with the following rewards:

1. **Verse Addition**
   - 10 points for adding a new verse (limited to 3 verses per day)
   - One-time reward per verse

2. **Word Progress**
   - 1 point per correct word
   - Base reward for practice

3. **Streak Bonus**
   - 50% bonus per word in streak
   - Encourages daily practice

4. **Mastery Achievement**
   - 500 points for mastering a verse
   - Major milestone reward

5. **Daily Streak**
   - 50 points for maintaining streak
   - Rewards consistent practice

### Streak System

The streak system tracks daily practice:

1. **Streak Rules**
   - Activity must occur on consecutive days
   - Multiple activities on same day count as one
   - Streak resets if a day is missed
   - Streak starts at 1 on first activity

2. **Streak Rewards**
   - Points awarded for streaks > 1 day
   - Longest streak is tracked
   - Streak bonus affects word points

### Best Practices

1. **Stats Management**
   - Check stats before major operations
   - Use timestamps for historical data
   - Handle missing stats gracefully
   - Update stats atomically

2. **Point Events**
   - Record events with detailed metadata
   - Use consistent event types
   - Include timestamps for tracking
   - Validate point values

3. **Streak Handling**
   - Update streaks before operations
   - Use UTC dates for consistency
   - Handle timezone differences
   - Track streak milestones

4. **Performance**
   - Efficient database queries
   - Proper indexing on user_id and dates
   - Batch updates when possible
   - Cache frequently accessed stats 

## Groups

The API provides endpoints for managing groups, which allow users to organize around verse sets and participate in leaderboards. Groups support leadership management, member invitations, and membership tracking.

### Data Models

```typescript
interface Group {
  id: number;
  name: string;
  description?: string;
  created_at: number;
  created_by: number;
}

interface GroupMember {
  group_id: number;
  user_id: number;
  role: 'creator' | 'leader' | 'member';
  joined_at: number;
  is_active: boolean;
}

interface GroupInvitation {
  id: number;
  group_id: number;
  email: string;
  invited_by: number;
  expires_at: number;
  is_accepted: boolean;
}

interface CreateGroupRequest {
  name: string;
  description?: string;
}

interface AssignLeaderRequest {
  email: string;
}

interface InviteMemberRequest {
  email: string;
}

interface JoinGroupRequest {
  invitationId: number;
}
```

### Endpoints

#### Create Group
```http
POST /groups/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Study Group",
  "description": "A group for studying scripture together"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "id": 1,
  "name": "My Study Group",
  "description": "A group for studying scripture together",
  "created_at": 1234567890
}
```

**Features**
- Creates a new group with the specified name and description
- Group creator automatically becomes a member with 'creator' role
- Validates group name length (2-50 characters)
- Prevents duplicate group names
- Returns the created group ID

**Error Responses**
- `400 Bad Request`: Invalid group name or description
- `401 Unauthorized`: Invalid or missing token
- `409 Conflict`: Group name already exists

#### Get Group Leaders
```http
GET /groups/{id}/leaders
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "leaders": [
    {
      "user_id": 1,
      "email": "creator@example.com",
      "role": "creator",
      "joined_at": 1234567890
    },
    {
      "user_id": 2,
      "email": "leader@example.com",
      "role": "leader",
      "joined_at": 1234567891
    }
  ]
}
```

**Features**
- Returns all group members with 'creator' or 'leader' roles
- Includes user email and join date
- Only accessible to group members
- Sorted by join date

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a member of the group
- `404 Not Found`: Group not found

#### Assign Group Leader
```http
POST /groups/{id}/leaders
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newleader@example.com"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Leader assigned successfully"
}
```

**Features**
- Assigns a user as a leader of the group
- Super admins can assign leaders to any group
- Group creators/leaders can assign leaders to their own groups
- User must exist in the system
- Prevents duplicate leader assignments
- User becomes a member if not already one
- Updates existing member role if user is already a member

**Error Responses**
- `400 Bad Request`: User not found or already a leader
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to assign leaders
- `404 Not Found`: Group not found

#### Demote Group Leader
```http
POST /groups/{id}/leaders/demote
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "leader@example.com"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Leader demoted to member successfully"
}
```

**Features**
- Demotes a leader back to a regular member
- Super admins can demote leaders in any group
- Group creators/leaders can demote leaders in their own groups
- Cannot demote creators (only leaders can be demoted)
- User must exist in the system and be a leader

**Error Responses**
- `400 Bad Request`: User is not a leader or is a creator (creators cannot be demoted)
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to demote leaders
- `404 Not Found`: Group or user not found

#### Invite Group Member
```http
POST /groups/{id}/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newmember@example.com"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Invitation sent successfully"
}
```

**Features**
- Sends an invitation to join the group
- Only creators/leaders can invite members
- Invitations expire after 7 days
- Prevents duplicate invitations
- Prevents inviting existing members
- User must exist in the system

**Error Responses**
- `400 Bad Request`: User not found, already a member, or invitation already exists
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to invite members
- `404 Not Found`: Group not found

#### Join Group
```http
POST /groups/{id}/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "invitationId": 123
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Successfully joined group"
}
```

**Features**
- Accepts an invitation to join a group
- Requires valid invitation ID
- Invitation must match user's email
- Invitation must not be expired or already accepted
- User becomes a member with 'member' role
- Marks invitation as accepted

**Error Responses**
- `400 Bad Request`: Invalid invitation ID or expired invitation
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Group not found

#### Get Group Members
```http
GET /groups/{id}/members
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "members": [
    {
      "user_id": 1,
      "member_email": "creator@example.com",
      "role": "creator",
      "joined_at": 1234567890
    },
    {
      "user_id": 2,
      "member_email": "member@example.com",
      "role": "member",
      "joined_at": 1234567891
    }
  ]
}
```

**Features**
- Returns all active group members
- Includes user email, role, and join date
- Only accessible to group members
- Sorted by join date
- Excludes inactive members

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a member of the group
- `404 Not Found`: Group not found

#### Update Display Name
```http
PUT /groups/{id}/members/{userId}/display-name
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "New Display Name"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Display name updated successfully"
}
```

**Features**
- Updates a member's display name in the group
- Only the member themselves or group leaders can update display names
- Validates display name format (2-30 characters, letters, numbers, spaces, hyphens only)
- Prevents duplicate display names within the same group
- Display names are used in leaderboards instead of email addresses

**Error Responses**
- `400 Bad Request`: Invalid display name format or already taken
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to update this display name
- `404 Not Found`: Group or member not found

#### Get Member Profile
```http
GET /groups/{id}/members/{userId}/profile
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "profile": {
    "user_id": 123,
    "display_name": "John Doe",
    "email": "john@example.com",
    "role": "member",
    "joined_at": 1234567890,
    "is_public": true
  }
}
```

**Features**
- Returns a member's profile information
- Group leaders can view any member's profile
- Regular members can only view public profiles or their own
- Includes display name, email, role, join date, and privacy settings
- Respects privacy settings (is_public flag)

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Profile is private or user lacks access
- `404 Not Found`: Group or member not found

#### Update Privacy Settings
```http
PUT /groups/{id}/members/{userId}/privacy
Authorization: Bearer <token>
Content-Type: application/json

{
  "isPublic": false
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Privacy settings updated successfully"
}
```

**Features**
- Updates a member's privacy settings in the group
- Only the member themselves or group leaders can update privacy settings
- Controls whether the member appears in leaderboards and member lists
- Private members are hidden from other members but visible to leaders

**Error Responses**
- `400 Bad Request`: Invalid privacy setting
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to update this privacy setting
- `404 Not Found`: Group or member not found

#### Get Group Leaderboard
```http
GET /groups/{id}/leaderboard?metric=points&timeframe=all
Authorization: Bearer <token>
```

**Query Parameters:**
- `metric`: `points`, `verses_mastered`, `current_streak`, `longest_streak` (default: `points`)
- `timeframe`: `all`, `week`, `month`, `year` (default: `all`)

**Response (200 OK)**
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "user_id": 123,
      "display_name": "John Doe",
      "points": 1500,
      "verses_mastered": 5,
      "current_streak": 7,
      "longest_streak": 12,
      "is_public": true
    },
    {
      "rank": 2,
      "user_id": 456,
      "display_name": "Jane Smith",
      "points": 1200,
      "verses_mastered": 4,
      "current_streak": 5,
      "longest_streak": 8,
      "is_public": true
    }
  ],
  "metadata": {
    "total_members": 10,
    "participating_members": 8,
    "metric": "points",
    "timeframe": "all"
  }
}
```

**Features**
- Shows rankings based on selected metric (points, verses mastered, streaks)
- Respects privacy settings (only shows public members)
- Supports time-based filtering (all-time, weekly, monthly, yearly)
- Handles ties properly (same rank for equal values)
- Includes metadata about participation and filtering
- Only accessible to group members

**Error Responses**
- `400 Bad Request`: Invalid metric or timeframe parameter
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a member of the group
- `404 Not Found`: Group not found

#### Get Group Statistics
```http
GET /groups/{id}/stats
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "stats": {
    "total_members": 15,
    "active_members": 12,
    "total_points": 8500,
    "total_verses_mastered": 45,
    "average_points_per_member": 567,
    "top_performer": {
      "user_id": 123,
      "display_name": "John Doe",
      "points": 1500
    },
    "recent_activity": {
      "new_members_this_week": 2,
      "verses_mastered_this_week": 8,
      "points_earned_this_week": 1200
    }
  }
}
```

**Features**
- Provides comprehensive group performance metrics
- Shows total and active member counts
- Calculates group-wide totals and averages
- Identifies top performer (highest points)
- Tracks recent activity (last 7 days)
- Only accessible to group members
- Helps leaders understand group engagement

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User is not a member of the group
- `404 Not Found`: Group not found

#### Get Member's Group Ranking
```http
GET /groups/{id}/members/{userId}/ranking
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "ranking": {
    "user_id": 123,
    "display_name": "John Doe",
    "rank": 3,
    "total_members": 15,
    "percentile": 80,
    "metrics": {
      "points": 1200,
      "verses_mastered": 4,
      "current_streak": 5,
      "longest_streak": 12
    },
    "next_rank": {
      "rank": 2,
      "points_needed": 150
    }
  }
}
```

**Features**
- Shows individual member's ranking and percentile
- Includes all relevant metrics (points, verses mastered, streaks)
- Calculates progress toward next rank
- Respects privacy settings (can only view public members or own ranking)
- Provides motivational information for improvement
- Only accessible to group members

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Member profile is private or user lacks access
- `404 Not Found`: Group, member, or ranking not found

### Group Roles and Permissions

1. **Creator Role**
   - Automatically assigned to group creator
   - Can assign leaders
   - Can invite members
   - Can manage group settings
   - Cannot be removed or changed

2. **Leader Role**
   - Can assign other leaders
   - Can invite members
   - Can manage group activities
   - Assigned by creators or other leaders

3. **Member Role**
   - Can view group information
   - Can participate in group activities
   - Cannot invite or assign leaders
   - Assigned when joining via invitation

### Best Practices

1. **Group Management**
   - Use descriptive group names
   - Provide clear group descriptions
   - Assign multiple leaders for redundancy
   - Monitor group activity regularly

2. **Invitation System**
   - Send invitations to existing users only
   - Set appropriate expiration times
   - Handle expired invitations gracefully
   - Prevent invitation spam

3. **Permission Handling**
   - Always verify user permissions
   - Check role hierarchy
   - Handle permission errors gracefully
   - Log permission changes

4. **Data Integrity**
   - Maintain referential integrity
   - Handle user deletions gracefully
   - Clean up expired invitations
   - Validate all inputs

## Error Handling and Common Patterns

This section covers common error scenarios and patterns for working with the API effectively.

### Error Responses

All error responses follow this format:
```json
{
  "error": "Error message describing what went wrong"
}
```

#### Common Error Scenarios

1. **Authentication Errors (401)**
   ```json
   {
     "error": "Unauthorized"
   }
   ```
   - Missing Authorization header
   - Invalid or expired token
   - Token not found in database

2. **Validation Errors (400)**
   ```json
   {
     "error": "Missing required fields"
   }
   ```
   - Missing required fields in request
   - Invalid field values
   - Malformed request body

3. **Not Found Errors (404)**
   ```json
   {
     "error": "Verse not found or unauthorized"
   }
   ```
   - Resource doesn't exist
   - User doesn't have access to resource
   - Invalid reference or ID

4. **Conflict Errors (409)**
   ```json
   {
     "error": "Verse already exists for user"
   }
   ```
   - Duplicate resources
   - Concurrent modifications
   - Unique constraint violations

5. **Server Errors (500)**
   ```json
   {
     "error": "Internal Server Error"
   }
   ```
   - Database errors
   - Unexpected exceptions
   - Service unavailability

### Common Patterns

1. **Authentication Flow**
   ```typescript
   // 1. Request magic link
   const magicLinkResponse = await fetch('/auth/magic-link', {
     method: 'POST',
     body: JSON.stringify({ email, isRegistration: false })
   });

   // 2. Verify magic link and get session token
   const verifyResponse = await fetch(`/auth/verify?token=${magicLinkToken}`);
   const { token } = await verifyResponse.json();

   // 3. Use token in subsequent requests
   const versesResponse = await fetch('/verses', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

2. **Verse Management**
   ```typescript
   // 1. Add verse
   const addResponse = await fetch('/verses', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({
       reference: 'John 3:16',
       text: 'For God so loved the world...',
       translation: 'NIV'
     })
   });

   // 2. Record progress
   const progressResponse = await fetch('/progress/word', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${token}` },
     body: JSON.stringify({
       verse_reference: 'John 3:16',
       word_index: 0,
       word: 'For',
       is_correct: true
     })
   });

   // 3. Check stats
   const statsResponse = await fetch('/gamification/stats', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

3. **Error Handling**
   ```typescript
   async function handleApiRequest(url: string, options: RequestInit) {
     try {
       const response = await fetch(url, options);
       if (!response.ok) {
         const error = await response.json();
         switch (response.status) {
           case 401:
             // Handle authentication error
             // Redirect to login or refresh token
             break;
           case 400:
             // Handle validation error
             // Show error message to user
             break;
           case 404:
             // Handle not found error
             // Show appropriate message
             break;
           default:
             // Handle other errors
             console.error('API Error:', error);
         }
         throw new Error(error.error);
       }
       return await response.json();
     } catch (error) {
       // Handle network errors or other exceptions
       console.error('Request failed:', error);
       throw error;
     }
   }
   ```

4. **Rate Limiting**
   ```typescript
   // Handle rate limit responses
   if (response.status === 429) {
     const retryAfter = response.headers.get('Retry-After');
     // Wait for specified time before retrying
     await new Promise(resolve => 
       setTimeout(resolve, parseInt(retryAfter || '60') * 1000)
     );
     // Retry request
     return handleApiRequest(url, options);
   }
   ```

### Best Practices

1. **Request Handling**
   - Always include Authorization header
   - Set appropriate Content-Type
   - Handle all possible error responses
   - Implement retry logic for transient errors

2. **Data Validation**
   - Validate data before sending
   - Handle missing or invalid fields
   - Use consistent data formats
   - Sanitize user input

3. **Error Recovery**
   - Implement proper error boundaries
   - Show user-friendly error messages
   - Log errors for debugging
   - Handle network failures gracefully

4. **Performance**
   - Cache responses when appropriate
   - Batch related requests
   - Use pagination for large datasets
   - Implement request debouncing 

#### List User's Groups
```http
GET /groups/mine
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "groups": [
    {
      "id": 1,
      "name": "My Study Group",
      "description": "A group for studying scripture together",
      "role": "creator",
      "member_count": 5
    },
    {
      "id": 2,
      "name": "Youth Group",
      "description": "Youth ministry group",
      "role": "member",
      "member_count": 12
    }
  ]
}
```

**Features**
- Returns all groups the authenticated user is a member of
- Includes user's role in each group
- Shows member count for each group
- Groups are sorted by creation date (newest first)
- Only returns active groups

**Error Responses**
- `401 Unauthorized`: Invalid or missing token

#### Get Group by Code
```http
GET /groups/info/:code
```

**Response (200 OK)**
```json
{
  "group": {
    "id": 1,
    "name": "My Study Group",
    "description": "A group for studying scripture together",
    "created_at": 1234567890
  }
}
```

**Response (404 Not Found)**
```json
{
  "error": "Group not found"
}
```

**Features**
- Retrieves group information by group code (name or ID)
- No authentication required - public endpoint
- Supports both group names and numeric IDs
- Returns basic group information without member details
- Useful for verifying group existence before joining
- URL-encoded group codes are automatically decoded

**Parameters**
- `:code` - Group name or group ID (URL-encoded if needed)

**Error Responses**
- `400 Bad Request`: Missing group code
- `404 Not Found`: Group not found
- `500 Internal Server Error`: Server error

#### Get Invitation Details
```http
GET /groups/invitations/:id
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "invitation": {
    "id": 123,
    "group_id": 1,
    "email": "user@example.com",
    "invited_by": 456,
    "expires_at": 1234567890,
    "is_accepted": false,
    "group_name": "My Study Group",
    "group_description": "A group for studying scripture together",
    "inviter_email": "leader@example.com"
  }
}
```

**Features**
- Returns detailed information about a specific invitation
- Includes group information and inviter details
- Only returns active, unexpired invitations
- Useful for displaying invitation details to users

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Invitation not found or expired

#### Get Invitation Details by Code
```http
GET /groups/invitations/code/:code
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "invitation": {
    "id": 123,
    "group_id": 1,
    "email": "user@example.com",
    "invited_by": 456,
    "expires_at": 1234567890,
    "is_accepted": false,
    "invitation_code": "ABC123XY",
    "group_name": "My Study Group",
    "group_description": "A group for studying scripture together",
    "inviter_email": "leader@example.com"
  }
}
```

**Features**
- Returns detailed information about an invitation using its code
- Includes the invitation code in the response
- Only returns active, unexpired invitations
- Useful for verifying invitation codes before joining

**Error Responses**
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Invitation not found or expired

#### Get Existing Invitation
```http
POST /groups/:id/invitations/existing
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response (200 OK)**
```json
{
  "invitation": {
    "id": 123,
    "code": "ABC123XY",
    "expires_at": 1234567890,
    "is_accepted": false
  }
}
```

**Response (404 Not Found)**
```json
{
  "error": "No active invitation found for this email"
}
```

**Features**
- Checks if an active invitation exists for a specific email
- Returns invitation details if found
- Returns 404 if no active invitation exists
- Useful for preventing duplicate invitations

**Error Responses**
- `400 Bad Request`: Missing email
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to check invitations
- `404 Not Found`: No active invitation found

#### Join Group by Invitation Code
```http
POST /groups/:id/join/:code
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Successfully joined group"
}
```

**Features**
- Accepts an invitation using the invitation code
- Requires valid invitation code that matches user's email
- Invitation must not be expired or already accepted
- User becomes a member with 'member' role
- Marks invitation as accepted

**Error Responses**
- `400 Bad Request`: Invalid invitation code or expired invitation
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Group not found

## API Endpoint Summary

This section provides a quick reference to all available endpoints organized by category.

### Authentication Endpoints
- `POST /auth/magic-link` - Request magic link for sign in/registration
- `GET /auth/verify` - Verify magic link and get session token
- `POST /auth/sign-out` - Sign out and invalidate session
- `DELETE /auth/delete` - Delete user account
- `POST /auth/add-verses` - Add verse set to existing user

### Verse Management Endpoints
- `GET /verses` - List user's verses
- `POST /verses` - Add new verse
- `PUT /verses/:reference` - Update existing verse
- `DELETE /verses/:reference` - Delete verse

### Progress Tracking Endpoints
- `POST /progress/word` - Record word-by-word progress
- `POST /progress/verse` - Record complete verse attempt
- `GET /progress/mastery/:reference` - Check mastery progress

### Gamification Endpoints
- `GET /gamification/stats` - Get user statistics
- `POST /gamification/points` - Record point event
- `GET /gamification/time-based-stats` - Get time-based user statistics
- `GET /gamification/leaderboard/:groupId` - Get time-based group leaderboard

### Group Management Endpoints
- `POST /groups/create` - Create new group
- `GET /groups/mine` - List user's groups
- `GET /groups/info/:code` - Get group information by code (name or ID)
- `GET /groups/:id/leaders` - Get group leaders
- `POST /groups/:id/leaders` - Assign group leader
- `POST /groups/:id/invite` - Invite member to group
- `POST /groups/:id/join` - Join group with invitation ID
- `POST /groups/:id/join/:code` - Join group with invitation code
- `GET /groups/:id/members` - Get group members
- `PUT /groups/:id/members/:userId/display-name` - Update member display name
- `GET /groups/:id/members/:userId/profile` - Get member profile
- `PUT /groups/:id/members/:userId/privacy` - Update member privacy settings
- `GET /groups/:id/leaderboard` - Get group leaderboard
- `GET /groups/:id/stats` - Get group statistics
- `GET /groups/:id/members/:userId/ranking` - Get member's group ranking

### Invitation Management Endpoints
- `GET /groups/invitations/:id` - Get invitation details by ID
- `GET /groups/invitations/code/:code` - Get invitation details by code
- `POST /groups/:id/invitations/existing` - Check for existing invitation

## Database Schema Overview

The API uses the following main database tables:

### Core Tables
- `users` - User accounts and authentication
- `sessions` - Active user sessions
- `magic_links` - Magic link tokens for authentication (includes verse_set and group_code for automatic setup)
- `verses` - User's scripture verses
- `word_progress` - Word-by-word progress tracking
- `verse_attempts` - Complete verse attempt records
- `user_stats` - User statistics and gamification data
- `point_events` - Point event history

### Group Tables
- `groups` - Group information
- `group_members` - Group membership and roles
- `group_invitations` - Group invitation system

### Mastery Tables
- `mastered_verses` - Verses that have been mastered
- `verse_streaks` - Streak tracking for verses

## Development and Deployment

### Environment Variables
- `DB` - D1 database binding
- `JWT_SECRET` - Secret for JWT tokens
- `EMAIL_API_KEY` - Email service API key
- `TURNSTILE_SECRET` - Cloudflare Turnstile secret

### Local Development
1. Set up Wrangler CLI
2. Create local D1 database: `wrangler d1 create scripture-memory-dev`
3. Run migrations: `wrangler d1 migrations apply scripture-memory-dev`
4. Start dev server: `wrangler dev`

### Production Deployment
1. Deploy to Cloudflare Workers: `wrangler deploy`
2. Apply production migrations: `wrangler d1 migrations apply scripture-memory-prod`

### Testing
- Use the provided test scripts in the `workers/tests/` directory
- Test all endpoints with proper authentication
- Verify error handling and edge cases
- Test rate limiting and security features

## Security Considerations

1. **Authentication**
   - All endpoints (except auth) require Bearer token
   - Tokens expire after 30 days
   - Magic links expire after 15 minutes
   - Sessions can be invalidated server-side

2. **Rate Limiting**
   - Magic link requests: 5 per minute per email
   - Other endpoints: 100 per minute per user
   - Prevents abuse and spam

3. **Data Protection**
   - User data is isolated by user_id
   - Group members can only access their group data
   - Privacy settings control data visibility
   - No sensitive data in URLs or logs

4. **Input Validation**
   - All inputs are validated server-side
   - SQL injection protection via prepared statements
   - XSS protection via proper content types
   - File upload restrictions

## Monitoring and Maintenance

### Key Metrics to Monitor
- API response times
- Error rates by endpoint
- Authentication success/failure rates
- Group activity and engagement
- Database performance

### Regular Maintenance Tasks
- Clean up expired sessions and magic links
- Archive old point events
- Monitor group invitation expiration
- Update rate limiting rules as needed
- Review and update security policies

### Troubleshooting Common Issues
1. **Authentication Errors**: Check token expiration and session validity
2. **Rate Limiting**: Implement exponential backoff for retries
3. **Database Errors**: Check D1 database status and connection limits
4. **CORS Issues**: Verify origin headers and preflight requests
5. **Group Permission Errors**: Verify user roles and group membership

This API documentation should provide comprehensive guidance for developers working with the Scripture Memory application. For additional support, refer to the source code and test files in the repository.

## Admin Endpoints

### Get All Users (Admin Only)
- **GET** `/admin/users`
- **Description**: Get all users in the system (admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List of all users with their stats

### Get All Groups (Admin Only)
- **GET** `/admin/groups`
- **Description**: Get all groups in the system (admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List of all groups with member counts

### Get All Permissions (Admin Only)
- **GET** `/admin/permissions`
- **Description**: Get all user permissions in the system (admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List of all user permissions

### Get User Permissions (Admin Only)
- **GET** `/admin/permissions/user/:userId`
- **Description**: Get permissions for a specific user (admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List of permissions for the specified user

### Get Audit Log (Admin Only)
- **GET** `/admin/audit-log`
- **Description**: Get admin audit log (admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: List of admin actions with timestamps

### Grant Permission (Admin Only)
- **POST** `/admin/permissions/grant`
- **Description**: Grant a permission to a user (admin only)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Body**: `{ "targetUserId": number, "permissionType": string, "expiresAt": number? }`
- **Response**: Success message

### Revoke Permission (Admin Only)
- **POST** `/admin/permissions/revoke`
- **Description**: Revoke a permission from a user (admin only)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Body**: `{ "targetUserId": number, "permissionType": string }`
- **Response**: Success message

### Check Super Admin Status
- **GET** `/admin/check-super-admin`
- **Description**: Check if the current user is a super admin
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "isSuperAdmin": boolean }`

### Delete Group (Super Admin Only)
- **DELETE** `/admin/groups/:id/delete`
- **Description**: Delete a group and all its members (super admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Success message with group name

### Remove Member from Group (Super Admin or Group Leader/Creator)
- **DELETE** `/admin/groups/:id/members/:memberId/remove`
- **Description**: Remove a member from a group (super admin or group leader/creator)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: Success message with member email and group name
- **Permissions**: 
  - Super admins can remove members from any group
  - Group leaders/creators can remove members from groups they lead
  - Leaders/creators cannot remove themselves (super admins can)

### Get User Verses (Super Admin Only)
- **GET** `/admin/users/:id/verses`
- **Description**: Get all verses for a specific user (super admin only)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: User information, all their verses with status, and user stats
- **Response Format**:
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com"
  },
  "verses": [
    {
      "reference": "John 3:16",
      "text": "For God so loved the world...",
      "status": "mastered",
      "last_reviewed": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "stats": {
    "total_points": 1500,
    "verses_mastered": 5,
    "current_streak": 3,
    "longest_streak": 7,
    "last_activity_date": "2024-01-15T10:30:00Z"
  }
}
```
- **Permissions**: Super admin access required
- **Error Responses**:
  - `400 Bad Request`: Invalid user ID
  - `401 Unauthorized`: Missing or invalid authentication
  - `403 Forbidden`: Super admin access required
  - `404 Not Found`: User not found 

### Assign Verse Set to User (Admin Function)
- **POST** `/verses/assign-set`
- **Description**: Assign a verse set to a specific user in a group (admin function)
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "targetUserId": 123,
  "verseSet": "default",
  "groupId": 456
}
```
- **Response**: Success message with details about the assignment
- **Permissions**: 
  - Super admins can assign verse sets to any user in any group
  - Group leaders/creators can assign verse sets to members of their groups

### Assign Verse Set to All Group Members (Super Admin or Group Leader Function)
- **POST** `/verses/assign-set-to-all-members`
- **Description**: Assign a verse set to all members of a group (super admin or group leader/creator)
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "verseSet": "default",
  "groupId": 456
}
```
- **Response**: Success message with details about the assignment to all members
- **Permissions**: 
  - Super admins can assign verse sets to all members of any group
  - Group leaders/creators can assign verse sets to all members of their groups
- **Response Format**:
```json
{
  "success": true,
  "message": "Assigned default to all 5 members of group Test Group. Total new verses added: 15",
  "details": {
    "groupName": "Test Group",
    "verseSet": "default",
    "totalMembers": 5,
    "totalVersesAdded": 15,
    "results": [
      {
        "userId": 123,
        "email": "user@example.com",
        "addedCount": 3,
        "errors": []
      }
    ]
  }
}
``` 