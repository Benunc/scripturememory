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

## 🔄 FUTURE: Step 4 - Group Leaderboards

### Endpoints to Implement
- `GET /groups/:id/leaderboard` - Get group leaderboard based on points
- `GET /groups/:id/stats` - Get group statistics

### Features
- Points aggregation by group
- Leaderboard rankings
- Group statistics (total members, total points, etc.)

---

## 🔄 FUTURE: Step 5 - Display Names and Privacy

### Database Changes
- Add `display_name` column to `group_members` table
- Add validation and moderation features

### Features
- Privacy controls
- Display name validation
- Moderation tools for group leaders

---

## Implementation Status

- ✅ **Step 1 & 2**: Complete (Consolidated groups system)
- 🔄 **Step 3**: Ready to implement (Membership and invitations)
- ⏳ **Step 4**: Future (Leaderboards)
- ⏳ **Step 5**: Future (Display names and privacy) 