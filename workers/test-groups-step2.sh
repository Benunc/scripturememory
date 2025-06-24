#!/bin/bash

# Test Step 2: Group Leadership Management
echo "Testing Step 2: Group Leadership Management"

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"creator@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leader@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN3=$(echo "$MAGIC_LINK_RESPONSE3" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
SESSION_TOKEN3=$(echo "$VERIFY_RESPONSE3" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Leadership Test Group","description":"Testing leadership management"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Get leaders (should show creator)
echo "Getting group leaders..."
GET_LEADERS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Get leaders response: $GET_LEADERS_RESPONSE"

# Verify creator is listed as leader with creator role
if echo "$GET_LEADERS_RESPONSE" | grep -q '"role":"creator"'; then
    echo "✓ Creator role test passed"
else
    echo "✗ Creator role test failed"
    exit 1
fi

# Assign new leader
ASSIGN_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"leader@example.com"}')

echo "Assign leader response: $ASSIGN_RESPONSE"

# Verify leader was assigned
DB_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT COUNT(*) as count FROM group_members WHERE group_id = $GROUP_ID AND role = 'leader';" | cat)
echo "Database check: $DB_CHECK"

if echo "$DB_CHECK" | grep -q '"count": 1'; then
    echo "✓ Leader assignment test passed"
else
    echo "✗ Leader assignment test failed"
    exit 1
fi

# Test permission denied for non-leaders (using member@example.com who is not in the group)
echo "Testing permission denied for non-leaders..."
PERMISSION_DENIED_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d '{"email":"test@example.com"}')

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "permission"; then
    echo "✓ Permission denied test passed"
else
    echo "✗ Permission denied test failed"
    exit 1
fi

# Test assigning leader to non-existent user
echo "Testing assigning leader to non-existent user..."
NONEXISTENT_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"nonexistent@example.com"}')

if echo "$NONEXISTENT_RESPONSE" | grep -q "User not found"; then
    echo "✓ Non-existent user test passed"
else
    echo "✗ Non-existent user test failed"
    exit 1
fi

echo "Step 2 completed successfully!" 