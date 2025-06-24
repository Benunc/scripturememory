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
INVITATION_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'invitee@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

echo "Debug - GROUP_ID: $GROUP_ID"
echo "Debug - INVITATION_ID: $INVITATION_ID"

# Check if invitation ID was found
if [ -z "$INVITATION_ID" ]; then
    echo "✗ Failed to get invitation ID"
    exit 1
fi

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

# Test 5: Invite already existing member
echo "Testing invite already existing member..."
EXISTING_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"invitee@example.com"}')

if echo "$EXISTING_MEMBER_RESPONSE" | grep -q "already a member"; then
    echo "✓ Existing member test passed"
else
    echo "✗ Existing member test failed"
    exit 1
fi

# Test 6: Invalid invitation ID
echo "Testing invalid invitation ID..."
INVALID_INVITATION_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"invitationId":99999}')

if echo "$INVALID_INVITATION_RESPONSE" | grep -q "Invalid or expired invitation"; then
    echo "✓ Invalid invitation test passed"
else
    echo "✗ Invalid invitation test failed"
    exit 1
fi

echo "Step 3 completed successfully!" 