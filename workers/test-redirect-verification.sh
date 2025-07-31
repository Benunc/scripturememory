#!/bin/bash

# Quick test to verify redirect functionality
# This script tests that redirect URLs are properly passed and that default behavior works

set -e

echo "🧪 Testing Redirect URL Verification"
echo "===================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

WORKER_URL="http://localhost:8787"

# Test 1: Verify that magic links without redirect URL work (default behavior)
print_status "Test 1: Creating magic link without redirect URL"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "no-redirect-test@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Magic link created without redirect URL"
else
    print_error "Failed to create magic link without redirect"
    exit 1
fi

# Test 2: Verify that magic links with redirect URL work
print_status "Test 2: Creating magic link with redirect URL"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "redirect-test@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token",
    "redirect": "/settings"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Magic link created with redirect URL"
else
    print_error "Failed to create magic link with redirect"
    exit 1
fi

# Test 3: Verify that magic link verification returns redirect URL when present
print_status "Test 3: Verifying magic link with redirect URL"

# Get the token from the database
TOKEN=$(npx wrangler d1 execute DB --env development --command "
SELECT token FROM magic_links WHERE email = 'redirect-test@example.com' AND redirect_url = '/settings' ORDER BY created_at DESC LIMIT 1;
" --json | jq -r '.[0].results[0].token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    print_error "Could not retrieve token from database"
    exit 1
fi

print_status "Retrieved token: $TOKEN"

# Verify the magic link
RESPONSE=$(curl -s -X GET "$WORKER_URL/auth/verify?token=$TOKEN")

echo "Verification response: $RESPONSE"

if echo "$RESPONSE" | grep -q "redirect.*settings"; then
    print_success "Magic link verification includes redirect URL"
else
    print_error "Magic link verification missing redirect URL"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test 4: Verify that magic link verification doesn't return redirect URL when not present
print_status "Test 4: Verifying magic link without redirect URL"

# Get the token without redirect
TOKEN_NO_REDIRECT=$(npx wrangler d1 execute DB --env development --command "
SELECT token FROM magic_links WHERE email = 'no-redirect-test@example.com' AND redirect_url IS NULL ORDER BY created_at DESC LIMIT 1;
" --json | jq -r '.[0].results[0].token')

if [ "$TOKEN_NO_REDIRECT" = "null" ] || [ -z "$TOKEN_NO_REDIRECT" ]; then
    print_error "Could not retrieve token without redirect from database"
    exit 1
fi

print_status "Retrieved token without redirect: $TOKEN_NO_REDIRECT"

# Verify the magic link
RESPONSE=$(curl -s -X GET "$WORKER_URL/auth/verify?token=$TOKEN_NO_REDIRECT")

echo "Verification response (no redirect): $RESPONSE"

if echo "$RESPONSE" | grep -q '"redirect":"/'; then
    print_error "Magic link verification incorrectly includes redirect URL"
    echo "Response: $RESPONSE"
    exit 1
else
    print_success "Magic link verification correctly omits redirect URL when not present"
fi

print_success "All redirect verification tests passed!"

echo ""
echo "🎉 Redirect functionality verification summary:"
echo "✅ Magic links work without redirect URL (default behavior)"
echo "✅ Magic links work with redirect URL"
echo "✅ Verification returns redirect URL when present"
echo "✅ Verification omits redirect URL when not present"
echo ""
echo "The redirect functionality is working correctly!" 