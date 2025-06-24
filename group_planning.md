# Group Management Implementation Plan

## Overview

This plan breaks down the group management feature into concrete, testable steps. Each step includes:
1. **Database migration** - Schema changes
2. **API endpoint** - Backend functionality
3. **Test script** - Verification for that specific endpoint
4. **Comprehensive test updates** - Integration with existing test suite

Each step must pass all tests before proceeding to the next step.

## ✅ COMPLETED: Steps 1 & 2 - Consolidated Groups System

### Migration: `0010_create_groups_system.sql` ✅
```sql
-- Create groups table (simple and focused)
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create unified group members table (leaders and members in one table)
CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'leader', 'creator')),
  joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);

-- Create group invitations table
CREATE TABLE group_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  invited_by INTEGER NOT NULL,
  invited_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  is_accepted BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON groups(is_active);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
CREATE INDEX IF NOT EXISTS idx_group_members_active ON group_members(is_active);
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON group_invitations(email);
CREATE INDEX IF NOT EXISTS idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_expires ON group_invitations(expires_at);
```

### Implemented Endpoints ✅
- `POST /groups/create` - Create group and add creator as member with 'creator' role
- `GET /groups/:id/leaders` - Get all group leaders (creators and leaders)
- `POST /groups/:id/leaders` - Assign new leader (creators and leaders can assign)

### Test Scripts ✅
- `test-groups-step1.sh` - Tests group creation and basic functionality
- `test-groups-step2.sh` - Tests leadership management
- `test-comprehensive.sh` - Includes comprehensive group testing

### Status: ✅ COMPLETE
- Migration applied
- Backend endpoints implemented
- Tests passing
- Comprehensive test integration complete

---

## 🔄 NEXT: Step 3 - Group Membership and Invitations

### Endpoints to Implement

#### `POST /groups/:id/invite` - Invite user to group
```typescript
// Add to handleGroups
inviteMember: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];

    const { email } = await request.json();

    if (!email || email.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);

    // Check if current user can invite (leaders and creators)
    const canInvite = await db.prepare(`
      SELECT role FROM group_members 
      WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
    `).bind(groupId, userId).first();

    if (!canInvite) {
      return new Response(JSON.stringify({ error: 'You do not have permission to invite members' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is already a member
    const existingMember = await db.prepare(`
      SELECT 1 FROM group_members WHERE group_id = ? AND user_id = (
        SELECT id FROM users WHERE email = ?
      )
    `).bind(groupId, email.trim()).first();

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'User is already a member of this group' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if invitation already exists
    const existingInvitation = await db.prepare(`
      SELECT 1 FROM group_invitations 
      WHERE group_id = ? AND email = ? AND is_accepted = FALSE AND expires_at > ?
    `).bind(groupId, email.trim(), Date.now()).first();

    if (existingInvitation) {
      return new Response(JSON.stringify({ error: 'Invitation already exists for this user' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create invitation (expires in 7 days)
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    await db.prepare(`
      INSERT INTO group_invitations (group_id, email, invited_by, expires_at)
      VALUES (?, ?, ?, ?)
    `).bind(groupId, email.trim(), userId, expiresAt).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Invitation sent successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### `POST /groups/:id/join` - Accept invitation and join group
```typescript
// Add to handleGroups
joinGroup: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];

    const { invitationId } = await request.json();

    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'Invitation ID is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);

    // Get user email
    const user = await db.prepare(`
      SELECT email FROM users WHERE id = ?
    `).bind(userId).first();

    // Verify invitation exists and is valid
    const invitation = await db.prepare(`
      SELECT * FROM group_invitations 
      WHERE id = ? AND group_id = ? AND email = ? AND is_accepted = FALSE AND expires_at > ?
    `).bind(invitationId, groupId, user.email, Date.now()).first();

    if (!invitation) {
      return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add user to group as member
    await db.prepare(`
      INSERT INTO group_members (group_id, user_id, role, joined_at)
      VALUES (?, ?, 'member', ?)
    `).bind(groupId, userId, Date.now()).run();

    // Mark invitation as accepted
    await db.prepare(`
      UPDATE group_invitations SET is_accepted = TRUE WHERE id = ?
    `).bind(invitationId).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Successfully joined group'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error joining group:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### `GET /groups/:id/members` - List group members
```typescript
// Add to handleGroups
getMembers: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];

    const db = getDB(env);

    // Get all members with their roles
    const members = await db.prepare(`
      SELECT 
        gm.user_id,
        gm.role,
        gm.joined_at,
        u.email as member_email
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
      ORDER BY gm.joined_at ASC
    `).bind(groupId).all();

    return new Response(JSON.stringify({ 
      success: true, 
      members: members.results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting members:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Test Script: `test-groups-step3.sh`
```bash
#!/bin/bash

# Test Step 3: Group Membership and Invitations
echo "Testing Step 3: Group Membership and Invitations"

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"inviter@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"invitee@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Membership Test Group","description":"Testing membership and invitations"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Test 1: Invite member
echo "Testing invite member..."
INVITE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"invitee@example.com"}')

echo "Invite response: $INVITE_RESPONSE"

if echo "$INVITE_RESPONSE" | grep -q "success"; then
    echo "✓ Invite member test passed"
else
    echo "✗ Invite member test failed"
    exit 1
fi

# Get invitation ID
INVITATION_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'invitee@example.com';" | cat | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Test 2: Join group
echo "Testing join group..."
JOIN_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"invitationId\":$INVITATION_ID}")

echo "Join response: $JOIN_RESPONSE"

if echo "$JOIN_RESPONSE" | grep -q "success"; then
    echo "✓ Join group test passed"
else
    echo "✗ Join group test failed"
    exit 1
fi

# Test 3: Get members
echo "Testing get members..."
GET_MEMBERS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Get members response: $GET_MEMBERS_RESPONSE"

if echo "$GET_MEMBERS_RESPONSE" | grep -q '"members"'; then
    echo "✓ Get members test passed"
else
    echo "✗ Get members test failed"
    exit 1
fi

# Test 4: Permission denied for non-leaders
echo "Testing permission denied for non-leaders..."
PERMISSION_DENIED_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"email":"test@example.com"}')

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "permission"; then
    echo "✓ Permission denied test passed"
else
    echo "✗ Permission denied test failed"
    exit 1
fi

echo "Step 3 completed successfully!"
```

### Update Comprehensive Test
Add to `test-comprehensive.sh` after group management tests:
```bash
# Test group membership and invitations
echo "${YELLOW}Testing group membership and invitations...${NC}"

# Invite member
INVITE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

if echo "$INVITE_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group invitation works${NC}"
else
    echo "${RED}✗ Group invitation failed${NC}"
    exit 1
fi

# Get members
GET_MEMBERS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$GET_MEMBERS_RESPONSE" | grep -q '"members"'; then
    echo "${GREEN}✓ Get members works${NC}"
else
    echo "${RED}✗ Get members failed${NC}"
    exit 1
fi
```

---

## 🔄 NEXT: Step 4 - Group Leaderboards

### Overview
Step 4 implements group leaderboards that show member rankings based on points, verses mastered, and other gamification metrics. This leverages the display names from Step 5 to show user-friendly names instead of email addresses.

### Database Changes
No new migrations needed - we'll use existing tables:
- `group_members` - for group membership and display names
- `user_stats` - for points, streaks, verses mastered
- `point_events` - for detailed point history
- `verses` - for verse mastery status

### API Endpoints to Implement

#### A. Get Group Leaderboard
```http
GET /groups/:id/leaderboard?metric=points&timeframe=all
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
      "is_public": true
    },
    {
      "rank": 2,
      "user_id": 456,
      "display_name": "Jane Smith",
      "points": 1200,
      "verses_mastered": 4,
      "current_streak": 5,
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

**Features:**
- Shows rankings based on selected metric
- Respects privacy settings (only shows public members)
- Includes rank, display name, and relevant stats
- Provides metadata about participation

#### B. Get Group Statistics
```http
GET /groups/:id/stats
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

**Features:**
- Overall group performance metrics
- Recent activity summary
- Top performer identification
- Member engagement statistics

#### C. Get Member's Group Ranking
```http
GET /groups/:id/members/:userId/ranking
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

**Features:**
- Individual member's ranking and percentile
- Progress toward next rank
- All relevant metrics for the member
- Motivational information

### Backend Implementation

#### A. Add to `groups/index.ts`
```typescript
interface LeaderboardQuery {
  metric?: 'points' | 'verses_mastered' | 'current_streak' | 'longest_streak';
  timeframe?: 'all' | 'week' | 'month' | 'year';
}

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  points: number;
  verses_mastered: number;
  current_streak: number;
  longest_streak: number;
  is_public: boolean;
}

interface GroupStats {
  total_members: number;
  active_members: number;
  total_points: number;
  total_verses_mastered: number;
  average_points_per_member: number;
  top_performer: {
    user_id: number;
    display_name: string;
    points: number;
  };
  recent_activity: {
    new_members_this_week: number;
    verses_mastered_this_week: number;
    points_earned_this_week: number;
  };
}

interface MemberRanking {
  user_id: number;
  display_name: string;
  rank: number;
  total_members: number;
  percentile: number;
  metrics: {
    points: number;
    verses_mastered: number;
    current_streak: number;
    longest_streak: number;
  };
  next_rank?: {
    rank: number;
    points_needed: number;
  };
}

// Add these functions to handleGroups object:

getLeaderboard: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];
    const metric = url.searchParams.get('metric') || 'points';
    const timeframe = url.searchParams.get('timeframe') || 'all';

    // Validate parameters
    const validMetrics = ['points', 'verses_mastered', 'current_streak', 'longest_streak'];
    const validTimeframes = ['all', 'week', 'month', 'year'];
    
    if (!validMetrics.includes(metric)) {
      return new Response(JSON.stringify({ error: 'Invalid metric parameter' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!validTimeframes.includes(timeframe)) {
      return new Response(JSON.stringify({ error: 'Invalid timeframe parameter' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);

    // Check if user is a member of the group
    const isMember = await db.prepare(`
      SELECT 1 FROM group_members 
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `).bind(groupId, userId).first();

    if (!isMember) {
      return new Response(JSON.stringify({ error: 'You must be a member of this group to view the leaderboard' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build the leaderboard query based on metric and timeframe
    let leaderboardQuery = '';
    let orderBy = '';

    switch (metric) {
      case 'points':
        orderBy = 'us.total_points DESC';
        break;
      case 'verses_mastered':
        orderBy = 'us.verses_mastered DESC';
        break;
      case 'current_streak':
        orderBy = 'us.current_streak DESC';
        break;
      case 'longest_streak':
        orderBy = 'us.longest_streak DESC';
        break;
    }

    // Add timeframe filtering if needed
    let timeframeFilter = '';
    if (timeframe !== 'all') {
      const now = Date.now();
      let cutoffTime = 0;
      
      switch (timeframe) {
        case 'week':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          cutoffTime = now - (365 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (cutoffTime > 0) {
        timeframeFilter = `AND us.last_activity_date >= ${cutoffTime}`;
      }
    }

    leaderboardQuery = `
      SELECT 
        gm.user_id,
        gm.display_name,
        gm.is_public,
        us.total_points,
        us.verses_mastered,
        us.current_streak,
        us.longest_streak
      FROM group_members gm
      LEFT JOIN user_stats us ON gm.user_id = us.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE ${timeframeFilter}
      ORDER BY ${orderBy}
    `;

    const leaderboard = await db.prepare(leaderboardQuery).bind(groupId).all();

    // Process results and add rankings
    const processedLeaderboard: LeaderboardEntry[] = [];
    let currentRank = 1;
    let lastValue = -1;
    let lastRank = 1;

    for (const entry of leaderboard.results) {
      if (!entry.is_public) continue; // Skip private members

      let currentValue = 0;
      switch (metric) {
        case 'points':
          currentValue = entry.total_points || 0;
          break;
        case 'verses_mastered':
          currentValue = entry.verses_mastered || 0;
          break;
        case 'current_streak':
          currentValue = entry.current_streak || 0;
          break;
        case 'longest_streak':
          currentValue = entry.longest_streak || 0;
          break;
      }

      // Handle ties (same rank for same values)
      if (currentValue !== lastValue) {
        currentRank = processedLeaderboard.length + 1;
      }

      processedLeaderboard.push({
        rank: currentRank,
        user_id: entry.user_id,
        display_name: entry.display_name || 'Anonymous',
        points: entry.total_points || 0,
        verses_mastered: entry.verses_mastered || 0,
        current_streak: entry.current_streak || 0,
        longest_streak: entry.longest_streak || 0,
        is_public: entry.is_public
      });

      lastValue = currentValue;
      lastRank = currentRank;
    }

    // Get metadata
    const totalMembers = await db.prepare(`
      SELECT COUNT(*) as count FROM group_members 
      WHERE group_id = ? AND is_active = TRUE
    `).bind(groupId).first();

    const participatingMembers = processedLeaderboard.length;

    return new Response(JSON.stringify({ 
      success: true,
      leaderboard: processedLeaderboard,
      metadata: {
        total_members: totalMembers?.count || 0,
        participating_members: participatingMembers,
        metric,
        timeframe
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
},

getGroupStats: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const groupId = url.pathname.split('/')[2];

    const db = getDB(env);

    // Check if user is a member of the group
    const isMember = await db.prepare(`
      SELECT 1 FROM group_members 
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `).bind(groupId, userId).first();

    if (!isMember) {
      return new Response(JSON.stringify({ error: 'You must be a member of this group to view group stats' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get total members
    const totalMembers = await db.prepare(`
      SELECT COUNT(*) as count FROM group_members 
      WHERE group_id = ? AND is_active = TRUE
    `).bind(groupId).first();

    // Get active members (have stats)
    const activeMembers = await db.prepare(`
      SELECT COUNT(*) as count FROM group_members gm
      JOIN user_stats us ON gm.user_id = us.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
    `).bind(groupId).first();

    // Get total points and verses mastered
    const totals = await db.prepare(`
      SELECT 
        SUM(us.total_points) as total_points,
        SUM(us.verses_mastered) as total_verses_mastered
      FROM group_members gm
      JOIN user_stats us ON gm.user_id = us.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE
    `).bind(groupId).first();

    // Get top performer
    const topPerformer = await db.prepare(`
      SELECT 
        gm.user_id,
        gm.display_name,
        us.total_points
      FROM group_members gm
      JOIN user_stats us ON gm.user_id = us.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE AND gm.is_public = TRUE
      ORDER BY us.total_points DESC
      LIMIT 1
    `).bind(groupId).first();

    // Get recent activity (this week)
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const newMembersThisWeek = await db.prepare(`
      SELECT COUNT(*) as count FROM group_members 
      WHERE group_id = ? AND joined_at >= ?
    `).bind(groupId, weekAgo).first();

    const versesMasteredThisWeek = await db.prepare(`
      SELECT COUNT(*) as count FROM verses v
      JOIN group_members gm ON v.user_id = gm.user_id
      WHERE gm.group_id = ? AND v.status = 'mastered' AND v.created_at >= ?
    `).bind(groupId, weekAgo).first();

    const pointsEarnedThisWeek = await db.prepare(`
      SELECT SUM(pe.points) as total FROM point_events pe
      JOIN group_members gm ON pe.user_id = gm.user_id
      WHERE gm.group_id = ? AND pe.created_at >= ?
    `).bind(groupId, weekAgo).first();

    const stats: GroupStats = {
      total_members: totalMembers?.count || 0,
      active_members: activeMembers?.count || 0,
      total_points: totals?.total_points || 0,
      total_verses_mastered: totals?.total_verses_mastered || 0,
      average_points_per_member: activeMembers?.count ? Math.round((totals?.total_points || 0) / activeMembers.count) : 0,
      top_performer: topPerformer ? {
        user_id: topPerformer.user_id,
        display_name: topPerformer.display_name || 'Anonymous',
        points: topPerformer.total_points || 0
      } : {
        user_id: 0,
        display_name: 'None',
        points: 0
      },
      recent_activity: {
        new_members_this_week: newMembersThisWeek?.count || 0,
        verses_mastered_this_week: versesMasteredThisWeek?.count || 0,
        points_earned_this_week: pointsEarnedThisWeek?.total || 0
      }
    };

    return new Response(JSON.stringify({ 
      success: true,
      stats
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting group stats:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
},

getMemberRanking: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[2];
    const targetUserId = pathParts[4];

    const db = getDB(env);

    // Check if requesting user is a member of the group
    const isMember = await db.prepare(`
      SELECT 1 FROM group_members 
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `).bind(groupId, userId).first();

    if (!isMember) {
      return new Response(JSON.stringify({ error: 'You must be a member of this group to view rankings' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if target user is a member and public (unless requesting own ranking)
    const targetMember = await db.prepare(`
      SELECT is_public FROM group_members 
      WHERE group_id = ? AND user_id = ? AND is_active = TRUE
    `).bind(groupId, targetUserId).first();

    if (!targetMember) {
      return new Response(JSON.stringify({ error: 'Member not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!targetMember.is_public && userId !== parseInt(targetUserId)) {
      return new Response(JSON.stringify({ error: 'Member profile is private' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all member rankings by points
    const allRankings = await db.prepare(`
      SELECT 
        gm.user_id,
        gm.display_name,
        gm.is_public,
        us.total_points,
        us.verses_mastered,
        us.current_streak,
        us.longest_streak
      FROM group_members gm
      LEFT JOIN user_stats us ON gm.user_id = us.user_id
      WHERE gm.group_id = ? AND gm.is_active = TRUE AND gm.is_public = TRUE
      ORDER BY us.total_points DESC
    `).bind(groupId).all();

    // Find target user's rank
    let targetRank = 0;
    let targetData = null;
    const totalMembers = allRankings.results.length;

    for (let i = 0; i < allRankings.results.length; i++) {
      const entry = allRankings.results[i];
      if (entry.user_id === parseInt(targetUserId)) {
        targetRank = i + 1;
        targetData = entry;
        break;
      }
    }

    if (!targetData) {
      return new Response(JSON.stringify({ error: 'Member not found in rankings' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Calculate percentile
    const percentile = totalMembers > 1 ? Math.round(((totalMembers - targetRank + 1) / totalMembers) * 100) : 100;

    // Find next rank info
    let nextRank = null;
    if (targetRank > 1) {
      const nextRankEntry = allRankings.results[targetRank - 2]; // -2 because arrays are 0-indexed
      if (nextRankEntry) {
        const pointsNeeded = nextRankEntry.total_points - targetData.total_points;
        nextRank = {
          rank: targetRank - 1,
          points_needed: pointsNeeded
        };
      }
    }

    const ranking: MemberRanking = {
      user_id: targetData.user_id,
      display_name: targetData.display_name || 'Anonymous',
      rank: targetRank,
      total_members: totalMembers,
      percentile,
      metrics: {
        points: targetData.total_points || 0,
        verses_mastered: targetData.verses_mastered || 0,
        current_streak: targetData.current_streak || 0,
        longest_streak: targetData.longest_streak || 0
      },
      next_rank: nextRank
    };

    return new Response(JSON.stringify({ 
      success: true,
      ranking
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting member ranking:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### B. Add to router in `index.ts`
```typescript
// Groups routes
router.post('/groups/create', handleGroups.createGroup);
router.get('/groups/:id/leaders', handleGroups.getLeaders);
router.post('/groups/:id/leaders', handleGroups.assignLeader);
router.post('/groups/:id/invite', handleGroups.inviteMember);
router.post('/groups/:id/join', handleGroups.joinGroup);
router.get('/groups/:id/members', handleGroups.getMembers);
router.put('/groups/:id/members/:userId/display-name', handleGroups.updateDisplayName);
router.get('/groups/:id/members/:userId/profile', handleGroups.getMemberProfile);
router.put('/groups/:id/members/:userId/privacy', handleGroups.updatePrivacy);
// NEW LEADERBOARD ENDPOINTS:
router.get('/groups/:id/leaderboard', handleGroups.getLeaderboard);
router.get('/groups/:id/stats', handleGroups.getGroupStats);
router.get('/groups/:id/members/:userId/ranking', handleGroups.getMemberRanking);
```

### Test Script: `test-groups-step4.sh`
```bash
#!/bin/bash

# Test Step 4: Group Leaderboards
echo "Testing Step 4: Group Leaderboards"

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test1@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test2@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test3@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN3=$(echo "$MAGIC_LINK_RESPONSE3" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
SESSION_TOKEN3=$(echo "$VERIFY_RESPONSE3" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Leaderboard Test Group","description":"Testing leaderboards"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Get user IDs
USER_ID1=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test1@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
USER_ID2=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test2@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
USER_ID3=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test3@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

echo "Debug - GROUP_ID: $GROUP_ID"
echo "Debug - USER_ID1: $USER_ID1"
echo "Debug - USER_ID2: $USER_ID2"
echo "Debug - USER_ID3: $USER_ID3"

# Invite and add members
echo "Inviting members to group..."

# Invite user 2
INVITE_RESPONSE2=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"leaderboard-test2@example.com"}')

INVITATION_ID2=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'leaderboard-test2@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

JOIN_RESPONSE2=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"invitationId\":$INVITATION_ID2}")

# Invite user 3
INVITE_RESPONSE3=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"leaderboard-test3@example.com"}')

INVITATION_ID3=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'leaderboard-test3@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

JOIN_RESPONSE3=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d "{\"invitationId\":$INVITATION_ID3}")

# Set display names
echo "Setting display names..."
UPDATE_NAME1_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"Top Performer"}')

UPDATE_NAME2_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID2/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"displayName":"Second Place"}')

UPDATE_NAME3_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID3/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d '{"displayName":"Third Place"}')

# Add some points to create a leaderboard
echo "Adding points to create leaderboard..."
POINTS_RESPONSE1=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"event_type":"verse_added","points":1000}')

POINTS_RESPONSE2=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"event_type":"verse_added","points":800}')

POINTS_RESPONSE3=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d '{"event_type":"verse_added","points":600}')

# Test 1: Get leaderboard
echo "Testing get leaderboard..."
LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=points" \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Leaderboard response: $LEADERBOARD_RESPONSE"

if echo "$LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "✓ Get leaderboard test passed"
else
    echo "✗ Get leaderboard test failed"
    exit 1
fi

# Test 2: Get group stats
echo "Testing get group stats..."
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/stats \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Stats response: $STATS_RESPONSE"

if echo "$STATS_RESPONSE" | grep -q '"total_members"'; then
    echo "✓ Get group stats test passed"
else
    echo "✗ Get group stats test failed"
    exit 1
fi

# Test 3: Get member ranking
echo "Testing get member ranking..."
RANKING_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members/$USER_ID2/ranking \
  -H "Authorization: Bearer $SESSION_TOKEN2")

echo "Ranking response: $RANKING_RESPONSE"

if echo "$RANKING_RESPONSE" | grep -q '"rank"'; then
    echo "✓ Get member ranking test passed"
else
    echo "✗ Get member ranking test failed"
    exit 1
fi

# Test 4: Test different metrics
echo "Testing different metrics..."
STREAK_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=current_streak" \
  -H "Authorization: Bearer $SESSION_TOKEN1")

if echo "$STREAK_LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "✓ Different metrics test passed"
else
    echo "✗ Different metrics test failed"
    exit 1
fi

echo "Step 4 completed successfully!"
```

### Update Comprehensive Test
Add to `test-comprehensive.sh` after display names tests:
```bash
# Test leaderboards
echo "${YELLOW}Testing leaderboards...${NC}"

# Get leaderboard
LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "${GREEN}✓ Get leaderboard works${NC}"
else
    echo "${RED}✗ Get leaderboard failed${NC}"
    exit 1
fi

# Get group stats
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/stats \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$STATS_RESPONSE" | grep -q '"total_members"'; then
    echo "${GREEN}✓ Get group stats works${NC}"
else
    echo "${RED}✗ Get group stats failed${NC}"
    exit 1
fi
```

### Features and Benefits

1. **Multiple Metrics**: Points, verses mastered, streaks
2. **Time-based Filtering**: All-time, weekly, monthly, yearly rankings
3. **Privacy Respect**: Only shows public members
4. **Tie Handling**: Proper ranking for equal values
5. **Motivational Elements**: Progress toward next rank
6. **Group Analytics**: Overall performance and engagement metrics

### Implementation Order

1. **Implement backend endpoints** (3 new endpoints)
2. **Add router routes**
3. **Create test script** (`test-groups-step4.sh`)
4. **Update comprehensive test**
5. **Test thoroughly**
6. **Deploy to production**

---

## 🔄 NEXT: Step 5 - Display Names and Privacy

### Overview
Step 5 adds display names and privacy controls to group members. This is needed for Step 4 (Leaderboards) to show user-friendly names instead of email addresses and provide privacy controls.

### Database Migration: `0011_add_display_names.sql`
```sql
-- Add display_name column to group_members table
ALTER TABLE group_members ADD COLUMN display_name TEXT;

-- Add is_public column for privacy controls
ALTER TABLE group_members ADD COLUMN is_public BOOLEAN DEFAULT TRUE;

-- Add index for display name lookups
CREATE INDEX IF NOT EXISTS idx_group_members_display_name ON group_members(display_name);

-- Update existing members to have display names (use email prefix as default)
UPDATE group_members 
SET display_name = (
  SELECT SUBSTR(u.email, 1, INSTR(u.email, '@') - 1) 
  FROM users u 
  WHERE u.id = group_members.user_id
)
WHERE display_name IS NULL;
```

### API Endpoints to Implement

#### A. Update Display Name
```http
PUT /groups/:id/members/:userId/display-name
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "John Doe"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Display name updated successfully"
}
```

**Features:**
- User can update their own display name
- Group leaders can update any member's display name
- Validation: 2-30 characters, alphanumeric + spaces only
- Prevents duplicate display names within the same group

**Error Responses:**
- `400 Bad Request`: Invalid display name format or duplicate name
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to update this display name
- `404 Not Found`: Group or member not found

#### B. Get Member Profile
```http
GET /groups/:id/members/:userId/profile
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

**Features:**
- Returns member profile information
- Respects privacy settings (leaders can always see all profiles)
- Includes display name, email, role, and privacy settings

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User cannot view this profile due to privacy settings
- `404 Not Found`: Group or member not found

#### C. Update Privacy Settings
```http
PUT /groups/:id/members/:userId/privacy
Authorization: Bearer <token>
Content-Type: application/json

{
  "isPublic": true
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "message": "Privacy settings updated successfully"
}
```

**Features:**
- User can update their own privacy settings
- Group leaders can update any member's privacy settings
- Controls visibility of profile information to other group members

**Error Responses:**
- `400 Bad Request`: Invalid privacy setting
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User lacks permission to update this privacy setting
- `404 Not Found`: Group or member not found

### Backend Implementation

#### A. Add to `groups/index.ts`
```typescript
interface UpdateDisplayNameRequest {
  displayName: string;
}

interface UpdatePrivacyRequest {
  isPublic: boolean;
}

// Add these functions to handleGroups object:

updateDisplayName: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[2];
    const targetUserId = pathParts[4];

    const { displayName } = await request.json() as UpdateDisplayNameRequest;

    // Validate display name
    if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 30) {
      return new Response(JSON.stringify({ error: 'Display name must be between 2 and 30 characters' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate display name format (alphanumeric, spaces, hyphens, underscores only)
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(displayName.trim())) {
      return new Response(JSON.stringify({ error: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check for consecutive spaces
    if (displayName.includes('  ')) {
      return new Response(JSON.stringify({ error: 'Display name cannot contain consecutive spaces' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);

    // Check if user has permission to update this display name
    const canUpdate = await db.prepare(`
      SELECT role FROM group_members 
      WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
    `).bind(groupId, userId).first();

    const isOwnProfile = userId === parseInt(targetUserId);

    if (!canUpdate && !isOwnProfile) {
      return new Response(JSON.stringify({ error: 'You do not have permission to update this display name' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if display name is already taken in this group
    const existingName = await db.prepare(`
      SELECT 1 FROM group_members 
      WHERE group_id = ? AND display_name = ? AND user_id != ?
    `).bind(groupId, displayName.trim(), targetUserId).first();

    if (existingName) {
      return new Response(JSON.stringify({ error: 'Display name is already taken in this group' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update display name
    await db.prepare(`
      UPDATE group_members 
      SET display_name = ? 
      WHERE group_id = ? AND user_id = ?
    `).bind(displayName.trim(), groupId, targetUserId).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Display name updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating display name:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
},

getMemberProfile: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[2];
    const targetUserId = pathParts[4];

    const db = getDB(env);

    // Check if requesting user is a leader (leaders can see all profiles)
    const isLeader = await db.prepare(`
      SELECT role FROM group_members 
      WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
    `).bind(groupId, userId).first();

    // Get target member profile
    const profile = await db.prepare(`
      SELECT 
        gm.user_id,
        gm.display_name,
        gm.role,
        gm.joined_at,
        gm.is_public,
        u.email
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ? AND gm.user_id = ? AND gm.is_active = TRUE
    `).bind(groupId, targetUserId).first();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Member not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check privacy settings (leaders can always see, others need is_public = true)
    if (!isLeader && !profile.is_public && userId !== parseInt(targetUserId)) {
      return new Response(JSON.stringify({ error: 'Profile is private' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      profile: {
        user_id: profile.user_id,
        display_name: profile.display_name,
        email: profile.email,
        role: profile.role,
        joined_at: profile.joined_at,
        is_public: profile.is_public
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting member profile:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
},

updatePrivacy: async (request: Request, env: Env): Promise<Response> => {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const userId = await getUserId(token, env);
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[2];
    const targetUserId = pathParts[4];

    const { isPublic } = await request.json() as UpdatePrivacyRequest;

    if (typeof isPublic !== 'boolean') {
      return new Response(JSON.stringify({ error: 'isPublic must be a boolean value' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = getDB(env);

    // Check if user has permission to update this privacy setting
    const canUpdate = await db.prepare(`
      SELECT role FROM group_members 
      WHERE group_id = ? AND user_id = ? AND role IN ('leader', 'creator')
    `).bind(groupId, userId).first();

    const isOwnProfile = userId === parseInt(targetUserId);

    if (!canUpdate && !isOwnProfile) {
      return new Response(JSON.stringify({ error: 'You do not have permission to update this privacy setting' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update privacy setting
    await db.prepare(`
      UPDATE group_members 
      SET is_public = ? 
      WHERE group_id = ? AND user_id = ?
    `).bind(isPublic, groupId, targetUserId).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Privacy settings updated successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

#### B. Add to router in `index.ts`
```typescript
// Groups routes
router.post('/groups/create', handleGroups.createGroup);
router.get('/groups/:id/leaders', handleGroups.getLeaders);
router.post('/groups/:id/leaders', handleGroups.assignLeader);
router.post('/groups/:id/invite', handleGroups.inviteMember);
router.post('/groups/:id/join', handleGroups.joinGroup);
router.get('/groups/:id/members', handleGroups.getMembers);
router.put('/groups/:id/members/:userId/display-name', handleGroups.updateDisplayName);
router.get('/groups/:id/members/:userId/profile', handleGroups.getMemberProfile);
router.put('/groups/:id/members/:userId/privacy', handleGroups.updatePrivacy);
// NEW LEADERBOARD ENDPOINTS:
router.get('/groups/:id/leaderboard', handleGroups.getLeaderboard);
router.get('/groups/:id/stats', handleGroups.getGroupStats);
router.get('/groups/:id/members/:userId/ranking', handleGroups.getMemberRanking);
```

### Validation Rules

#### Display Name Validation:
- 2-30 characters
- Alphanumeric characters, spaces, hyphens, underscores only
- No consecutive spaces
- No leading/trailing spaces
- Must be unique within the group
- Cannot be empty or null

#### Privacy Controls:
- `is_public`: Whether the member's profile is visible to other group members
- Default: `true` (public)
- Leaders can always see all member profiles
- Private members' display names still show in leaderboards (for functionality)

### Test Script: `test-groups-step5.sh`
```bash
#!/bin/bash

# Test Step 5: Display Names and Privacy
echo "Testing Step 5: Display Names and Privacy"

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"display-test1@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"display-test2@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Display Name Test Group","description":"Testing display names and privacy"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Get user IDs
USER_ID1=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'display-test1@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
USER_ID2=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'display-test2@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

# Test 1: Update display name
echo "Testing update display name..."
UPDATE_NAME_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"Test User One"}')

echo "Update name response: $UPDATE_NAME_RESPONSE"

if echo "$UPDATE_NAME_RESPONSE" | grep -q "success"; then
    echo "✓ Update display name test passed"
else
    echo "✗ Update display name test failed"
    exit 1
fi

# Test 2: Get member profile
echo "Testing get member profile..."
GET_PROFILE_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/profile \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Get profile response: $GET_PROFILE_RESPONSE"

if echo "$GET_PROFILE_RESPONSE" | grep -q '"display_name":"Test User One"'; then
    echo "✓ Get member profile test passed"
else
    echo "✗ Get member profile test failed"
    exit 1
fi

# Test 3: Update privacy settings
echo "Testing update privacy settings..."
UPDATE_PRIVACY_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/privacy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"isPublic":false}')

echo "Update privacy response: $UPDATE_PRIVACY_RESPONSE"

if echo "$UPDATE_PRIVACY_RESPONSE" | grep -q "success"; then
    echo "✓ Update privacy settings test passed"
else
    echo "✗ Update privacy settings test failed"
    exit 1
fi

# Test 4: Validation tests
echo "Testing display name validation..."

# Test invalid name (too short)
SHORT_NAME_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"A"}')

if echo "$SHORT_NAME_RESPONSE" | grep -q "between 2 and 30 characters"; then
    echo "✓ Short name validation test passed"
else
    echo "✗ Short name validation test failed"
    exit 1
fi

# Test invalid characters
INVALID_CHARS_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"Test@User"}')

if echo "$INVALID_CHARS_RESPONSE" | grep -q "can only contain letters"; then
    echo "✓ Invalid characters validation test passed"
else
    echo "✗ Invalid characters validation test failed"
    exit 1
fi

echo "Step 5 completed successfully!"
```

### Update Comprehensive Test
Add to `test-comprehensive.sh` after display names tests:
```bash
# Test leaderboards
echo "${YELLOW}Testing leaderboards...${NC}"

# Get leaderboard
LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "${GREEN}✓ Get leaderboard works${NC}"
else
    echo "${RED}✗ Get leaderboard failed${NC}"
    exit 1
fi

# Get group stats
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/stats \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$STATS_RESPONSE" | grep -q '"total_members"'; then
    echo "${GREEN}✓ Get group stats works${NC}"
else
    echo "${RED}✗ Get group stats failed${NC}"
    exit 1
fi
```

### Benefits for Step 4 (Leaderboards)

Once Step 5 is complete, the leaderboard endpoints can:

1. **Show friendly names** instead of email addresses
2. **Respect privacy settings** (show/hide based on `is_public`)
3. **Provide better UX** with readable display names
4. **Support moderation** through leader controls

### Implementation Order

1. **Create migration** (`0011_add_display_names.sql`)
2. **Implement backend endpoints** (3 new endpoints)
3. **Add router routes**
4. **Create test script** (`test-groups-step5.sh`)
5. **Update comprehensive test**
6. **Test thoroughly**
7. **Deploy to production**

### Migration Safety

This migration is **safe for production** because:
- ✅ Only adds new columns (no data loss)
- ✅ Provides default values for existing records
- ✅ No breaking changes to existing functionality
- ✅ Backward compatible with existing queries

---

## 🔄 FUTURE: Step 4 - Group Leaderboards

### Endpoints to Implement
- `GET /groups/:id/leaderboard` - Get group leaderboard based on points
- `GET /groups/:id/stats` - Get group statistics

### Features
- Points aggregation by group
- Leaderboard rankings
- Group statistics (total members, total points, etc.)

---

## 🔄 NEXT: Step 6 - List Groups for a User

### Overview
Implement an endpoint to fetch all groups that the authenticated user is currently a member of (active membership). This is essential for the frontend to display a user's groups, enable navigation, and show group roles.

### Database Changes
- **No new migrations needed.** Uses existing `group_members` and `groups` tables.

### API Endpoint to Implement

#### `GET /groups/mine`
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
      "role": "leader",
      "member_count": 8,
      "created_at": 1718000000000
    },
    {
      "id": 2,
      "name": "Youth Group",
      "description": "Youth group challenge",
      "role": "member",
      "member_count": 15,
      "created_at": 1717000000000
    }
  ]
}
```

**Features:**
- Returns all active groups the user is a member of.
- Includes group name, description, user's role, member count, and creation date.
- Only includes groups where `is_active = TRUE` for both group and membership.

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token

### Backend Implementation
- Add a handler in `groups/index.ts`:
  - Authenticate user.
  - Query all groups where the user is an active member.
  - Join with `groups` table for group info.
  - Count members for each group.
  - Return as array.

### Test Script
- Add to `test-groups-step6.sh`:
  - Create users and groups.
  - Add users to multiple groups with different roles.
  - Call `/groups/mine` as each user.
  - Assert correct groups and roles are returned.

### Comprehensive Test Update
- Add a section to `test-comprehensive.sh` to verify this endpoint for all test users.

---

## Implementation Status

- ✅ **Step 1 & 2**: Complete (Consolidated groups system)
- ✅ **Step 3**: Complete (Membership and invitations)
- ✅ **Step 5**: Complete (Display names and privacy)
- ⏳ **Step 4**: Future (Leaderboards) 