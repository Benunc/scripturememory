#!/bin/zsh

# Test script for local development of Scripture Memory API
# Usage: ./test-local.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}Scripture Memory API Local Test Script${NC}\n"

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo "${GREEN}✓ Success${NC}\n"
    else
        echo "${RED}✗ Failed${NC}\n"
        exit 1
    fi
}

# Function to extract token from response
extract_token() {
    echo "$1" | grep -o '"token":"[^"]*' | cut -d'"' -f4
}

# Function to extract magic link token from response
extract_magic_token() {
    echo "$1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1
}

# Check if server is running
echo "${YELLOW}Is the Wrangler dev server running? (y/n)${NC}"
read -r SERVER_RUNNING

if [ "$SERVER_RUNNING" != "y" ]; then
    echo "${YELLOW}Please start the server with:${NC}"
    echo "npx wrangler dev --env development"
    exit 1
fi

# Check if database is clean
echo "${YELLOW}Is the database clean? (y/n)${NC}"
read -r DB_CLEAN

if [ "$DB_CLEAN" != "y" ]; then
    echo "${YELLOW}Cleaning database...${NC}"
    npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; PRAGMA foreign_keys = ON;" | cat
    check_status
fi

# Clear localStorage in the browser
echo "${YELLOW}Please clear your browser's localStorage:${NC}"
echo "1. Open your browser's developer tools (F12 or right-click -> Inspect)"
echo "2. Go to the 'Application' tab"
echo "3. Select 'Local Storage' on the left"
echo "4. Right-click on 'http://localhost:5173' and select 'Clear'"
echo "5. Refresh the page"
echo "\n${YELLOW}Press Enter when you've cleared localStorage...${NC}"
read -r

# 1. Run initial schema. Don't try to change this, it's there because we deployed the live app incorrectly with this file.
echo "${YELLOW}Running initial schema...${NC}"
npx wrangler d1 execute DB --env development --file=./schema.sql
check_status

# 4. Run migrations in correct order
echo "${YELLOW}Running migrations...${NC}"

# 4.1 Add unique constraint first
echo "${YELLOW}running new initial schema...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0000_gamification_update.sql
check_status


echo "${YELLOW}Adding unique constraint to verses...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0001_add_unique_constraint_to_verses_reference.sql
check_status

# 4.2 Add progress tables (now UNIQUE constraint exists)
echo "${YELLOW}Adding progress tables...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0002_add_progress_tables.sql
check_status

# 4.3 Add gamification tables
echo "${YELLOW}Adding gamification tables...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0003_add_gamification_tables.sql
check_status

# 4.4 Add mastered verses table
echo "${YELLOW}Adding mastered verses table...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0004_add_mastered_verses.sql
check_status

# 4.5 Add update longest streaks
echo "${YELLOW}Updating longest streaks...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0005_update_longest_streaks.sql
check_status

# 4.6 fix verses unique constraint
echo "${YELLOW}Fixing verses unique constraint...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0006_fix_verses_unique_constraint.sql
check_status

# 4.7 add user stats
echo "${YELLOW}Adding user stats...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0007_add_anonymized_users.sql
check_status

# 4.6 create new user.
# Create first user
echo "${YELLOW}Creating first user...${NC}"
MAGIC_LINK_RESPONSE_1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8787" \
  -d '{"email":"test1@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status
echo "${BLUE}Magic link response for first user:${NC}"
echo "$MAGIC_LINK_RESPONSE_1"

# Extract magic link token for first user
MAGIC_TOKEN1=$(extract_magic_token "$MAGIC_LINK_RESPONSE_1")
if [ -z "$MAGIC_TOKEN1" ]; then
    echo "${RED}Failed to extract magic link token from response${NC}"
    echo "$MAGIC_LINK_RESPONSE_1"
    echo "${YELLOW}Getting token from database...${NC}"
    DB_RESPONSE=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM magic_links WHERE email = 'test1@example.com';" | cat)
    echo "${BLUE}Database response:${NC}"
    echo "$DB_RESPONSE"
    MAGIC_TOKEN1=$(echo "$DB_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -z "$MAGIC_TOKEN1" ]; then
        echo "${RED}No magic link token found in database${NC}"
        exit 1
    fi
    echo "${GREEN}Successfully extracted token from database: $MAGIC_TOKEN1${NC}"
fi

# Verify first user's magic link
echo "\n${YELLOW}Verifying first user's magic link...${NC}"
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
check_status
echo "${BLUE}Verification response for first user:${NC}"
echo "$VERIFY_RESPONSE1"

# Extract session token for first user
SESSION_TOKEN1=$(extract_token "$VERIFY_RESPONSE1")
if [ -z "$SESSION_TOKEN1" ]; then
    echo "${RED}Failed to extract session token for first user${NC}"
    exit 1
fi

# sign out first user
echo "${YELLOW}Signing out first user...${NC}"
SIGN_OUT_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/sign-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1")
check_status
echo "${BLUE}Sign out response for first user:${NC}"

# Create second user
echo "${YELLOW}Creating second user...${NC}"
MAGIC_LINK_RESPONSE_2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8787" \
  -d '{"email":"test2@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status
echo "${BLUE}Magic link response for second user:${NC}"
echo "$MAGIC_LINK_RESPONSE_2"

# Extract magic link token for second user
MAGIC_TOKEN2=$(extract_magic_token "$MAGIC_LINK_RESPONSE_2")
if [ -z "$MAGIC_TOKEN2" ]; then
    echo "${RED}Failed to extract magic link token from response${NC}"
    echo "$MAGIC_LINK_RESPONSE_2"
    echo "${YELLOW}Getting token from database...${NC}"
    DB_RESPONSE=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM magic_links WHERE email = 'test2@example.com';" | cat)
    echo "${BLUE}Database response:${NC}"
    echo "$DB_RESPONSE"
    MAGIC_TOKEN2=$(echo "$DB_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -z "$MAGIC_TOKEN2" ]; then
        echo "${RED}No magic link token found in database${NC}"
        exit 1
    fi
    echo "${GREEN}Successfully extracted token from database: $MAGIC_TOKEN2${NC}"
fi

# Verify second user's magic link
echo "\n${YELLOW}Verifying second user's magic link...${NC}"
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
check_status
echo "${BLUE}Verification response for second user:${NC}"
echo "$VERIFY_RESPONSE2"

# Extract session token for second user
SESSION_TOKEN2=$(extract_token "$VERIFY_RESPONSE2")
if [ -z "$SESSION_TOKEN2" ]; then
    echo "${RED}Failed to extract session token for second user${NC}"
    exit 1
fi

# Second user tries to add John 3:16 (should fail with current schema)
echo "${YELLOW}Second user trying to add John 3:16...${NC}"
ADD_VERSE_RESPONSE2=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"reference":"John 3:16","text":"For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.","translation":"NIV"}')
echo "${BLUE}Add verse response for second user:${NC}"
echo "$ADD_VERSE_RESPONSE2"
