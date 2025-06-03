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
- `VERSE_ADDED`: 100 points for adding a new verse
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
  "turnstileToken": "token-from-cloudflare-turnstile"
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

3. **Session Token**
   - Generated as UUID upon successful magic link verification
   - Stored in database with 30-day expiration
   - Used in Authorization header for all subsequent requests
   - Automatically invalidated after expiration
   - Can be manually invalidated by deleting user

### Session Management

- Magic links expire after 15 minutes
- Session tokens are valid for 30 days
- Sessions are stored in the database and can be invalidated server-side
- Each session is associated with a specific user and device

### Security Features

1. **Cloudflare Turnstile**
   - Required for magic link requests
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

5. **Email Enumeration Protection**
   - Identical responses for existing/non-existing users
   - No indication of account existence in error messages
   - Rate limiting per email address 

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
- Awards 100 points for adding a verse

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
   - Adding a verse awards 100 points
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

### Point System

The API implements a point system with the following rewards:

1. **Verse Addition**
   - 100 points for adding a new verse
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