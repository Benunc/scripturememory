#!/bin/bash

# Test Group Lookup Functionality
echo "Testing Group Lookup Functionality"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create test user
echo -e "${BLUE}Creating test user...${NC}"
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-lookup-test@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
SESSION_TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Session token: $SESSION_TOKEN"

# Test group creation
echo -e "${BLUE}Creating test group...${NC}"
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"name":"gpc_youth","description":"GPC Youth Group for testing"}')

echo "Create response: $CREATE_RESPONSE"

# Extract group ID
GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "Group ID: $GROUP_ID"

# Test 1: Look up group by name
echo -e "${BLUE}Testing group lookup by name...${NC}"
LOOKUP_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/info/gpc_youth)

echo "Lookup response: $LOOKUP_RESPONSE"

if echo "$LOOKUP_RESPONSE" | grep -q '"name":"gpc_youth"'; then
    echo -e "${GREEN}✓ Group lookup by name test passed${NC}"
else
    echo -e "${RED}✗ Group lookup by name test failed${NC}"
    exit 1
fi

# Test 2: Look up group by ID
echo -e "${BLUE}Testing group lookup by ID...${NC}"
LOOKUP_BY_ID_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/info/$GROUP_ID)

echo "Lookup by ID response: $LOOKUP_BY_ID_RESPONSE"

if echo "$LOOKUP_BY_ID_RESPONSE" | grep -q '"id":'$GROUP_ID; then
    echo -e "${GREEN}✓ Group lookup by ID test passed${NC}"
else
    echo -e "${RED}✗ Group lookup by ID test failed${NC}"
    exit 1
fi

# Test 3: Look up non-existent group
echo -e "${BLUE}Testing lookup of non-existent group...${NC}"
NOT_FOUND_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/info/non-existent-group)

echo "Not found response: $NOT_FOUND_RESPONSE"

if echo "$NOT_FOUND_RESPONSE" | grep -q "Group not found"; then
    echo -e "${GREEN}✓ Non-existent group lookup test passed${NC}"
else
    echo -e "${RED}✗ Non-existent group lookup test failed${NC}"
    exit 1
fi

# Test 4: Look up with empty code
echo -e "${BLUE}Testing lookup with empty code...${NC}"
EMPTY_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/info/)

echo "Empty code response: $EMPTY_RESPONSE"

if echo "$EMPTY_RESPONSE" | grep -q "Not Found"; then
    echo -e "${GREEN}✓ Empty code validation test passed${NC}"
else
    echo -e "${RED}✗ Empty code validation test failed${NC}"
    exit 1
fi

# Verify group data structure
echo -e "${BLUE}Verifying group data structure...${NC}"
if echo "$LOOKUP_RESPONSE" | grep -q '"group"' && \
   echo "$LOOKUP_RESPONSE" | grep -q '"id"' && \
   echo "$LOOKUP_RESPONSE" | grep -q '"name"' && \
   echo "$LOOKUP_RESPONSE" | grep -q '"description"' && \
   echo "$LOOKUP_RESPONSE" | grep -q '"created_at"'; then
    echo -e "${GREEN}✓ Group data structure test passed${NC}"
else
    echo -e "${RED}✗ Group data structure test failed${NC}"
    exit 1
fi

echo -e "${GREEN}All group lookup tests passed!${NC}"
echo "Group lookup functionality is working correctly." 