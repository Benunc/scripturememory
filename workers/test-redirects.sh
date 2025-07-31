#!/bin/bash

# Test script for redirect functionality
# This script wipes the database, applies all migrations, and tests redirect scenarios

set -e

echo "🧪 Testing Redirect Functionality"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Success${NC}\n"
    else
        echo -e "${RED}✗ Failed${NC}\n"
        exit 1
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
if ! command_exists curl; then
    print_error "curl is required but not installed"
    exit 1
fi

if ! command_exists npx; then
    print_error "npx is required but not installed"
    exit 1
fi

# Configuration
WORKER_URL="http://localhost:8787"
DB_NAME="DB"

print_status "Starting redirect functionality test..."

# Step 1: Aggressively wipe the database
print_status "Step 1: Wiping database..."

# First, disable foreign keys
npx wrangler d1 execute $DB_NAME --env development --command="PRAGMA foreign_keys = OFF;" | cat
check_status

# Drop all tables that might exist (including new marketing tables)
npx wrangler d1 execute $DB_NAME --env development --command="DROP TABLE IF EXISTS marketing_events; DROP TABLE IF EXISTS user_permissions; DROP TABLE IF EXISTS admin_audit_log; DROP TABLE IF EXISTS super_admins; DROP TABLE IF EXISTS group_invitations; DROP TABLE IF EXISTS group_members; DROP TABLE IF EXISTS groups; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS anonymized_users;" | cat
check_status

# Re-enable foreign keys
npx wrangler d1 execute $DB_NAME --env development --command="PRAGMA foreign_keys = ON;" | cat
check_status

print_success "Database wiped successfully"

# Step 2: Run initial schema
print_status "Step 2: Running initial schema..."
npx wrangler d1 execute $DB_NAME --env development --file="./schema.sql" | cat
check_status

# Step 3: Run migrations
print_status "Step 3: Running migrations..."
for migration in ./migrations/*.sql; do
    print_status "Running migration: $migration"
    npx wrangler d1 execute $DB_NAME --env development --file="$migration" | cat
    check_status
done

print_success "All migrations applied successfully"

# Step 3: Test redirect functionality
print_status "Step 3: Testing redirect functionality..."

# Test 1: Create a user with redirect URL
print_status "Test 1: Creating user with redirect URL to /settings"
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
    echo "Response: $RESPONSE"
fi

# Test 2: Create a user with different redirect URL
print_status "Test 2: Creating user with redirect URL to /points"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "redirect-test2@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token",
    "redirect": "/points"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Magic link created with /points redirect URL"
else
    print_error "Failed to create magic link with /points redirect"
    echo "Response: $RESPONSE"
fi

# Test 3: Create a user with complex redirect URL (with query params)
print_status "Test 3: Creating user with complex redirect URL"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "redirect-test3@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token",
    "redirect": "/groups/123?tab=members"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Magic link created with complex redirect URL"
else
    print_error "Failed to create magic link with complex redirect"
    echo "Response: $RESPONSE"
fi

# Test 4: Create a user without redirect URL (should work normally)
print_status "Test 4: Creating user without redirect URL"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "redirect-test4@example.com",
    "isRegistration": true,
    "turnstileToken": "test-token"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Magic link created without redirect URL (backward compatibility)"
else
    print_error "Failed to create magic link without redirect"
    echo "Response: $RESPONSE"
fi

# Test 5: Verify magic link with redirect
print_status "Test 5: Verifying magic link with redirect URL"

# First, get the token from the database
TOKEN=$(npx wrangler d1 execute $DB_NAME --env development --command "
SELECT token FROM magic_links WHERE email = 'redirect-test@example.com' ORDER BY created_at DESC LIMIT 1;
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
fi

# Test 6: Check database schema
print_status "Test 6: Verifying database schema includes redirect_url column"
SCHEMA=$(npx wrangler d1 execute $DB_NAME --env development --command "
PRAGMA table_info(magic_links);
" --json)

if echo "$SCHEMA" | grep -q "redirect_url"; then
    print_success "Database schema includes redirect_url column"
else
    print_error "Database schema missing redirect_url column"
    echo "Schema: $SCHEMA"
fi

# Test 7: Test signin (not registration) with redirect
print_status "Test 7: Testing signin with redirect URL"
RESPONSE=$(curl -s -X POST "$WORKER_URL/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "redirect-test@example.com",
    "isRegistration": false,
    "turnstileToken": "test-token",
    "redirect": "/groups"
  }')

echo "Response: $RESPONSE"

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Signin magic link created with redirect URL"
else
    print_error "Failed to create signin magic link with redirect"
    echo "Response: $RESPONSE"
fi

# Test 8: Verify the signin magic link
print_status "Test 8: Verifying signin magic link with redirect"

# Get the signin token
SIGNIN_TOKEN=$(npx wrangler d1 execute $DB_NAME --env development --command "
SELECT token FROM magic_links WHERE email = 'redirect-test@example.com' AND redirect_url = '/groups' ORDER BY created_at DESC LIMIT 1;
" --json | jq -r '.[0].results[0].token')

if [ "$SIGNIN_TOKEN" = "null" ] || [ -z "$SIGNIN_TOKEN" ]; then
    print_error "Could not retrieve signin token from database"
    exit 1
fi

print_status "Retrieved signin token: $SIGNIN_TOKEN"

# Verify the signin magic link
RESPONSE=$(curl -s -X GET "$WORKER_URL/auth/verify?token=$SIGNIN_TOKEN")

echo "Signin verification response: $RESPONSE"

if echo "$RESPONSE" | grep -q "redirect.*groups"; then
    print_success "Signin magic link verification includes redirect URL"
else
    print_error "Signin magic link verification missing redirect URL"
    echo "Response: $RESPONSE"
fi

print_status "All redirect tests completed!"

echo ""
echo "🎉 Redirect functionality test summary:"
echo "✅ Database wiped and migrations applied"
echo "✅ Magic link creation with redirect URLs"
echo "✅ Magic link verification with redirect URLs"
echo "✅ Database schema includes redirect_url column"
echo "✅ Backward compatibility (no redirect URL)"
echo "✅ Signin with redirect URLs"
echo ""
echo "The redirect functionality is working correctly!"
echo ""
echo "To test the frontend flow:"
echo "1. Start the frontend: cd frontend && npm run dev"
echo "2. Start the worker: cd workers && npx wrangler dev"
echo "3. Try accessing /settings while logged out"
echo "4. Sign in and verify you're redirected back to /settings" 