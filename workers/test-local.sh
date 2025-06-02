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
npx wrangler d1 execute DB --env development --file=./schema_test.sql
check_status


# Get the user ID (will always be 1 since we clean the database)
USER_ID=1
echo "${GREEN}Using user ID: $USER_ID${NC}"

echo "Checking for user existence at line 100..."
USERCHECK1=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM users WHERE LOWER(email) = LOWER('test@example.com');")
echo "${BLUE}User check response:${NC}"
echo "$USERCHECK1"
check_status

echo "Checking verses before first migration..."
npx wrangler d1 execute DB --env development --command="SELECT * FROM verses WHERE user_id = 1;"
echo "Checking all tables before first migration..."
npx wrangler d1 execute DB --env development --command="SELECT name FROM sqlite_master WHERE type='table';"

# 4. Run migrations in correct order
echo "${YELLOW}Running migrations...${NC}"

# 4.1 Add unique constraint first
echo "${YELLOW}running new initial schema...${NC}"
npx wrangler d1 execute DB --env development --file=./migrations/0000_2_gamification_update.sql
check_status

echo "Checking verses after first migration..."
npx wrangler d1 execute DB --env development --command="SELECT * FROM verses WHERE user_id = 1;"
echo "Checking all tables after first migration..."
npx wrangler d1 execute DB --env development --command="SELECT name FROM sqlite_master WHERE type='table';"

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

echo "Checking for user existence at line 127..."
echo "Checking users table structure..."
npx wrangler d1 execute DB --env development --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='users';"
echo "Checking all tables..."
npx wrangler d1 execute DB --env development --command="SELECT name FROM sqlite_master WHERE type='table';"
echo "Checking user data..."
npx wrangler d1 execute DB --env development --command="SELECT * FROM users WHERE LOWER(email) = LOWER('test@example.com');"

echo "${YELLOW}Logging back in after migrations...${NC}"
MAGIC_LINK_RESPONSE_2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8787" \
  -d '{"email":"test@example.com","isRegistration":false,"turnstileToken":"test-token"}')
check_status
echo "${BLUE}Magic link response:${NC}"
echo "$MAGIC_LINK_RESPONSE_2"

# Extract magic link token from response
MAGIC_TOKEN2=$(extract_magic_token "$MAGIC_LINK_RESPONSE_2")
if [ -z "$MAGIC_TOKEN2" ]; then
    echo "${RED}Failed to extract magic link token from response${NC}"
    echo "$MAGIC_LINK_RESPONSE_2"
    echo "${YELLOW}Getting token from database...${NC}"
    # Get the most recent magic link token
    DB_RESPONSE=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM magic_links WHERE email = 'test@example.com';" | cat)
    echo "${BLUE}Database response:${NC}"
    echo "$DB_RESPONSE"
    
    # Extract the token from the results array
    MAGIC_TOKEN2=$(echo "$DB_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$MAGIC_TOKEN2" ]; then
        echo "${RED}No magic link token found in database${NC}"
        exit 1
    fi
    echo "${GREEN}Successfully extracted token from database: $MAGIC_TOKEN2${NC}"
fi

echo "\n${GREEN}Magic link token: $MAGIC_TOKEN2${NC}"

# Ask if user needs a browser login link
echo "\n${YELLOW}Would you like a browser login link? (y/n)${NC}"
read -r NEED_BROWSER_LINK

if [ "$NEED_BROWSER_LINK" = "y" ]; then
    # Create a browser-friendly login link
    BROWSER_LINK="http://localhost:5173/auth/verify?token=$MAGIC_TOKEN2"
    echo "\n${GREEN}Browser Login Link:${NC}"
    echo "${BLUE}$BROWSER_LINK${NC}"
    # Copy to clipboard
    echo "$BROWSER_LINK" | pbcopy
    echo "\n${GREEN}✓ Link copied to clipboard${NC}"
    echo "\nOpen this link in your browser to log in"
    echo "\n${YELLOW}Press Enter when you've used the browser link to continue with the test script...${NC}"
    read -r
fi

# 3. Verify Magic Link (Login)
echo "\n${YELLOW}Verifying magic link...${NC}"
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
check_status

echo "${BLUE}Verification response:${NC}"
echo "$VERIFY_RESPONSE2"

# Extract session token
SESSION_TOKEN2=$(extract_token "$VERIFY_RESPONSE2")
if [ -z "$SESSION_TOKEN2" ]; then
    echo "${RED}Failed to extract session token${NC}"
    exit 1
fi

echo "\n${GREEN}Session token: $SESSION_TOKEN2${NC}"

# Base timestamp for all events
BASE_TIMESTAMP=1748631950215

echo "${YELLOW}Adding new verse after points system...${NC}"
ADD_VERSE_RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"reference\":\"Psalm 23:1\",\"text\":\"The LORD is my shepherd, I lack nothing.\",\"translation\":\"NIV\",\"created_at\":$BASE_TIMESTAMP}")
check_status
echo "${BLUE}Add verse response:${NC}"
echo "$ADD_VERSE_RESPONSE"

echo "${YELLOW}Checking stats after adding verse...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$BASE_TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats after adding verse:${NC}"
echo "$STATS_RESPONSE"

echo "${YELLOW}Recording progress on initial verse...${NC}"
PROGRESS_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/word \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"verse_reference\":\"Psalm 23:1\",\"word_index\":0,\"word\":\"The\",\"is_correct\":true,\"created_at\":$BASE_TIMESTAMP}")
check_status
echo "${BLUE}Record progress response:${NC}"
echo "$PROGRESS_RESPONSE"

echo "${YELLOW}Checking stats after word progress...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$BASE_TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats after word progress:${NC}"
echo "$STATS_RESPONSE"

echo "${YELLOW}Recording verse attempt...${NC}"
ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":10,\"total_words\":15,\"created_at\":$BASE_TIMESTAMP}")
check_status
echo "${BLUE}Record attempt response:${NC}"
echo "$ATTEMPT_RESPONSE"

echo "${YELLOW}Checking stats after first attempt (should still have streak=1)...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$BASE_TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats after first attempt:${NC}"
echo "$STATS_RESPONSE"

# Add more attempts to work towards mastery
echo "${YELLOW}Recording more verse attempts for mastery...${NC}"
# First 2 attempts with some mistakes to build up total attempts
for i in {1..2}; do
  # Each attempt is 1 day apart
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":10,\"total_words\":15,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE"
done

# Add 3 more attempts with some mistakes
for i in {1..3}; do
  # Each attempt is 1 day apart
  TIMESTAMP=$((BASE_TIMESTAMP + ((i + 2) * 86400000)))  # Start 2 days after last attempt
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":10,\"total_words\":15,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE"
done

# Add 3 perfect attempts in a row to achieve mastery
echo "${YELLOW}Adding perfect attempts to achieve mastery...${NC}"
for i in {1..3}; do
  # Each attempt is 1 day apart
  TIMESTAMP=$((BASE_TIMESTAMP + ((i + 5) * 86400000)))  # Start 5 days after last attempt
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":15,\"total_words\":15,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE"
done

# Add 2 more perfect attempts
for i in {1..2}; do
  # Each attempt is 1 day apart
  TIMESTAMP=$((BASE_TIMESTAMP + ((i + 8) * 86400000)))  # Start 8 days after last attempt
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":15,\"total_words\":15,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE"
done

# Check stats immediately after mastery attempts
echo "${YELLOW}Checking stats immediately after mastery attempts...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats immediately after mastery attempts:${NC}"
echo "$STATS_RESPONSE"

# Add a longer delay to ensure mastery check completes
echo "${YELLOW}Waiting for mastery check to complete...${NC}"
sleep 10

# Test mastery progress endpoint
echo "${YELLOW}Testing mastery progress endpoint...${NC}"
MASTERY_PROGRESS_RESPONSE=$(curl -s -X GET "http://localhost:8787/progress/mastery/Psalm%2023:1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Mastery progress response:${NC}"
echo "$MASTERY_PROGRESS_RESPONSE"

# Verify the response contains expected data
if echo "$MASTERY_PROGRESS_RESPONSE" | grep -q '"perfectAttemptsInRow":5'; then
  echo "${GREEN}✓ Correct number of perfect attempts in a row${NC}"
else
  echo "${RED}✗ Incorrect number of perfect attempts in a row${NC}"
  echo "${YELLOW}Waiting another 5 seconds and checking again...${NC}"
  sleep 5
  MASTERY_PROGRESS_RESPONSE=$(curl -s -X GET "http://localhost:8787/progress/mastery/Psalm%2023:1" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2")
  echo "${BLUE}Second mastery progress response:${NC}"
  echo "$MASTERY_PROGRESS_RESPONSE"
  if echo "$MASTERY_PROGRESS_RESPONSE" | grep -q '"perfectAttemptsInRow":5'; then
    echo "${GREEN}✓ Correct number of perfect attempts in a row (after retry)${NC}"
  else
    echo "${RED}✗ Still incorrect number of perfect attempts in a row${NC}"
    exit 1
  fi
fi

if echo "$MASTERY_PROGRESS_RESPONSE" | grep -q '"recordedAttempts":11'; then
  echo "${GREEN}✓ Correct total number of recorded attempts${NC}"
else
  echo "${RED}✗ Incorrect total number of recorded attempts${NC}"
  exit 1
fi

# Verify mastery points were awarded
echo "${YELLOW}Checking stats after mastery...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats after mastery:${NC}"
echo "$STATS_RESPONSE"

# Verify verses_mastered and total_points
if echo "$STATS_RESPONSE" | grep -q '"verses_mastered":1'; then
  echo "${GREEN}✓ Verse marked as mastered${NC}"
else
  echo "${RED}✗ Verse not marked as mastered${NC}"
  echo "${YELLOW}Waiting another 5 seconds and checking again...${NC}"
  sleep 5
  STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2")
  echo "${BLUE}Second stats check:${NC}"
  echo "$STATS_RESPONSE"
  if echo "$STATS_RESPONSE" | grep -q '"verses_mastered":1'; then
    echo "${GREEN}✓ Verse marked as mastered (after retry)${NC}"
  else
    echo "${RED}✗ Still not marked as mastered${NC}"
    exit 1
  fi
fi

if echo "$STATS_RESPONSE" | grep -q '"total_points":1186'; then
  echo "${GREEN}✓ Correct total points (including mastery bonus)${NC}"
else
  echo "${RED}✗ Incorrect total points${NC}"
  echo "${YELLOW}Waiting another 5 seconds and checking again...${NC}"
  sleep 5
  STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2")
  echo "${BLUE}Second stats check:${NC}"
  echo "$STATS_RESPONSE"
  if echo "$STATS_RESPONSE" | grep -q '"total_points":1186'; then
    echo "${GREEN}✓ Correct total points (after retry)${NC}"
  else
    echo "${RED}✗ Still incorrect total points${NC}"
    exit 1
  fi
fi

# Add another verse (1 day after last attempt)
TIMESTAMP=$((BASE_TIMESTAMP + (6 * 86400000)))  # Add 6 days (1 day after last attempt)
echo "${YELLOW}Adding another verse on next day...${NC}"
ADD_VERSE_RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"reference\":\"Psalm 23:3\",\"text\":\"He refreshes my soul. He guides me along the right paths for his name's sake.\",\"translation\":\"NIV\",\"created_at\":$TIMESTAMP}")
check_status
echo "${BLUE}Add verse response:${NC}"
echo "$ADD_VERSE_RESPONSE"

echo "${YELLOW}Checking stats after adding verse on next day...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats after adding verse on next day:${NC}"
echo "$STATS_RESPONSE"

# Check final stats
echo "${YELLOW}Checking final stats...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Final stats:${NC}"
echo "$STATS_RESPONSE"

echo -e "\n=== Testing verse deletion ==="

echo -e "\n=== Testing unauthorized verse deletion ==="
# Try to delete verse without auth
UNAUTH_DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8787/verses/Psalm%2023:3")
echo "Unauthorized delete response:"
echo $UNAUTH_DELETE_RESPONSE | jq

echo -e "\n=== Testing non-existent verse deletion ==="
# Try to delete non-existent verse
NOT_FOUND_DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8787/verses/NonExistentVerse" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
echo "Not found delete response:"
echo $NOT_FOUND_DELETE_RESPONSE | jq

echo -e "\n=== Testing successful verse deletion ==="
# Delete Psalm 23:3
DELETE_RESPONSE=$(curl -s -X DELETE "http://localhost:8787/verses/Psalm%2023:3" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
echo "Delete response status: $DELETE_RESPONSE"

# Verify verse was deleted by trying to get it
GET_RESPONSE=$(curl -s -X GET "http://localhost:8787/verses" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
echo "Remaining verses:"
echo $GET_RESPONSE | jq

echo -e "\n=== Checking stats after verse deletion ==="
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats?timestamp=$TIMESTAMP" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
echo "Stats after verse deletion:"
echo $STATS_RESPONSE | jq

# Add confirmation step before deleting user
echo "\n${YELLOW}Would you like to delete the test user? (y/n)${NC}"
read -r DELETE_USER

if [ "$DELETE_USER" = "y" ]; then
    echo "${YELLOW}Deleting user...${NC}"
    DELETE_RESPONSE=$(curl -s -i -X DELETE http://localhost:8787/auth/delete \
      -H "Authorization: Bearer $SESSION_TOKEN2")
    check_status
    echo "${BLUE}Delete response:${NC}"
    echo "$DELETE_RESPONSE"
else
    echo "${YELLOW}Skipping user deletion${NC}"
fi

echo "\n${GREEN}Test completed successfully!${NC}" 