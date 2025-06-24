#!/bin/bash

# Test Step 1: Group Creation
echo "Testing Step 1: Group Creation"

# Create test user
echo "Creating test user..."
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test-groups@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
SESSION_TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Session token: $SESSION_TOKEN"

# Test group creation
echo "Testing group creation..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"name":"Test Group","description":"A test group"}')

echo "Create response: $CREATE_RESPONSE"

# Extract group ID
GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Group ID: $GROUP_ID"

# Verify group was created in database
echo "Verifying group in database..."
DB_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM groups WHERE id = $GROUP_ID;" | cat)
echo "Database check: $DB_CHECK"

# Verify group has correct data
if echo "$DB_CHECK" | grep -q '"name": "Test Group"'; then
    echo "✓ Group creation test passed"
else
    echo "✗ Group creation test failed"
    exit 1
fi

# Verify creator is a member with creator role
echo "Verifying creator is a member with creator role..."
MEMBER_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM group_members WHERE group_id = $GROUP_ID;" | cat)
echo "Member check: $MEMBER_CHECK"

if echo "$MEMBER_CHECK" | grep -q '"role": "creator"'; then
    echo "✓ Creator membership test passed"
else
    echo "✗ Creator membership test failed"
    exit 1
fi

# Test duplicate name validation
echo "Testing duplicate name validation..."
DUPLICATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"name":"Test Group","description":"Duplicate group"}')

if echo "$DUPLICATE_RESPONSE" | grep -q "already exists"; then
    echo "✓ Duplicate name validation test passed"
else
    echo "✗ Duplicate name validation test failed"
    exit 1
fi

# Test name length validation
echo "Testing name length validation..."
SHORT_NAME_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"name":"A","description":"Too short"}')

if echo "$SHORT_NAME_RESPONSE" | grep -q "between 2 and 50 characters"; then
    echo "✓ Name length validation test passed"
else
    echo "✗ Name length validation test failed"
    exit 1
fi

echo "Step 1 completed successfully!" 