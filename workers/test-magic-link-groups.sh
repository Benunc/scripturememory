#!/bin/bash

# Test Magic Link Group Functionality
echo "Testing Magic Link Group Functionality"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create test user first
echo -e "${BLUE}Creating test user for group creation...${NC}"
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-creator@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
CREATOR_SESSION_TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Creator session token: $CREATOR_SESSION_TOKEN"

# Create test group first
echo -e "${BLUE}Creating test group...${NC}"
GROUP_CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CREATOR_SESSION_TOKEN" \
  -d '{
    "name": "magic-link-test-group",
    "description": "Group for testing magic link functionality"
  }')

echo "Group create response: $GROUP_CREATE_RESPONSE"

GROUP_ID=$(echo "$GROUP_CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Created group ID: $GROUP_ID"

if [ -z "$GROUP_ID" ]; then
    echo -e "${RED}✗ Failed to create group${NC}"
    exit 1
fi

# Test 1: New user with group code
echo -e "${YELLOW}Test 1: New user with group code${NC}"

# Create magic link for new user with group code
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new-user-group@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token",
    "groupCode": "magic-link-test-group"
  }')

MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
echo "Magic token: $MAGIC_TOKEN"

# Verify magic link (this should create new user and add to group)
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
SESSION_TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Session token: $SESSION_TOKEN"

# Check if user was added to group
echo -e "${BLUE}Checking group membership...${NC}"
GROUP_MEMBERS_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/members" \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "Group members response: $GROUP_MEMBERS_RESPONSE"
echo "Group ID being checked: $GROUP_ID"
echo "Session token: $SESSION_TOKEN"

if echo "$GROUP_MEMBERS_RESPONSE" | grep -q "new-user-group@example.com"; then
    echo -e "${GREEN}✓ New user successfully added to group${NC}"
else
    echo -e "${RED}✗ New user was not added to group${NC}"
    exit 1
fi

# Test 2: Existing user with group code
echo -e "${YELLOW}Test 2: Existing user with group code${NC}"

# Create magic link for existing user with group code
MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "new-user-group@example.com",
    "isRegistration": false,
    "turnstileToken": "test-token",
    "groupCode": "magic-link-test-group"
  }')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
echo "Magic token 2: $MAGIC_TOKEN2"

# Verify magic link (this should add existing user to group)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Session token 2: $SESSION_TOKEN2"

# Check if user is still in group (should be, since they were already added)
GROUP_MEMBERS_RESPONSE2=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/members" \
  -H "Authorization: Bearer $SESSION_TOKEN2")

echo "Group members response 2: $GROUP_MEMBERS_RESPONSE2"

if echo "$GROUP_MEMBERS_RESPONSE2" | grep -q "new-user-group@example.com"; then
    echo -e "${GREEN}✓ Existing user remains in group${NC}"
else
    echo -e "${RED}✗ Existing user is not in group${NC}"
    exit 1
fi

# Test 3: New user with verse set and group code
echo -e "${YELLOW}Test 3: New user with verse set and group code${NC}"

# Create magic link for new user with both verse set and group code
MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "verse-group-user@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token",
    "verseSet": "gpc_youth",
    "groupCode": "magic-link-test-group"
  }')

MAGIC_TOKEN3=$(echo "$MAGIC_LINK_RESPONSE3" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
echo "Magic token 3: $MAGIC_TOKEN3"

# Verify magic link
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
SESSION_TOKEN3=$(echo "$VERIFY_RESPONSE3" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Session token 3: $SESSION_TOKEN3"

# Check if user was added to group
GROUP_MEMBERS_RESPONSE3=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/members" \
  -H "Authorization: Bearer $SESSION_TOKEN3")

echo "Group members response 3: $GROUP_MEMBERS_RESPONSE3"

if echo "$GROUP_MEMBERS_RESPONSE3" | grep -q "verse-group-user@example.com"; then
    echo -e "${GREEN}✓ User with verse set successfully added to group${NC}"
else
    echo -e "${RED}✗ User with verse set was not added to group${NC}"
    exit 1
fi

# Check if user has verses
VERSES_RESPONSE=$(curl -s -X GET "http://localhost:8787/verses" \
  -H "Authorization: Bearer $SESSION_TOKEN3")

echo "Verses response: $VERSES_RESPONSE"

if echo "$VERSES_RESPONSE" | grep -q '"reference":'; then
    echo -e "${GREEN}✓ User with verse set has verses${NC}"
else
    echo -e "${RED}✗ User with verse set does not have verses${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All magic link group tests passed!${NC}" 