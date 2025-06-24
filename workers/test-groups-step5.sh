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

echo "Debug - GROUP_ID: $GROUP_ID"
echo "Debug - USER_ID1: $USER_ID1"
echo "Debug - USER_ID2: $USER_ID2"

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

# Test consecutive spaces
CONSECUTIVE_SPACES_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"Test  User"}')

if echo "$CONSECUTIVE_SPACES_RESPONSE" | grep -q "consecutive spaces"; then
    echo "✓ Consecutive spaces validation test passed"
else
    echo "✗ Consecutive spaces validation test failed"
    exit 1
fi

# Test 5: Permission tests
echo "Testing permission validation..."

# Test user 2 trying to update user 1's display name (should fail)
PERMISSION_DENIED_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"displayName":"Unauthorized Change"}')

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "permission"; then
    echo "✓ Permission denied test passed"
else
    echo "✗ Permission denied test failed"
    exit 1
fi

echo "Step 5 completed successfully!" 