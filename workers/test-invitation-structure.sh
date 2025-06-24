#!/bin/bash

echo "Testing invitation structure..."

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"inviter@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Test Group","description":"Testing invitation structure"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

echo "Created group with ID: $GROUP_ID"

# Invite member
echo "Inviting member..."
INVITE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"invitee@example.com"}')

echo "Invite response: $INVITE_RESPONSE"

# Get invitation details from database
echo "Getting invitation details..."
INVITATION_DETAILS=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM group_invitations WHERE group_id = $GROUP_ID;" | cat)

echo "Invitation details from database:"
echo "$INVITATION_DETAILS"

# Test the new invitation details endpoint
INVITATION_ID=$(echo "$INVITATION_DETAILS" | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -n "$INVITATION_ID" ]; then
    echo "Testing invitation details endpoint..."
    INVITATION_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/invitations/$INVITATION_ID \
      -H "Authorization: Bearer $SESSION_TOKEN1")
    
    echo "Invitation details API response:"
    echo "$INVITATION_RESPONSE"
else
    echo "No invitation ID found"
fi

echo "Test completed!" 