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

# Function to get magic link token from Wrangler output
get_magic_token() {
    echo "${YELLOW}Please enter the magic link token from the Wrangler console output:${NC}"
    read -r MAGIC_TOKEN
    echo "$MAGIC_TOKEN"
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

# 0. Run Migrations (if needed)
echo "${YELLOW}Do you need to run the database migrations? (y/n)${NC}"
read -r RUN_MIGRATIONS

if [ "$RUN_MIGRATIONS" = "y" ]; then
    echo "${YELLOW}Running database migrations...${NC}"
    npx wrangler d1 execute DB --env development --file=./migrations/0000_initial_schema.sql
    npx wrangler d1 execute DB --env development --file=./migrations/0001_add_progress_tables.sql
    npx wrangler d1 execute DB --env development --file=./migrations/0002_add_gamification_tables.sql
    npx wrangler d1 execute DB --env development --file=./migrations/0003_add_unique_constraint_to_verses_reference.sql
    npx wrangler d1 execute DB --env development --file=./migrations/0004_add_mastered_verses.sql
    check_status
fi

# 0. Create test user
echo "${YELLOW}Creating test user...${NC}"
CREATE_USER_RESPONSE=$(npx wrangler d1 execute DB --env development --command="INSERT INTO users (email, created_at) VALUES ('test@example.com', strftime('%s','now') * 1000);")
check_status

# 1. Request Magic Link
echo "${YELLOW}Requesting magic link...${NC}"
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8787" \
  -d '{"email":"test@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

echo "${BLUE}Magic link response:${NC}"
echo "$MAGIC_LINK_RESPONSE"

# Extract magic link token from response
MAGIC_TOKEN=$(extract_magic_token "$MAGIC_LINK_RESPONSE")
if [ -z "$MAGIC_TOKEN" ]; then
    echo "${RED}Failed to extract magic link token from response${NC}"
    exit 1
fi

echo "\n${GREEN}Magic link token: $MAGIC_TOKEN${NC}"

# 2. Verify Magic Link (Login)
echo "\n${YELLOW}Verifying magic link...${NC}"
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
check_status

echo "${BLUE}Verification response:${NC}"
echo "$VERIFY_RESPONSE"

# Extract session token
SESSION_TOKEN=$(extract_token "$VERIFY_RESPONSE")
if [ -z "$SESSION_TOKEN" ]; then
    echo "${RED}Failed to extract session token${NC}"
    exit 1
fi

echo "\n${GREEN}Session token: $SESSION_TOKEN${NC}"

# 3. Add a Verse
echo "\n${YELLOW}Adding a verse...${NC}"
ADD_VERSE_RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"reference":"John 3:16","text":"For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.","translation":"NIV","status":"not_started"}')
check_status

echo "${BLUE}Add verse response:${NC}"
echo "$ADD_VERSE_RESPONSE"

# 4. Get All Verses
echo "\n${YELLOW}Getting all verses...${NC}"
GET_VERSES_RESPONSE=$(curl -s -X GET http://localhost:8787/verses \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

echo "${BLUE}Get verses response:${NC}"
echo "$GET_VERSES_RESPONSE"

# 5. Record Verse Progress
echo "\n${YELLOW}Recording verse progress...${NC}"
PROGRESS_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"verse_reference":"John 3:16","words_correct":10,"total_words":10}')
check_status

echo "${BLUE}Progress response:${NC}"
echo "$PROGRESS_RESPONSE"

# 6. Get User Stats
echo "\n${YELLOW}Getting user stats...${NC}"
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/gamification/stats \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

echo "${BLUE}Stats response:${NC}"
echo "$STATS_RESPONSE"

# 7. Record Point Event
echo "\n${YELLOW}Recording point event...${NC}"
POINTS_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"event_type":"verse_mastered","points":10,"metadata":{"verse_reference":"John 3:16"}}')
check_status

echo "${BLUE}Points response:${NC}"
echo "$POINTS_RESPONSE"

# 8. Delete User
echo "\n${YELLOW}Deleting user...${NC}"
echo "${RED}WARNING: This will permanently delete the user and all associated data${NC}"
echo "${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
read

DELETE_RESPONSE=$(curl -s -i -X DELETE http://localhost:8787/auth/delete \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

echo "${BLUE}Delete response:${NC}"
echo "$DELETE_RESPONSE"

# Check if delete was successful (204 No Content)
if [[ "$DELETE_RESPONSE" == *"204 No Content"* ]]; then
    echo "${GREEN}User deleted successfully${NC}"
else
    echo "${RED}Failed to delete user${NC}"
    exit 1
fi

echo "\n${GREEN}All tests completed successfully!${NC}" 