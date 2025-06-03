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

BASE_TIMESTAMP=1713801600
echo "\n${GREEN}Session token: $SESSION_TOKEN2${NC}"

echo "${YELLOW}Adding new verse...${NC}"
ADD_VERSE_RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"reference\":\"Psalm 23:1\",\"text\":\"The LORD is my shepherd, I lack nothing.\",\"translation\":\"NIV\",\"created_at\":$BASE_TIMESTAMP}")
check_status
echo "${BLUE}Add verse response:${NC}"
echo "$ADD_VERSE_RESPONSE"

echo "${YELLOW}Adding imperfect attempts to get to 5 total attempts later...${NC}"

  TIMESTAMP1=$((BASE_TIMESTAMP + 86400000)) # Start 1 day after last attempt
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":14,\"total_words\":15,\"created_at\":$TIMESTAMP1}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE"

  TIMESTAMP2=$((TIMESTAMP1 + 86400000)) # Start 1 day after last attempt
  ATTEMPT_RESPONSE5=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":14,\"total_words\":15,\"created_at\":$TIMESTAMP2}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE2"

# Add perfect attempt

  TIMESTAMP3=$((TIMESTAMP2 + 86400000))  # 1 day has passed, so we add another day
  ATTEMPT_RESPONSE3=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":15,\"total_words\":15,\"created_at\":$TIMESTAMP3}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE3"


  TIMESTAMP4=$((TIMESTAMP3 + 86400000))  # one more day
  ATTEMPT_RESPONSE4=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"words_correct\":15,\"total_words\":15,\"created_at\":$TIMESTAMP4}")
  check_status
  echo "${BLUE}Record attempt response:${NC}"
  echo "$ATTEMPT_RESPONSE4"

echo "${YELLOW}Logging in again for the purposes of creating a new magic link...${NC}"
MAGIC_LINK_RESPONSE_3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:8787" \
  -d '{"email":"test@example.com","isRegistration":false,"turnstileToken":"test-token"}')
check_status
echo "${BLUE}Magic link response:${NC}"
echo "$MAGIC_LINK_RESPONSE_3"

# Extract magic link token from response
MAGIC_TOKEN3=$(extract_magic_token "$MAGIC_LINK_RESPONSE_3")
if [ -z "$MAGIC_TOKEN3" ]; then
    echo "${RED}Failed to extract magic link token from response${NC}"
    echo "$MAGIC_LINK_RESPONSE_3"
    echo "${YELLOW}Getting token from database...${NC}"
    # Get the most recent magic link token
    DB_RESPONSE=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM magic_links WHERE email = 'test@example.com';" | cat)
    echo "${BLUE}Database response:${NC}"
    echo "$DB_RESPONSE"
    
    # Extract the token from the results array
    MAGIC_TOKEN3=$(echo "$DB_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$MAGIC_TOKEN3" ]; then
        echo "${RED}No magic link token found in database${NC}"
        exit 1
    fi
    echo "${GREEN}Successfully extracted token from database: $MAGIC_TOKEN3${NC}"
fi

echo "\n${GREEN}Magic link token: $MAGIC_TOKEN3${NC}"


    # Create a browser-friendly login link
    BROWSER_LINK="http://localhost:5173/auth/verify?token=$MAGIC_TOKEN3"
    echo "\n${GREEN}Browser Login Link:${NC}"
    echo "${BLUE}$BROWSER_LINK${NC}"
    # Copy to clipboard
    echo "$BROWSER_LINK" | pbcopy
    echo "\n${GREEN}✓ Link copied to clipboard${NC}"
    echo "\nOpen this link in your browser to log in"
    echo "\n${YELLOW}Press Enter when you've used the browser link to close the test script...${NC}"
    read -r



echo "\n${GREEN}Test completed successfully!${NC}" 