#!/bin/zsh

# Test script for user anonymization
# Usage: ./test-anonymization.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}Scripture Memory API Anonymization Test Script${NC}\n"

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
    npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS anonymized_users; PRAGMA foreign_keys = ON;" | cat
    check_status
fi

# Run initial schema
echo "${YELLOW}Running initial schema...${NC}"
npx wrangler d1 execute DB --env development --file="./schema.sql" | cat
check_status

# Run migrations
echo "${YELLOW}Running migrations...${NC}"
for migration in ./migrations/*.sql; do
    echo "${YELLOW}Running migration: $migration${NC}"
    npx wrangler d1 execute DB --env development --file="$migration" | cat
    check_status
done

# Create test user
echo "${YELLOW}Creating test user...${NC}"
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test-anonymize@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

# Extract magic link token
MAGIC_TOKEN=$(extract_magic_token "$MAGIC_LINK_RESPONSE")
echo "${BLUE}Magic token: $MAGIC_TOKEN${NC}"

# Verify magic link
echo "${YELLOW}Verifying magic link...${NC}"
VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
check_status

# Extract session token
SESSION_TOKEN=$(extract_token "$VERIFY_RESPONSE")
echo "${BLUE}Session token: $SESSION_TOKEN${NC}"

# Base timestamp (4 days ago)
BASE_TIMESTAMP=$(date -v-4d +%s)000

# Add verses
echo "${YELLOW}Adding verses...${NC}"
VERSES=(
  '{"reference":"Psalm 23:1","text":"The LORD is my shepherd, I lack nothing.","translation":"NIV"}'
  '{"reference":"Psalm 23:2","text":"He makes me lie down in green pastures, he leads me beside quiet waters.","translation":"NIV"}'
  '{"reference":"Psalm 23:3","text":"He refreshes my soul. He guides me along the right paths for his name'\''s sake.","translation":"NIV"}'
)

for verse in "${VERSES[@]}"; do
  ADD_RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "$verse")
  check_status
  echo "${BLUE}Added verse: $verse${NC}"
done

# Record progress over several days
echo "${YELLOW}Recording progress...${NC}"

# Function to record verse attempts
record_attempt() {
  local verse_ref=$1
  local words_correct=$2
  local total_words=$3
  local timestamp=$4
  
  ATTEMPT_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/verse \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"verse_reference\":\"$verse_ref\",\"words_correct\":$words_correct,\"total_words\":$total_words,\"created_at\":$timestamp}")
  check_status
  echo "${BLUE}Recorded attempt for $verse_ref: $words_correct/$total_words at $timestamp${NC}"
}

# Record attempts for Psalm 23:1 over 5 days
for i in {0..4}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  if [ $i -lt 2 ]; then
    # First 2 attempts are imperfect
    record_attempt "Psalm 23:1" 14 15 $TIMESTAMP
  else
    # Last 3 attempts are perfect
    record_attempt "Psalm 23:1" 15 15 $TIMESTAMP
  fi
done

# Record attempts for Psalm 23:2 over 3 days
for i in {0..4}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  record_attempt "Psalm 23:2" 15 15 $TIMESTAMP
done

# Record attempts for Psalm 23:3 over 2 days
for i in {0..1}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  record_attempt "Psalm 23:3" 10 15 $TIMESTAMP
done

# Add guess streak point events
echo "${YELLOW}Adding guess streak point events...${NC}"
for i in {1..5}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 3600000))) # 1 hour apart
  POINTS=$(echo "scale=1; $i * 0.5 + 0.5" | bc) # 1.0, 1.5, 2.0, 2.5, 3.0
  STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"event_type\":\"guess_streak\",\"points\":$POINTS,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added guess streak points: $POINTS at $TIMESTAMP${NC}"
done

# Log this user out to create a second user
echo "${YELLOW}Logging out...${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/sign-out \
    -H "Authorization: Bearer $SESSION_TOKEN")
check_status

# Create a new magic link for the second user
echo "${YELLOW}Creating new magic link...${NC}"
MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-anonymize2@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

# extract magic token for second user
MAGIC_TOKEN2=$(extract_magic_token "$MAGIC_LINK_RESPONSE")
echo "${BLUE}Magic token for second user: $MAGIC_TOKEN2${NC}"

# verify magic link for second user
echo "${YELLOW}Verifying magic link for second user...${NC}"
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
check_status

# extract session token for second user
SESSION_TOKEN2=$(extract_token "$VERIFY_RESPONSE2")
echo "${BLUE}Session token for second user: $SESSION_TOKEN2${NC}"

# add a verse to the second user
echo "${YELLOW}Adding verse to second user...${NC}"
ADD_VERSE_RESPONSE2=$(curl -s -X POST http://localhost:8787/verses \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d '{"reference":"John 3:17","text":"For God did not send his Son into the world to condemn the world, but to save the world through him.","translation":"NIV"}')
echo "${BLUE}Add verse response for second user:${NC}"
echo "$ADD_VERSE_RESPONSE2"
check_status

# record progress for the second user
echo "${YELLOW}Recording progress for second user...${NC}"
record_attempt "John 3:17" 10 15 $BASE_TIMESTAMP
check_status

# add guess streak point events for the second user
echo "${YELLOW}Adding guess streak point events for second user...${NC}"
for i in {1..5}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 3600000))) # 1 hour apart
  POINTS=$(echo "scale=1; $i * 0.5 + 0.5" | bc) # 1.0, 1.5, 2.0, 2.5, 3.0
  STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"event_type\":\"guess_streak\",\"points\":$POINTS,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added guess streak points: $POINTS at $TIMESTAMP${NC}"
done

# log out the second user
echo "${YELLOW}Logging out second user...${NC}"
LOGOUT_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/sign-out \
    -H "Authorization: Bearer $SESSION_TOKEN2")
check_status

# check the state of the database confirm that the first user has 6 total verses and the second user has 4 verses
echo "${YELLOW}Checking database state...${NC}"
VERSES_RESPONSE=$(npx wrangler d1 execute DB --env development --command="SELECT user_id, COUNT(*) as verse_count FROM verses GROUP BY user_id;")
check_status

# Extract just the JSON part of the response (everything between [ and ])
JSON_RESPONSE=$(echo "$VERSES_RESPONSE" | sed -n '/\[/,/\]/p')

# Extract the counts using grep and awk, looking inside the results array
USER1_COUNT=$(echo "$JSON_RESPONSE" | grep -A1 '"user_id": 1' | grep "verse_count" | awk '{print $2}' | tr -d ',')
USER2_COUNT=$(echo "$JSON_RESPONSE" | grep -A1 '"user_id": 2' | grep "verse_count" | awk '{print $2}' | tr -d ',')

echo "${BLUE}Verses:${NC}"
echo "$VERSES_RESPONSE"

# Verify the counts
if [ "$USER1_COUNT" != "6" ] || [ "$USER2_COUNT" != "4" ]; then
    echo "${RED}Error: Expected 6 verses for user 1 and 4 verses for user 2${NC}"
    echo "${RED}Found $USER1_COUNT verses for user 1 and $USER2_COUNT verses for user 2${NC}"
    exit 1
fi

echo "${GREEN}✓ Verse counts verified${NC}"

# create a new magic link for the first user
echo "${YELLOW}Creating new magic link for first user...${NC}"
MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-anonymize@example.com","isRegistration":false,"turnstileToken":"test-token"}')
check_status

# extract magic token for first user
MAGIC_TOKEN3=$(extract_magic_token "$MAGIC_LINK_RESPONSE3")
echo "${BLUE}Magic token for first user: $MAGIC_TOKEN3${NC}"

#check if the tester wants to log in in the browser
echo "${YELLOW}Do you want to log in in the browser? (y/n)${NC}"
read -r NEED_RELOGIN

if [ "$NEED_RELOGIN" = "y" ]; then
    #create the magic login link and copy it to the clipboard
    MAGIC_LINK3="http://localhost:5173/auth/verify?token=$MAGIC_TOKEN3"
    echo "$MAGIC_LINK3" | pbcopy
    echo "${GREEN}Magic link copied to clipboard!${NC}"
    echo "${BLUE}You can now paste this link in your browser to continue testing.${NC}"
    echo "${GREEN}Test completed successfully!${NC}" 
    exit 0
fi

# verify magic link for first user
echo "${YELLOW}Verifying magic link for first user...${NC}"
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
check_status

# extract session token for first user
SESSION_TOKEN3=$(extract_token "$VERIFY_RESPONSE3")
echo "${BLUE}Session token for first user: $SESSION_TOKEN3${NC}"


# Check stats before anonymization
echo "${YELLOW}Checking stats before anonymization...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats" \
  -H "Authorization: Bearer $SESSION_TOKEN3")
check_status
echo "${BLUE}Stats before anonymization:${NC}"
echo "$STATS_RESPONSE"

# Anonymize user
echo "${YELLOW}Anonymizing user...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE http://localhost:8787/auth/delete \
  -H "Authorization: Bearer $SESSION_TOKEN3")
DELETE_STATUS=$?
if [ $DELETE_STATUS -ne 0 ]; then
    echo "${RED}Failed to send delete request${NC}"
    exit 1
fi

# Check if the response contains an error
if [[ $DELETE_RESPONSE == *"error"* ]]; then
    echo "${RED}Delete failed: $DELETE_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Delete response: $DELETE_RESPONSE${NC}"

# Verify user was anonymized
echo "${YELLOW}Verifying anonymization...${NC}"
ANONYMIZED_DATA=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM anonymized_users ORDER BY id DESC LIMIT 1;" | cat)
check_status
echo "${BLUE}Anonymized data:${NC}"
echo "$ANONYMIZED_DATA"

# Verify user was deleted
echo "${YELLOW}Verifying user deletion...${NC}"
USER_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM users WHERE email = 'test-anonymize@example.com';" | cat)
check_status
echo "${BLUE}User check:${NC}"
echo "$USER_CHECK"

# check database to ensure that the second user still exists, has verses and stats, and is unchanged
echo "${YELLOW}Checking database state for second user...${NC}"

# Get user data
USER_CHECK2=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM users WHERE email = 'test-anonymize2@example.com';" | cat)
check_status

# Get verse count
VERSE_COUNT2=$(npx wrangler d1 execute DB --env development --command="SELECT COUNT(*) as count FROM verses WHERE user_id = 2;" | cat)
check_status

# Get stats data
STATS_CHECK2=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM user_stats WHERE user_id = 2;" | cat)
check_status

# Get point events
POINTS_CHECK2=$(npx wrangler d1 execute DB --env development --command="SELECT COUNT(*) as count FROM point_events WHERE user_id = 2;" | cat)
check_status

echo "${BLUE}User data:${NC}"
echo "$USER_CHECK2"
echo "${BLUE}Verse count:${NC}"
echo "$VERSE_COUNT2"
echo "${BLUE}Stats data:${NC}"
echo "$STATS_CHECK2"
echo "${BLUE}Point events:${NC}"
echo "$POINTS_CHECK2"

# Extract just the JSON part of each response
USER_JSON=$(echo "$USER_CHECK2" | sed -n '/\[/,/\]/p')
VERSE_JSON=$(echo "$VERSE_COUNT2" | sed -n '/\[/,/\]/p')
STATS_JSON=$(echo "$STATS_CHECK2" | sed -n '/\[/,/\]/p')
POINTS_JSON=$(echo "$POINTS_CHECK2" | sed -n '/\[/,/\]/p')

# Extract and verify the counts
VERSE_COUNT=$(echo "$VERSE_JSON" | grep -A1 '"count":' | grep "count" | awk '{print $2}' | tr -d ',')
POINTS_COUNT=$(echo "$POINTS_JSON" | grep -A1 '"count":' | grep "count" | awk '{print $2}' | tr -d ',')

# Verify all the expected data
if [ "$VERSE_COUNT" != "4" ]; then
    echo "${RED}Error: Expected 4 verses for user 2, found $VERSE_COUNT${NC}"
    exit 1
fi

if [ "$POINTS_COUNT" != "7" ]; then
    echo "${RED}Error: Expected 7 point events for user 2, found $POINTS_COUNT${NC}"
    exit 1
fi

# Verify the user exists and has the correct email
if ! echo "$USER_JSON" | grep -q '"email": "test-anonymize2@example.com"'; then
    echo "${RED}Error: User 2 not found or has incorrect email${NC}"
    exit 1
fi

# Verify stats exist
if ! echo "$STATS_JSON" | grep -q '"user_id": 2'; then
    echo "${RED}Error: Stats not found for user 2${NC}"
    exit 1
fi

echo "${GREEN}✓ All user 2 data verified${NC}"

echo "${GREEN}Test completed successfully!${NC}" 