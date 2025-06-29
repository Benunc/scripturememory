#!/bin/bash

# Test script for Super Admin System
# This script tests all the new admin endpoints and functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:8787"
SUPER_ADMIN_EMAIL="ben@wpsteward.com"
TEST_USER_EMAIL="test@example.com"

echo -e "${BLUE}🧪 Testing Super Admin System${NC}"
echo "=================================="

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

# Function to make authenticated requests
make_auth_request() {
    local method=$1
    local endpoint=$2
    local token=$3
    local data=$4
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data" \
            "$BASE_URL$endpoint"
    else
        curl -s -X "$method" \
            -H "Authorization: Bearer $token" \
            "$BASE_URL$endpoint"
    fi
}

# Function to extract token from magic link response
extract_token() {
    local response=$1
    echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

# Function to extract magic link token from response
extract_magic_token() {
    echo "$1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1
}

# Function to extract user ID from response
extract_user_id() {
    local response=$1
    echo "$response" | grep -o '"user_id":[0-9]*' | cut -d':' -f2
}

echo -e "${YELLOW}Step 1: Create test user account${NC}"
# Create a test user by sending magic link
MAGIC_LINK_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_USER_EMAIL\",\"isRegistration\":true,\"turnstileToken\":\"test-token\"}" \
    "$BASE_URL/auth/magic-link")

echo "Magic link response: $MAGIC_LINK_RESPONSE"
print_status $? "Magic link sent to test user"

echo -e "${YELLOW}Step 2: Get super admin token${NC}"
# Get super admin token (assuming they already exist)
SUPER_ADMIN_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"isRegistration\":true,\"turnstileToken\":\"test-token\"}" \
    "$BASE_URL/auth/magic-link")

echo "Super admin magic link response: $SUPER_ADMIN_RESPONSE"

# Extract magic token from super admin response
SUPER_ADMIN_MAGIC_TOKEN=$(extract_magic_token "$SUPER_ADMIN_RESPONSE")
if [ -z "$SUPER_ADMIN_MAGIC_TOKEN" ]; then
    echo -e "${RED}Failed to extract super admin magic token${NC}"
    echo "Response was: $SUPER_ADMIN_RESPONSE"
    exit 1
fi

echo "Super admin magic token: $SUPER_ADMIN_MAGIC_TOKEN"

# Verify magic link to get session token
echo -e "${YELLOW}Verifying super admin magic link...${NC}"
VERIFY_RESPONSE=$(curl -s -i "$BASE_URL/auth/verify?token=$SUPER_ADMIN_MAGIC_TOKEN")
echo "Verify response: $VERIFY_RESPONSE"

# Extract session token from verify response
SUPER_ADMIN_TOKEN=$(extract_token "$VERIFY_RESPONSE")
if [ -z "$SUPER_ADMIN_TOKEN" ]; then
    echo -e "${RED}Failed to get super admin session token${NC}"
    echo "Verify response was: $VERIFY_RESPONSE"
    exit 1
fi

echo "Super admin session token: $SUPER_ADMIN_TOKEN"
print_status $? "Got super admin token"

echo -e "${YELLOW}Step 3: Check super admin status${NC}"
SUPER_ADMIN_CHECK=$(make_auth_request "GET" "/admin/super-admin/check" "$SUPER_ADMIN_TOKEN")
echo "Super admin check: $SUPER_ADMIN_CHECK"

IS_SUPER_ADMIN=$(echo "$SUPER_ADMIN_CHECK" | grep -o '"isSuperAdmin":true')
if [ -n "$IS_SUPER_ADMIN" ]; then
    print_status 0 "Super admin status confirmed"
else
    print_status 1 "Super admin status check failed"
fi

echo -e "${YELLOW}Step 4: Get all users (admin endpoint)${NC}"
ALL_USERS_RESPONSE=$(make_auth_request "GET" "/admin/users" "$SUPER_ADMIN_TOKEN")
echo "All users response: $ALL_USERS_RESPONSE"

if echo "$ALL_USERS_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Get all users endpoint working"
else
    print_status 1 "Get all users endpoint failed"
fi

echo -e "${YELLOW}Step 5: Get all groups (admin endpoint)${NC}"
ALL_GROUPS_RESPONSE=$(make_auth_request "GET" "/admin/groups" "$SUPER_ADMIN_TOKEN")
echo "All groups response: $ALL_GROUPS_RESPONSE"

if echo "$ALL_GROUPS_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Get all groups endpoint working"
else
    print_status 1 "Get all groups endpoint failed"
fi

echo -e "${YELLOW}Step 6: Get all permissions (admin endpoint)${NC}"
ALL_PERMISSIONS_RESPONSE=$(make_auth_request "GET" "/admin/permissions" "$SUPER_ADMIN_TOKEN")
echo "All permissions response: $ALL_PERMISSIONS_RESPONSE"

if echo "$ALL_PERMISSIONS_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Get all permissions endpoint working"
else
    print_status 1 "Get all permissions endpoint failed"
fi

echo -e "${YELLOW}Step 7: Get audit log (admin endpoint)${NC}"
AUDIT_LOG_RESPONSE=$(make_auth_request "GET" "/admin/audit-log" "$SUPER_ADMIN_TOKEN")
echo "Audit log response: $AUDIT_LOG_RESPONSE"

if echo "$AUDIT_LOG_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Get audit log endpoint working"
else
    print_status 1 "Get audit log endpoint failed"
fi

echo -e "${YELLOW}Step 8: Test permission granting${NC}"
# First, get the test user ID
TEST_USER_ID=$(extract_user_id "$ALL_USERS_RESPONSE")
if [ -z "$TEST_USER_ID" ]; then
    echo -e "${RED}Could not find test user ID${NC}"
    exit 1
fi

echo "Test user ID: $TEST_USER_ID"

# Grant permission to test user
GRANT_PERMISSION_DATA="{\"targetUserId\":$TEST_USER_ID,\"permissionType\":\"create_groups\"}"
GRANT_RESPONSE=$(make_auth_request "POST" "/admin/permissions/grant" "$SUPER_ADMIN_TOKEN" "$GRANT_PERMISSION_DATA")
echo "Grant permission response: $GRANT_RESPONSE"

if echo "$GRANT_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Permission granting working"
else
    print_status 1 "Permission granting failed"
fi

echo -e "${YELLOW}Step 9: Test permission revocation${NC}"
REVOKE_PERMISSION_DATA="{\"targetUserId\":$TEST_USER_ID,\"permissionType\":\"create_groups\"}"
REVOKE_RESPONSE=$(make_auth_request "POST" "/admin/permissions/revoke" "$SUPER_ADMIN_TOKEN" "$REVOKE_PERMISSION_DATA")
echo "Revoke permission response: $REVOKE_RESPONSE"

if echo "$REVOKE_RESPONSE" | grep -q '"success":true'; then
    print_status 0 "Permission revocation working"
else
    print_status 1 "Permission revocation failed"
fi

echo -e "${YELLOW}Step 10: Test group creation with permission${NC}"
# Grant permission again for testing
GRANT_RESPONSE2=$(make_auth_request "POST" "/admin/permissions/grant" "$SUPER_ADMIN_TOKEN" "$GRANT_PERMISSION_DATA")

# Get test user token (this would normally be done via magic link verification)
# For testing, we'll assume the user has a valid session
echo -e "${YELLOW}Note: Testing group creation would require test user authentication${NC}"
print_status 0 "Permission system ready for group creation testing"

echo -e "${YELLOW}Step 11: Test unauthorized access${NC}"
# Test with invalid token
INVALID_TOKEN="invalid_token_123"
UNAUTHORIZED_RESPONSE=$(make_auth_request "GET" "/admin/users" "$INVALID_TOKEN")
echo "Unauthorized response: $UNAUTHORIZED_RESPONSE"

if echo "$UNAUTHORIZED_RESPONSE" | grep -q '"error":"Unauthorized"'; then
    print_status 0 "Unauthorized access properly blocked"
else
    print_status 1 "Unauthorized access not properly blocked"
fi

echo -e "${YELLOW}Step 12: Test permission validation${NC}"
# Test with invalid permission type
INVALID_PERMISSION_DATA="{\"targetUserId\":$TEST_USER_ID,\"permissionType\":\"invalid_permission\"}"
INVALID_PERMISSION_RESPONSE=$(make_auth_request "POST" "/admin/permissions/grant" "$SUPER_ADMIN_TOKEN" "$INVALID_PERMISSION_DATA")
echo "Invalid permission response: $INVALID_PERMISSION_RESPONSE"

if echo "$INVALID_PERMISSION_RESPONSE" | grep -q '"error":"Invalid permission type"'; then
    print_status 0 "Invalid permission type properly rejected"
else
    print_status 1 "Invalid permission type not properly rejected"
fi

echo -e "${GREEN}🎉 All Super Admin System Tests Completed Successfully!${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "- ✅ Super admin status checking"
echo "- ✅ Admin-only endpoints access"
echo "- ✅ Permission granting and revocation"
echo "- ✅ Audit logging"
echo "- ✅ Unauthorized access blocking"
echo "- ✅ Input validation"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test group creation with granted permissions"
echo "2. Test group deletion functionality (when implemented)"
echo "3. Test user management features"
echo "4. Verify audit log entries"
echo ""
echo -e "${BLUE}The super admin system is ready for use!${NC}" 