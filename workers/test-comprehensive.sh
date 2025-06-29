#!/bin/zsh

# Comprehensive Test Script for Scripture Memory API
# ===============================================
#
# Purpose:
# ---------
# This script tests the complete functionality of the Scripture Memory API endpoints,
# including user authentication, verse management, progress tracking, and points system.
# It also generates magic links for testing both desktop and mobile browsers.
#
# Usage:
# ------
# 1. Start the Wrangler dev server: npx wrangler dev --env development
# 2. Run this script: ./test-comprehensive.sh
# 3. Follow the prompts to:
#    - Confirm server is running
#    - Confirm database is clean (or let script clean it)
# 4. The script will:
#    - Set up test users
#    - Add test verses
#    - Record progress
#    - Generate points
#    - Test anonymization
#
# Testing Options:
# ---------------
# When prompted:
# - Answer "n" to both "Do you want a phone link?" and "Do you want to log in in the browser?"
#   This will test the user anonymization functionality, which:
#   - Verifies user data is properly anonymized
#   - Confirms user is deleted from the users table
#   - Ensures other users' data remains unchanged
#
# Expected Points Breakdown:
# ------------------------
# User 1 (test-anonymize@example.com):
# - Verse Additions:
#   * Psalm 23:1: 10 points (new verse)
#   * Psalm 23:2: 10 points (new verse)
#   * Psalm 23:3: 10 points (new verse)
# - Verse Mastery:
#   * Psalm 23:1: 500 points (mastered)
#   * Psalm 23:2: 500 points (mastered)
#   * Psalm 23:3: 0 points (not mastered)
# - Guess Streaks:
#   * 5 streak events (1.0, 1.5, 2.0, 2.5, 3.0) = 10 points
# Total Points: 1030 points
#
# User 2 (test-anonymize2@example.com):
# - Verse Additions:
#   * John 3:17: 10 points (new verse)
# - Guess Streaks:
#   * 5 streak events (1.0, 1.5, 2.0, 2.5, 3.0) = 10 points
# Total Points: 20 points
#
# Testing Mobile:
# --------------
# When prompted "Do you want a phone link?", answer "y" to:
# 1. The script will automatically:
#    - Detect your local IP address
#    - Generate a complete magic link with your IP
#    - Copy the link to your clipboard
# 2. You can then:
#    - Text the link to yourself
#    - Open it on your mobile device
#    - Test the mobile experience
#
# Testing Desktop:
# ---------------
# When prompted:
# 1. Answer "n" to "Do you want a phone link?"
# 2. Answer "y" to "Do you want to log in in the browser?"
# The script will:
# - Generate a localhost magic link
# - Copy it to your clipboard
# - Exit, leaving the database intact for evaluation
#
# Note: If you answer "y" to either prompt, the script will:
# - Copy the appropriate magic link to your clipboard
# - Exit immediately
# - Leave the database in its current state for testing
#
# Note: This script requires:
# - A running Wrangler dev server
# - A clean database (or permission to clean it)
# - curl installed
# - bc installed for floating-point calculations

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
    npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS user_permissions; DROP TABLE IF EXISTS admin_audit_log; DROP TABLE IF EXISTS super_admins; DROP TABLE IF EXISTS group_invitations; DROP TABLE IF EXISTS group_members; DROP TABLE IF EXISTS groups; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS anonymized_users; PRAGMA foreign_keys = ON;" | cat
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
    # First 2 attempts are imperfect (14/15)
    record_attempt "Psalm 23:1" 14 15 $TIMESTAMP
  else
    # Last 3 attempts are perfect (15/15)
    record_attempt "Psalm 23:1" 15 15 $TIMESTAMP
  fi
done

# Record attempts for Psalm 23:2 over 5 days
for i in {0..4}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  record_attempt "Psalm 23:2" 15 15 $TIMESTAMP
done

# Record attempts for Psalm 23:3 over 4 days
for i in {0..3}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 86400000)))
  if [ $i -lt 2 ]; then
    # First 2 attempts are imperfect (14/15)
    record_attempt "Psalm 23:3" 14 15 $TIMESTAMP
  else
    # Last 2 attempts are perfect (15/15)
    record_attempt "Psalm 23:3" 15 15 $TIMESTAMP
  fi
done
check_status

# --- Word Guess Flow: Mimic 'Start Memorizing' (Single-Word Input) ---
echo "${YELLOW}Simulating word guesses for Psalm 23:1...${NC}"
PSALM_23_1_WORDS=("The" "LORD" "is" "my" "shepherd," "I" "lack" "nothing.")
for idx in {1..${#PSALM_23_1_WORDS[@]}}; do
  word=${PSALM_23_1_WORDS[$idx]}
  WORD_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/word \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"verse_reference\":\"Psalm 23:1\",\"word_index\":$((idx-1)),\"word\":\"$word\",\"is_correct\":true,\"created_at\":$BASE_TIMESTAMP}")
  check_status
  echo "${BLUE}Guessed word '$word' for Psalm 23:1 at index $((idx-1))${NC}"
done

echo "${YELLOW}Simulating word guesses for Psalm 23:2...${NC}"
PSALM_23_2_WORDS=("He" "makes" "me" "lie" "down" "in" "green" "pastures," "he" "leads" "me" "beside" "quiet" "waters.")
for idx in {1..${#PSALM_23_2_WORDS[@]}}; do
  word=${PSALM_23_2_WORDS[$idx]}
  WORD_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/word \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"verse_reference\":\"Psalm 23:2\",\"word_index\":$((idx-1)),\"word\":\"$word\",\"is_correct\":true,\"created_at\":$BASE_TIMESTAMP}")
  check_status
  echo "${BLUE}Guessed word '$word' for Psalm 23:2 at index $((idx-1))${NC}"
done

echo "${YELLOW}Simulating word guesses for Psalm 23:3...${NC}"
PSALM_23_3_WORDS=("He" "refreshes" "my" "soul." "He" "guides" "me" "along" "the" "right" "paths" "for" "his" "name's" "sake.")
for idx in {1..${#PSALM_23_3_WORDS[@]}}; do
  word=${PSALM_23_3_WORDS[$idx]}
  WORD_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/word \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"verse_reference\":\"Psalm 23:3\",\"word_index\":$((idx-1)),\"word\":\"$word\",\"is_correct\":true,\"created_at\":$BASE_TIMESTAMP}")
  check_status
  echo "${BLUE}Guessed word '$word' for Psalm 23:3 at index $((idx-1))${NC}"
done

# Add guess streak point events
echo "${YELLOW}Adding guess streak point events...${NC}"
for i in {1..5}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 3600000))) # 1 hour apart
  POINTS=$(echo "scale=1; $i * 0.5 + 0.5" | bc) # 1.0, 1.5, 2.0, 2.5, 3.0
  STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN" \
    -d "{\"event_type\":\"word_correct\",\"points\":$POINTS,\"metadata\":{\"streak_length\":$i},\"created_at\":$TIMESTAMP}")
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

# Test long verse streak with Jeremiah 29:11 (which is automatically added for new users)
echo "${YELLOW}Testing long verse streak with Jeremiah 29:11...${NC}"

# Record a long streak of correct word guesses
for i in {0..14}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 3600000))) # 1 hour apart
  WORD_RESPONSE=$(curl -s -X POST http://localhost:8787/progress/word \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"verse_reference\":\"Jeremiah 29:11\",\"word_index\":$i,\"word\":\"word$i\",\"is_correct\":true,\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Recorded word progress for Jeremiah 29:11: word $i at $TIMESTAMP${NC}"
done

# Verify the streak was recorded correctly
echo "${YELLOW}Verifying long verse streak...${NC}"
STREAK_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT current_verse_streak, current_verse_reference FROM user_stats WHERE user_id = 2;" | cat)
check_status
echo "${BLUE}Verse streak data:${NC}"
echo "$STREAK_CHECK"

# Extract and verify the streak data
STREAK_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT current_verse_streak, current_verse_reference FROM user_stats WHERE user_id = 2;" | cat)
# Extract just the JSON part of the response (everything between [ and ])
STREAK_JSON=$(echo "$STREAK_CHECK" | sed -n '/\[/,/\]/p')
STREAK_COUNT=$(echo "$STREAK_JSON" | grep -A1 '"current_verse_streak":' | grep "current_verse_streak" | awk '{print $2}' | tr -d ',')
VERSE_REF=$(echo "$STREAK_JSON" | grep -A1 '"current_verse_reference":' | grep "current_verse_reference" | awk -F'"' '{print $4}')

# Verify the streak data
if [ "$STREAK_COUNT" != "15" ]; then
    echo "${RED}Error: Expected streak count of 15, found $STREAK_COUNT${NC}"
    exit 1
fi

if [ "$VERSE_REF" != "Jeremiah 29:11" ]; then
    echo "${RED}Error: Expected verse reference Jeremiah 29:11, found $VERSE_REF${NC}"
    exit 1
fi

echo "${GREEN}✓ Long verse streak verified${NC}"

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
    -d "{\"event_type\":\"word_correct\",\"points\":$POINTS,\"metadata\":{\"streak_length\":$i},\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added guess streak points: $POINTS at $TIMESTAMP${NC}"
done

# Test adding verse set to existing user (user 2)
echo "${YELLOW}Testing add verse set to existing user...${NC}"
ADD_VERSESET_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/add-verses \
    -H "Content-Type: application/json" \
    -d '{"email":"test-anonymize2@example.com","verseSet":"gpc_youth","turnstileToken":"test-token"}')
check_status
echo "${BLUE}Add verse set response:${NC}"
echo "$ADD_VERSESET_RESPONSE"

# Verify that the GPC Youth verses were added to user 2
echo "${YELLOW}Verifying GPC Youth verses were added to user 2...${NC}"
GPC_VERSES_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT reference FROM verses WHERE user_id = 2 AND reference IN ('Deuteronomy 29:29', 'Proverbs 1:7', 'Psalm 119:105', 'Proverbs 3:5');")
check_status
echo "${BLUE}GPC Youth verses check:${NC}"
echo "$GPC_VERSES_CHECK"

# Count how many GPC Youth verses were added
GPC_VERSES_COUNT=$(echo "$GPC_VERSES_CHECK" | grep -c "Deuteronomy 29:29\|Proverbs 1:7\|Psalm 119:105\|Proverbs 3:5" || echo "0")
echo "${BLUE}GPC Youth verses count: $GPC_VERSES_COUNT${NC}"

# Verify that the verses were added (should be 4 new verses)
if [ "$GPC_VERSES_COUNT" != "4" ]; then
    echo "${RED}Error: Expected 4 GPC Youth verses to be added, found $GPC_VERSES_COUNT${NC}"
    exit 1
fi

echo "${GREEN}✓ GPC Youth verses successfully added to user 2${NC}"

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
if [ "$USER1_COUNT" != "6" ] || [ "$USER2_COUNT" != "10" ]; then
    echo "${RED}Error: Expected 6 verses for user 1 and 10 verses for user 2${NC}"
    echo "${RED}Found $USER1_COUNT verses for user 1 and $USER2_COUNT verses for user 2${NC}"
    exit 1
fi

echo "${GREEN}✓ Verse counts verified${NC}"

# create a third user with a custom verse set
echo "${YELLOW}Creating third user with custom verse set...${NC}"
MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-anonymize3@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses"}')
check_status

# extract magic token for third user
MAGIC_TOKEN3=$(extract_magic_token "$MAGIC_LINK_RESPONSE3")
echo "${BLUE}Magic token for third user: $MAGIC_TOKEN3${NC}"
check_status

#log in the third user
echo "${YELLOW}Logging in third user...${NC}"
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
check_status
SESSION_TOKEN3=$(extract_token "$VERIFY_RESPONSE3")
echo "${BLUE}Session token for third user: $SESSION_TOKEN3${NC}"

# verify the third user has the correct verses
echo "${YELLOW}Verifying third user has correct verses...${NC}"
VERSES_RESPONSE3=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM verses WHERE user_id = 3;")
check_status
 # fail if the verses are not the childrens verses
if ! echo "$VERSES_RESPONSE3" | grep -q "Genesis 1:1"; then
    echo "${RED}Error: Third user does not have the correct verses${NC}"
    echo "${BLUE}Verses:${NC}"
    echo "$VERSES_RESPONSE3"
    exit 1
fi

echo "${GREEN}✓ Third user has correct verses${NC}"

#log out the third user
echo "${YELLOW}Logging out third user...${NC}"
LOGOUT_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/sign-out \
    -H "Authorization: Bearer $SESSION_TOKEN3")
check_status

# create a new magic link for the first user
echo "${YELLOW}Creating new magic link for first user...${NC}"
MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-anonymize@example.com","isRegistration":false,"turnstileToken":"test-token"}')
check_status

# extract magic token for first user
MAGIC_TOKEN3=$(extract_magic_token "$MAGIC_LINK_RESPONSE3")
echo "${BLUE}Magic token for first user: $MAGIC_TOKEN3${NC}"

#check the the tester needs a PHONE link
echo "${YELLOW}Do you want a phone link? (y/n)${NC}"
read -r NEED_PHONE_LOGIN

if [ "$NEED_PHONE_LOGIN" = "y" ]; then
  # create a new magic link for the second user
  echo "${YELLOW}Creating new magic link for second user...${NC}"
  MAGIC_LINK_RESPONSE4=$(curl -s -X POST http://localhost:8787/auth/magic-link \
      -H "Content-Type: application/json" \
      -d '{"email":"test-anonymize2@example.com","isRegistration":false,"turnstileToken":"test-token"}')
  check_status

  #extract magic token for second user
  MAGIC_TOKEN4=$(extract_magic_token "$MAGIC_LINK_RESPONSE4")
  echo "${BLUE}Magic token for second user: $MAGIC_TOKEN4${NC}"

  # check what the local IP address is
  IP_ADDRESS=$(ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}')
  echo "${BLUE}Local IP address: $IP_ADDRESS${NC}"

  # combine the IP address with the magic token to create a magic link for the second user
  MAGIC_LINK5="http://$IP_ADDRESS:5173/auth/verify?token=$MAGIC_TOKEN4"
  echo "${BLUE}Magic link for second user: $MAGIC_LINK5${NC}"
  
  # copy that link to the clipboard
  echo "$MAGIC_LINK5" | pbcopy
  echo "${GREEN}PHONE LINK copied to clipboard!${NC}"
  echo "${GREEN}Test completed successfully!${NC}" 
  exit 0
fi 
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

# ========================================
# GROUP MANAGEMENT TESTS
# ========================================
echo "${YELLOW}Testing group management functionality...${NC}"

# Create additional test users for group testing
echo "${YELLOW}Creating group test users...${NC}"
GROUP_USER1_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-leader@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

GROUP_USER2_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-member@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

GROUP_USER3_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-outsider@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

# Extract and verify tokens for group users
GROUP_TOKEN1=$(extract_magic_token "$GROUP_USER1_RESPONSE")
GROUP_VERIFY1=$(curl -s -i "http://localhost:8787/auth/verify?token=$GROUP_TOKEN1")
GROUP_SESSION1=$(extract_token "$GROUP_VERIFY1")

GROUP_TOKEN2=$(extract_magic_token "$GROUP_USER2_RESPONSE")
GROUP_VERIFY2=$(curl -s -i "http://localhost:8787/auth/verify?token=$GROUP_TOKEN2")
GROUP_SESSION2=$(extract_token "$GROUP_VERIFY2")

GROUP_TOKEN3=$(extract_magic_token "$GROUP_USER3_RESPONSE")
GROUP_VERIFY3=$(curl -s -i "http://localhost:8787/auth/verify?token=$GROUP_TOKEN3")
GROUP_SESSION3=$(extract_token "$GROUP_VERIFY3")

echo "${BLUE}Group test users created successfully${NC}"

# Grant create_groups permission to group-leader@example.com for testing
echo "${YELLOW}Granting create_groups permission to group-leader@example.com...${NC}"
GROUP_LEADER_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-leader@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
echo "${BLUE}Group leader ID: $GROUP_LEADER_ID${NC}"

# Grant permission directly in database for testing
PERMISSION_GRANT=$(npx wrangler d1 execute DB --env development --command="INSERT OR REPLACE INTO user_permissions (user_id, permission_type, granted_by, granted_at, expires_at, is_active) VALUES ($GROUP_LEADER_ID, 'create_groups', $GROUP_LEADER_ID, (unixepoch() * 1000), NULL, TRUE);" | cat)
check_status
echo "${BLUE}Granted create_groups permission to group-leader@example.com${NC}"

# Note: manage_users permission is no longer needed since we use group-level permissions
# Group creators and leaders can manage their own groups

# Test 1: Group Creation
echo "${YELLOW}Testing group creation...${NC}"
GROUP_CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"name":"Comprehensive Test Group","description":"Group for comprehensive testing"}')

echo "${BLUE}Group create response: $GROUP_CREATE_RESPONSE${NC}"

# Extract group ID
GROUP_ID=$(echo "$GROUP_CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo "${BLUE}Created group ID: $GROUP_ID${NC}"

# Verify group creation
if [ -n "$GROUP_ID" ]; then
    echo "${GREEN}✓ Group creation works${NC}"
else
    echo "${RED}✗ Group creation failed${NC}"
    exit 1
fi

# Verify creator is automatically a member with creator role
CREATOR_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT COUNT(*) as count FROM group_members WHERE group_id = $GROUP_ID AND role = 'creator';" | cat)
if echo "$CREATOR_CHECK" | grep -q '"count": 1'; then
    echo "${GREEN}✓ Creator automatically becomes member with creator role${NC}"
else
    echo "${RED}✗ Creator membership failed${NC}"
    exit 1
fi

# Test 2: Get Group Leaders
echo "${YELLOW}Testing get group leaders...${NC}"
GET_LEADERS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Get leaders response: $GET_LEADERS_RESPONSE${NC}"

if echo "$GET_LEADERS_RESPONSE" | grep -q '"role":"creator"'; then
    echo "${GREEN}✓ Get leaders works${NC}"
else
    echo "${RED}✗ Get leaders failed${NC}"
    exit 1
fi

# Test 3: Assign Leader
echo "${YELLOW}Testing leader assignment...${NC}"
ASSIGN_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-leader@example.com"}')

echo "${BLUE}Assign leader response: $ASSIGN_LEADER_RESPONSE${NC}"

# Note: This should fail because the user is already a creator
if echo "$ASSIGN_LEADER_RESPONSE" | grep -q "already a leader"; then
    echo "${GREEN}✓ Leader assignment correctly prevents duplicate assignment${NC}"
else
    echo "${RED}✗ Leader assignment validation failed${NC}"
    exit 1
fi

# Test 4: Assign Different User as Leader
echo "${YELLOW}Testing assign different user as leader...${NC}"
ASSIGN_DIFF_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Assign different leader response: $ASSIGN_DIFF_LEADER_RESPONSE${NC}"

if echo "$ASSIGN_DIFF_LEADER_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Assign different leader works${NC}"
else
    echo "${RED}✗ Assign different leader failed${NC}"
    exit 1
fi

# Verify the new leader was assigned
NEW_LEADER_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT COUNT(*) as count FROM group_members WHERE group_id = $GROUP_ID AND role = 'leader';" | cat)
if echo "$NEW_LEADER_CHECK" | grep -q '"count": 1'; then
    echo "${GREEN}✓ New leader assignment verified in database${NC}"
else
    echo "${RED}✗ New leader assignment not found in database${NC}"
    exit 1
fi

# Test 5: Permission Denied for Non-Leaders
echo "${YELLOW}Testing permission denied for non-leaders...${NC}"
PERMISSION_DENIED_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION3" \
  -d '{"email":"test@example.com"}')

echo "${BLUE}Permission denied response: $PERMISSION_DENIED_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "You do not have permission to assign leaders"; then
    echo "${GREEN}✓ Non-leaders cannot assign leaders${NC}"
else
    echo "${RED}✗ Non-leaders can assign leaders (should not)${NC}"
    exit 1
fi

# Test 6: Assign Leader to Non-Existent User
echo "${YELLOW}Testing assign leader to non-existent user...${NC}"
NONEXISTENT_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"nonexistent@example.com"}')

echo "${BLUE}Non-existent user response: $NONEXISTENT_RESPONSE${NC}"

if echo "$NONEXISTENT_RESPONSE" | grep -q "User not found"; then
    echo "${GREEN}✓ Non-existent user handling works${NC}"
else
    echo "${RED}✗ Non-existent user handling failed${NC}"
    exit 1
fi

# Test 7: Duplicate Group Name Validation
echo "${YELLOW}Testing duplicate group name validation...${NC}"
DUPLICATE_GROUP_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"name":"Comprehensive Test Group","description":"Duplicate group"}')

echo "${BLUE}Duplicate group response: $DUPLICATE_GROUP_RESPONSE${NC}"

if echo "$DUPLICATE_GROUP_RESPONSE" | grep -q "already exists"; then
    echo "${GREEN}✓ Duplicate group name validation works${NC}"
else
    echo "${RED}✗ Duplicate group name validation failed${NC}"
    exit 1
fi

# Test 8: Group Name Length Validation
echo "${YELLOW}Testing group name length validation...${NC}"
SHORT_NAME_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"name":"A","description":"Too short"}')

echo "${BLUE}Short name response: $SHORT_NAME_RESPONSE${NC}"

if echo "$SHORT_NAME_RESPONSE" | grep -q "between 2 and 50 characters"; then
    echo "${GREEN}✓ Group name length validation works${NC}"
else
    echo "${RED}✗ Group name length validation failed${NC}"
    exit 1
fi

echo "${GREEN}✓ All group management tests passed${NC}"

# ========================================
# SUPER ADMIN SETUP
# ========================================
echo "${BLUE}🧪 Setting up Super Admin for Testing${NC}"
echo "=========================================="

# Create super admin user
echo "${YELLOW}Creating super admin user...${NC}"
SUPER_ADMIN_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"super-admin@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

# Extract magic token for super admin
SUPER_ADMIN_MAGIC_TOKEN=$(extract_magic_token "$SUPER_ADMIN_RESPONSE")
echo "${BLUE}Super admin magic token: $SUPER_ADMIN_MAGIC_TOKEN${NC}"

# Verify magic link for super admin
echo "${YELLOW}Verifying super admin magic link...${NC}"
SUPER_ADMIN_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$SUPER_ADMIN_MAGIC_TOKEN")
check_status

# Debug: Show the full verification response
echo "${BLUE}Full verification response:${NC}"
echo "$SUPER_ADMIN_VERIFY"

# Extract session token for super admin
SUPER_ADMIN_SESSION=$(extract_token "$SUPER_ADMIN_VERIFY")
echo "${BLUE}Super admin session token: $SUPER_ADMIN_SESSION${NC}"

# Debug: Check if session token is empty
if [ -z "$SUPER_ADMIN_SESSION" ]; then
  echo "${RED}✗ Session token is empty!${NC}"
  exit 1
fi

# Debug: Check if session is stored in database
echo "${YELLOW}Checking if session is stored in database...${NC}"
SESSION_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM sessions WHERE token = '$SUPER_ADMIN_SESSION';" | cat)
echo "${BLUE}Session check: $SESSION_CHECK${NC}"
if echo "$SESSION_CHECK" | grep -q '"token":'; then
  echo "${GREEN}✓ Session found in database${NC}"
else
  echo "${RED}✗ Session not found in database${NC}"
  exit 1
fi

# Verify user was created before setting up super admin privileges
echo "${YELLOW}Verifying super admin user was created...${NC}"
USER_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'super-admin@example.com';" | cat)
if echo "$USER_CHECK" | grep -q '"id":'; then
  echo "${GREEN}✓ Super admin user created successfully${NC}"
else
  echo "${RED}✗ Super admin user not found in database${NC}"
  exit 1
fi

# Initialize super admin privileges (this would normally be done via the init script)
echo "${YELLOW}Initializing super admin privileges...${NC}"
# Add super admin to the super_admins table
SUPER_ADMIN_INIT=$(npx wrangler d1 execute DB --env development --command="INSERT OR REPLACE INTO super_admins (user_id, email, added_by, added_at, is_active) SELECT id, email, id, (unixepoch() * 1000), TRUE FROM users WHERE email = 'super-admin@example.com';" | cat)
check_status

# Grant all permissions to super admin
echo "${YELLOW}Granting permissions to super admin...${NC}"
PERMISSIONS=("create_groups" "delete_groups" "manage_users" "view_all_groups")
for permission in "${PERMISSIONS[@]}"; do
  PERMISSION_GRANT=$(npx wrangler d1 execute DB --env development --command="INSERT OR REPLACE INTO user_permissions (user_id, permission_type, granted_by, granted_at, expires_at, is_active) SELECT id, '$permission', id, (unixepoch() * 1000), NULL, TRUE FROM users WHERE email = 'super-admin@example.com';" | cat)
  check_status
  echo "${BLUE}Granted $permission permission${NC}"
done

# Verify super admin privileges were set up correctly
echo "${YELLOW}Verifying super admin privileges...${NC}"
SUPER_ADMIN_VERIFY=$(npx wrangler d1 execute DB --env development --command="SELECT * FROM super_admins WHERE email = 'super-admin@example.com';" | cat)
if echo "$SUPER_ADMIN_VERIFY" | grep -q '"user_id":'; then
  echo "${GREEN}✓ Super admin privileges verified${NC}"
else
  echo "${RED}✗ Super admin privileges not found in database${NC}"
  exit 1
fi

# Test super admin status check
echo "${YELLOW}Testing super admin status check...${NC}"
SUPER_ADMIN_CHECK=$(curl -s -X GET http://localhost:8787/admin/check-super-admin \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
echo "${BLUE}Super admin check response: $SUPER_ADMIN_CHECK${NC}"

if echo "$SUPER_ADMIN_CHECK" | grep -q '"isSuperAdmin":true'; then
  echo "${GREEN}✓ Super admin status confirmed${NC}"
else
  echo "${RED}✗ Super admin status check failed${NC}"
  exit 1
fi

echo "${GREEN}✓ Super Admin Setup Completed Successfully!${NC}"

# ========================================
# REMOVE MEMBER TESTS
# ========================================

echo "${YELLOW}Testing remove member functionality...${NC}"

# Get user IDs for testing
GROUP_USER1_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-leader@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
GROUP_USER2_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-member@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
GROUP_OUTSIDER_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-outsider@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

echo "${BLUE}Group user 1 ID: $GROUP_USER1_ID${NC}"
echo "${BLUE}Group user 2 ID: $GROUP_USER2_ID${NC}"
echo "${BLUE}Group outsider ID: $GROUP_OUTSIDER_ID${NC}"

# First, add group-outsider@example.com to the group so we can test removing them
echo "${YELLOW}Adding group-outsider@example.com to the group for removal testing...${NC}"
ADD_OUTSIDER_FOR_REMOVAL_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d "{\"targetUserId\":$GROUP_OUTSIDER_ID}")

echo "${BLUE}Add outsider for removal response: $ADD_OUTSIDER_FOR_REMOVAL_RESPONSE${NC}"

# Test 1: Group leader removing a member (should succeed)
echo "${YELLOW}Testing group leader removing a member...${NC}"
REMOVE_MEMBER_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_OUTSIDER_ID/remove \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Remove member response: $REMOVE_MEMBER_RESPONSE${NC}"

if echo "$REMOVE_MEMBER_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group leader can remove members${NC}"
else
    echo "${RED}✗ Group leader cannot remove members${NC}"
    exit 1
fi

# Test 2: Regular member trying to remove another member (should fail)
echo "${YELLOW}Testing regular member trying to remove another member...${NC}"
# First, add group-outsider@example.com back to the group
ADD_OUTSIDER_BACK_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d "{\"targetUserId\":$GROUP_OUTSIDER_ID}")

PERMISSION_DENIED_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_OUTSIDER_ID/remove \
  -H "Authorization: Bearer $GROUP_SESSION3")

echo "${BLUE}Permission denied response: $PERMISSION_DENIED_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "You must be a leader or creator"; then
    echo "${GREEN}✓ Regular members cannot remove other members${NC}"
else
    echo "${RED}✗ Regular members can remove other members (should not)${NC}"
    exit 1
fi

# Test 3: Group leader trying to remove themselves (should fail)
echo "${YELLOW}Testing group leader trying to remove themselves...${NC}"
SELF_REMOVE_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_USER1_ID/remove \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Self remove response: $SELF_REMOVE_RESPONSE${NC}"

if echo "$SELF_REMOVE_RESPONSE" | grep -q "cannot remove yourself"; then
    echo "${GREEN}✓ Group leaders cannot remove themselves${NC}"
else
    echo "${RED}✗ Group leaders can remove themselves (should not)${NC}"
    exit 1
fi

# Test 4: Super admin removing a member (should succeed)
echo "${YELLOW}Testing super admin removing a member...${NC}"
SUPER_ADMIN_REMOVE_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_OUTSIDER_ID/remove \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")

echo "${BLUE}Super admin remove response: $SUPER_ADMIN_REMOVE_RESPONSE${NC}"

if echo "$SUPER_ADMIN_REMOVE_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Super admin can remove members${NC}"
else
    echo "${RED}✗ Super admin cannot remove members${NC}"
    exit 1
fi

echo "${GREEN}✓ All remove member tests passed${NC}"

# ========================================
# END REMOVE MEMBER TESTS
# ========================================

# ========================================
# MAKE LEADER TESTS
# ========================================

echo "${YELLOW}Testing make leader functionality...${NC}"

# First, ensure we have a regular member to promote
echo "${YELLOW}Ensuring group-member@example.com is a regular member...${NC}"
# Remove them if they're already a leader
REMOVE_LEADER_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_USER2_ID/remove \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")

# Re-add them as a regular member
ADD_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d "{\"targetUserId\":$GROUP_USER2_ID}")

echo "${BLUE}Re-added member response: $ADD_MEMBER_RESPONSE${NC}"

# Test 1: Group leader promoting a member to leader (should succeed)
echo "${YELLOW}Testing group leader promoting a member to leader...${NC}"
MAKE_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Make leader response: $MAKE_LEADER_RESPONSE${NC}"

if echo "$MAKE_LEADER_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group leader can promote members to leader${NC}"
else
    echo "${RED}✗ Group leader cannot promote members to leader${NC}"
    exit 1
fi

# Test 2: Regular member trying to promote another member (should fail)
echo "${YELLOW}Testing regular member trying to promote another member...${NC}"
# First, add group-outsider@example.com as a regular member
ADD_OUTSIDER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d "{\"targetUserId\":$GROUP_OUTSIDER_ID}")

# Get outsider session token
OUTSIDER_MAGIC_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-outsider@example.com","isRegistration":false,"turnstileToken":"test-token"}')

OUTSIDER_MAGIC_TOKEN=$(extract_magic_token "$OUTSIDER_MAGIC_RESPONSE")
OUTSIDER_VERIFY_RESPONSE=$(curl -s -i "http://localhost:8787/auth/verify?token=$OUTSIDER_MAGIC_TOKEN")
OUTSIDER_SESSION=$(extract_token "$OUTSIDER_VERIFY_RESPONSE")

PERMISSION_DENIED_MAKE_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OUTSIDER_SESSION" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Permission denied make leader response: $PERMISSION_DENIED_MAKE_LEADER_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_MAKE_LEADER_RESPONSE" | grep -q "permission"; then
    echo "${GREEN}✓ Regular members cannot promote others to leader${NC}"
else
    echo "${RED}✗ Regular members can promote others to leader (should not)${NC}"
    exit 1
fi

# Test 3: Super admin promoting a member to leader (should succeed)
echo "${YELLOW}Testing super admin promoting a member to leader...${NC}"
# First, demote group-member@example.com back to regular member
DEMOTE_RESPONSE=$(curl -s -X DELETE http://localhost:8787/admin/groups/$GROUP_ID/members/$GROUP_USER2_ID/remove \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")

# Re-add as regular member
RE_ADD_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d "{\"targetUserId\":$GROUP_USER2_ID}")

SUPER_ADMIN_MAKE_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Super admin make leader response: $SUPER_ADMIN_MAKE_LEADER_RESPONSE${NC}"

if echo "$SUPER_ADMIN_MAKE_LEADER_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Super admin can promote members to leader${NC}"
else
    echo "${RED}✗ Super admin cannot promote members to leader${NC}"
    exit 1
fi

# Test 4: Trying to promote someone who is already a leader (should fail)
echo "${YELLOW}Testing promoting someone who is already a leader...${NC}"
ALREADY_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Already leader response: $ALREADY_LEADER_RESPONSE${NC}"

if echo "$ALREADY_LEADER_RESPONSE" | grep -q "already a leader"; then
    echo "${GREEN}✓ Cannot promote someone who is already a leader${NC}"
else
    echo "${RED}✗ Can promote someone who is already a leader (should not)${NC}"
    exit 1
fi

# Test 5: Trying to promote a non-existent user (should fail)
echo "${YELLOW}Testing promoting a non-existent user...${NC}"
NON_EXISTENT_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"nonexistent@example.com"}')

echo "${BLUE}Non-existent user response: $NON_EXISTENT_RESPONSE${NC}"

if echo "$NON_EXISTENT_RESPONSE" | grep -q "not found"; then
    echo "${GREEN}✓ Cannot promote non-existent user${NC}"
else
    echo "${RED}✗ Can promote non-existent user (should not)${NC}"
    exit 1
fi

echo "${GREEN}✓ All make leader tests passed${NC}"

# ========================================
# END MAKE LEADER TESTS
# ========================================

# ========================================
# DEMOTE LEADER TESTS
# ========================================

echo "${YELLOW}Testing demote leader functionality...${NC}"

# Ensure we have a leader to demote (group-member@example.com should be a leader from previous test)
echo "${YELLOW}Ensuring group-member@example.com is a leader for demotion testing...${NC}"

# Test 1: Group leader demoting another leader (should succeed)
echo "${YELLOW}Testing group leader demoting another leader...${NC}"
DEMOTE_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Demote leader response: $DEMOTE_LEADER_RESPONSE${NC}"

if echo "$DEMOTE_LEADER_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group leader can demote other leaders${NC}"
else
    echo "${RED}✗ Group leader cannot demote other leaders${NC}"
    exit 1
fi

# Test 2: Regular member trying to demote a leader (should fail)
echo "${YELLOW}Testing regular member trying to demote a leader...${NC}"
# First, promote group-outsider@example.com back to leader
PROMOTE_OUTSIDER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-outsider@example.com"}')

PERMISSION_DENIED_DEMOTE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OUTSIDER_SESSION" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Permission denied demote response: $PERMISSION_DENIED_DEMOTE_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_DEMOTE_RESPONSE" | grep -q "User is not a leader"; then
    echo "${GREEN}✓ Regular members cannot demote leaders${NC}"
else
    echo "${RED}✗ Regular members can demote leaders (should not)${NC}"
    exit 1
fi

# Test 3: Super admin demoting a leader (should succeed)
echo "${YELLOW}Testing super admin demoting a leader...${NC}"
# First, promote group-member@example.com back to leader
PROMOTE_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

SUPER_ADMIN_DEMOTE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Super admin demote response: $SUPER_ADMIN_DEMOTE_RESPONSE${NC}"

if echo "$SUPER_ADMIN_DEMOTE_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Super admin can demote leaders${NC}"
else
    echo "${RED}✗ Super admin cannot demote leaders${NC}"
    exit 1
fi

# Test 4: Trying to demote someone who is not a leader (should fail)
echo "${YELLOW}Testing demoting someone who is not a leader...${NC}"
NOT_LEADER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

echo "${BLUE}Not leader response: $NOT_LEADER_RESPONSE${NC}"

if echo "$NOT_LEADER_RESPONSE" | grep -q "not a leader"; then
    echo "${GREEN}✓ Cannot demote someone who is not a leader${NC}"
else
    echo "${RED}✗ Can demote someone who is not a leader (should not)${NC}"
    exit 1
fi

# Test 5: Trying to demote a creator (should fail)
echo "${YELLOW}Testing demoting a creator...${NC}"
DEMOTE_CREATOR_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d '{"email":"group-leader@example.com"}')

echo "${BLUE}Demote creator response: $DEMOTE_CREATOR_RESPONSE${NC}"

if echo "$DEMOTE_CREATOR_RESPONSE" | grep -q "creator"; then
    echo "${GREEN}✓ Cannot demote a creator${NC}"
else
    echo "${RED}✗ Can demote a creator (should not)${NC}"
    exit 1
fi

# Test 6: Trying to demote a non-existent user (should fail)
echo "${YELLOW}Testing demoting a non-existent user...${NC}"
NON_EXISTENT_DEMOTE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/leaders/demote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"nonexistent@example.com"}')

echo "${BLUE}Non-existent demote response: $NON_EXISTENT_DEMOTE_RESPONSE${NC}"

if echo "$NON_EXISTENT_DEMOTE_RESPONSE" | grep -q "not found"; then
    echo "${GREEN}✓ Cannot demote non-existent user${NC}"
else
    echo "${RED}✗ Can demote non-existent user (should not)${NC}"
    exit 1
fi

echo "${GREEN}✓ All demote leader tests passed${NC}"

# ========================================
# END DEMOTE LEADER TESTS
# ========================================

# ========================================
# END GROUP MANAGEMENT TESTS
# ========================================

# Test group membership and invitations
echo "${YELLOW}Testing group membership and invitations...${NC}"

# Invite user to group
INVITE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"super-admin@example.com"}')

echo "${BLUE}Invite response: $INVITE_RESPONSE${NC}"

if echo "$INVITE_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group invitation works${NC}"
else
    echo "${RED}✗ Group invitation failed${NC}"
    exit 1
fi

# Get invitation ID for joining
INVITATION_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'super-admin@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

# Join group
JOIN_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d "{\"invitationId\":$INVITATION_ID}")

echo "${BLUE}Join response: $JOIN_RESPONSE${NC}"

if echo "$JOIN_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Group joining works${NC}"
else
    echo "${RED}✗ Group joining failed${NC}"
    exit 1
fi

# Get members
GET_MEMBERS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$GET_MEMBERS_RESPONSE" | grep -q '"members"'; then
    echo "${GREEN}✓ Get members works${NC}"
else
    echo "${RED}✗ Get members failed${NC}"
    exit 1
fi

# Test permission denied for non-leaders trying to invite
PERMISSION_DENIED_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d '{"email":"test-anonymize@example.com"}')

echo "${BLUE}Permission denied response: $PERMISSION_DENIED_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "You do not have permission to invite"; then
    echo "${GREEN}✓ Regular members cannot invite other members${NC}"
else
    echo "${RED}✗ Regular members can invite other members (should not)${NC}"
    exit 1
fi

echo "${GREEN}✓ All group membership and invitation tests passed${NC}"

# ========================================
# END GROUP MEMBERSHIP AND INVITATION TESTS
# ========================================

# Test display names and privacy
echo "${YELLOW}Testing display names and privacy...${NC}"

# Get user IDs for testing
GROUP_USER1_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-leader@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
GROUP_USER2_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-member@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

echo "${BLUE}Group user 1 ID: $GROUP_USER1_ID${NC}"
echo "${BLUE}Group user 2 ID: $GROUP_USER2_ID${NC}"

# First, make sure group-member@example.com is in the group by inviting them
echo "${YELLOW}Inviting group-member@example.com to ensure they're in the group...${NC}"
INVITE_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"email":"group-member@example.com"}')

if echo "$INVITE_MEMBER_RESPONSE" | grep -q "already a member"; then
    echo "${BLUE}group-member@example.com is already a member${NC}"
else
    echo "${BLUE}Invited group-member@example.com${NC}"
    # Get invitation ID and join
    MEMBER_INVITATION_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'group-member@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
    
    if [ -n "$MEMBER_INVITATION_ID" ]; then
        JOIN_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $GROUP_SESSION2" \
          -d "{\"invitationId\":$MEMBER_INVITATION_ID}")
        echo "${BLUE}Joined group: $JOIN_MEMBER_RESPONSE${NC}"
    fi
fi

# Test 1: Update display name
echo "${YELLOW}Testing update display name...${NC}"
UPDATE_NAME_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"displayName":"Test User"}')

echo "${BLUE}Update name response: $UPDATE_NAME_RESPONSE${NC}"

if echo "$UPDATE_NAME_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Display name update works${NC}"
else
    echo "${RED}✗ Display name update failed${NC}"
    exit 1
fi

# Test 2: Get member profile
echo "${YELLOW}Testing get member profile...${NC}"
GET_PROFILE_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/profile \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Get profile response: $GET_PROFILE_RESPONSE${NC}"

if echo "$GET_PROFILE_RESPONSE" | grep -q '"display_name":"Test User"'; then
    echo "${GREEN}✓ Get member profile works${NC}"
else
    echo "${RED}✗ Get member profile failed${NC}"
    exit 1
fi

# Test 3: Update privacy settings
echo "${YELLOW}Testing update privacy settings...${NC}"
UPDATE_PRIVACY_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/privacy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"isPublic":false}')

echo "${BLUE}Update privacy response: $UPDATE_PRIVACY_RESPONSE${NC}"

if echo "$UPDATE_PRIVACY_RESPONSE" | grep -q "success"; then
    echo "${GREEN}✓ Privacy settings update works${NC}"
else
    echo "${RED}✗ Privacy settings update failed${NC}"
    exit 1
fi

# Test 4: Validation tests
echo "${YELLOW}Testing display name validation...${NC}"

# Test invalid name (too short)
SHORT_NAME_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"displayName":"A"}')

if echo "$SHORT_NAME_RESPONSE" | grep -q "between 2 and 30 characters"; then
    echo "${GREEN}✓ Short name validation works${NC}"
else
    echo "${RED}✗ Short name validation failed${NC}"
    exit 1
fi

# Test invalid characters
INVALID_CHARS_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"displayName":"Test@User"}')

if echo "$INVALID_CHARS_RESPONSE" | grep -q "can only contain letters"; then
    echo "${GREEN}✓ Invalid characters validation works${NC}"
else
    echo "${RED}✗ Invalid characters validation failed${NC}"
    exit 1
fi

# Test 5: Permission tests
echo "${YELLOW}Testing permission validation...${NC}"

# Get the ID of group-outsider@example.com (who should be a regular member)
GROUP_OUTSIDER_ID=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'group-outsider@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
echo "${BLUE}Group outsider ID: $GROUP_OUTSIDER_ID${NC}"

# Test group-outsider@example.com (regular member) trying to update group-leader@example.com's display name (should fail)
# Create a true regular member for permission testing
echo "${YELLOW}Creating a true regular member for permission testing...${NC}"
REGULAR_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"true-regular-member@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

REGULAR_MEMBER_TOKEN=$(extract_magic_token "$REGULAR_MEMBER_RESPONSE")
REGULAR_MEMBER_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$REGULAR_MEMBER_TOKEN")
REGULAR_MEMBER_SESSION=$(extract_token "$REGULAR_MEMBER_VERIFY")

# Add regular member to group
ADD_REGULAR_MEMBER_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/add-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"targetUserId":'$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'true-regular-member@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')'}')

# Test true regular member trying to update group-leader@example.com's display name (should fail)
PERMISSION_DENIED_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER1_ID/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REGULAR_MEMBER_SESSION" \
  -d '{"displayName":"Unauthorized Change"}')

echo "${BLUE}Permission denied response: $PERMISSION_DENIED_RESPONSE${NC}"

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "You do not have permission"; then
    echo "${GREEN}✓ Regular members cannot change other members' display names${NC}"
else
    echo "${RED}✗ Regular members can change other members' display names (should not)${NC}"
    exit 1
fi

echo "${GREEN}✓ All display names and privacy tests passed${NC}"

# ========================================
# END DISPLAY NAMES AND PRIVACY TESTS
# ========================================

# Test leaderboards
echo "${YELLOW}Testing leaderboards...${NC}"

# Add some points to create a leaderboard
echo "${YELLOW}Adding points to create leaderboard...${NC}"
POINTS_RESPONSE1=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION1" \
  -d '{"event_type":"verse_added","points":1000}')

POINTS_RESPONSE2=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GROUP_SESSION2" \
  -d '{"event_type":"verse_added","points":800}')

# Get leaderboard
echo "${YELLOW}Testing get leaderboard...${NC}"
LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Leaderboard response: $LEADERBOARD_RESPONSE${NC}"

if echo "$LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "${GREEN}✓ Get leaderboard works${NC}"
else
    echo "${RED}✗ Get leaderboard failed${NC}"
    exit 1
fi

# Get group stats
echo "${YELLOW}Testing get group stats...${NC}"
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/stats \
  -H "Authorization: Bearer $GROUP_SESSION1")

echo "${BLUE}Stats response: $STATS_RESPONSE${NC}"

if echo "$STATS_RESPONSE" | grep -q '"total_members"'; then
    echo "${GREEN}✓ Get group stats works${NC}"
else
    echo "${RED}✗ Get group stats failed${NC}"
    exit 1
fi

# Get member ranking
echo "${YELLOW}Testing get member ranking...${NC}"
RANKING_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members/$GROUP_USER2_ID/ranking \
  -H "Authorization: Bearer $GROUP_SESSION2")

echo "${BLUE}Ranking response: $RANKING_RESPONSE${NC}"

if echo "$RANKING_RESPONSE" | grep -q '"rank"'; then
    echo "${GREEN}✓ Get member ranking works${NC}"
else
    echo "${RED}✗ Get member ranking failed${NC}"
    exit 1
fi

# Test different metrics
echo "${YELLOW}Testing different metrics...${NC}"
STREAK_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=current_streak" \
  -H "Authorization: Bearer $GROUP_SESSION1")

if echo "$STREAK_LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "${GREEN}✓ Different metrics test passed${NC}"
else
    echo "${RED}✗ Different metrics test failed${NC}"
    exit 1
fi

echo "${GREEN}✓ All leaderboard tests passed${NC}"

# ========================================
# TEST: List groups for a user (GET /groups/mine)
# ========================================
echo "${YELLOW}Testing list groups for a user...${NC}"
USER_GROUPS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/mine \
  -H "Authorization: Bearer $GROUP_SESSION1")
echo "${BLUE}User groups response: $USER_GROUPS_RESPONSE${NC}"
if echo "$USER_GROUPS_RESPONSE" | grep -q '"groups"' && echo "$USER_GROUPS_RESPONSE" | grep -q '"role"'; then
    echo "${GREEN}✓ List groups for a user works${NC}"
else
    echo "${RED}✗ List groups for a user failed${NC}"
    exit 1
fi

# ========================================
# END LEADERBOARD TESTS
# ========================================

# ========================================
# MAGIC LINK PARAMETER TESTS
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}TESTING MAGIC LINK PARAMETERS${NC}"
echo "${YELLOW}========================================${NC}"

# Test 1: No parameters
echo "${YELLOW}Test 1: Creating magic link with no parameters...${NC}"
NO_PARAMS_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"no-params@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status
NO_PARAMS_TOKEN=$(extract_magic_token "$NO_PARAMS_RESPONSE")
echo "${BLUE}No params token: $NO_PARAMS_TOKEN${NC}"

# Test 2: Verse set only
echo "${YELLOW}Test 2: Creating magic link with verse set only...${NC}"
VERSE_ONLY_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"verse-only@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses"}')
check_status
VERSE_ONLY_TOKEN=$(extract_magic_token "$VERSE_ONLY_RESPONSE")
echo "${BLUE}Verse only token: $VERSE_ONLY_TOKEN${NC}"

# Test 3: Group code only
echo "${YELLOW}Test 3: Creating magic link with group code only...${NC}"
GROUP_ONLY_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-only@example.com","isRegistration":true,"turnstileToken":"test-token","groupCode":"test-group-123"}')
check_status
GROUP_ONLY_TOKEN=$(extract_magic_token "$GROUP_ONLY_RESPONSE")
echo "${BLUE}Group only token: $GROUP_ONLY_TOKEN${NC}"

# Test 4: Both verse set and group code
echo "${YELLOW}Test 4: Creating magic link with both verse set and group code...${NC}"
BOTH_PARAMS_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"both-params@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","groupCode":"test-group-123"}')
check_status
BOTH_PARAMS_TOKEN=$(extract_magic_token "$BOTH_PARAMS_RESPONSE")
echo "${BLUE}Both params token: $BOTH_PARAMS_TOKEN${NC}"

# Test 5: Invalid group code
echo "${YELLOW}Test 5: Creating magic link with invalid group code...${NC}"
INVALID_GROUP_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-group@example.com","isRegistration":true,"turnstileToken":"test-token","groupCode":"invalid-group-999"}')
check_status
INVALID_GROUP_TOKEN=$(extract_magic_token "$INVALID_GROUP_RESPONSE")
echo "${BLUE}Invalid group token: $INVALID_GROUP_TOKEN${NC}"

# Verify all magic links work
echo "${YELLOW}Verifying all magic links...${NC}"

# Verify no params
echo "${YELLOW}Verifying no params magic link...${NC}"
NO_PARAMS_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$NO_PARAMS_TOKEN")
check_status
NO_PARAMS_SESSION=$(extract_token "$NO_PARAMS_VERIFY")
echo "${BLUE}No params session: $NO_PARAMS_SESSION${NC}"

# Verify verse only
echo "${YELLOW}Verifying verse only magic link...${NC}"
VERSE_ONLY_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$VERSE_ONLY_TOKEN")
check_status
VERSE_ONLY_SESSION=$(extract_token "$VERSE_ONLY_VERIFY")
echo "${BLUE}Verse only session: $VERSE_ONLY_SESSION${NC}"

# Verify group only
echo "${YELLOW}Verifying group only magic link...${NC}"
GROUP_ONLY_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$GROUP_ONLY_TOKEN")
check_status
GROUP_ONLY_SESSION=$(extract_token "$GROUP_ONLY_VERIFY")
echo "${BLUE}Group only session: $GROUP_ONLY_SESSION${NC}"

# Verify both params
echo "${YELLOW}Verifying both params magic link...${NC}"
BOTH_PARAMS_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$BOTH_PARAMS_TOKEN")
check_status
BOTH_PARAMS_SESSION=$(extract_token "$BOTH_PARAMS_VERIFY")
echo "${BLUE}Both params session: $BOTH_PARAMS_SESSION${NC}"

# Verify invalid group
echo "${YELLOW}Verifying invalid group magic link...${NC}"
INVALID_GROUP_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$INVALID_GROUP_TOKEN")
check_status
INVALID_GROUP_SESSION=$(extract_token "$INVALID_GROUP_VERIFY")
echo "${BLUE}Invalid group session: $INVALID_GROUP_SESSION${NC}"

echo "${GREEN}✓ All magic link parameter tests passed${NC}"

USERS=(
  "test-anonymize@example.com"
  "test-anonymize2@example.com"
  "test-anonymize3@example.com"
  "group-leader@example.com"
  "group-member@example.com"
  "group-outsider@example.com"
  "no-params@example.com"
  "verse-only@example.com"
  "group-only@example.com"
  "both-params@example.com"
  "invalid-group@example.com"
  "super-admin@example.com"
  "true-regular-member@example.com"
  "regular-member@example.com"
  # Add any other test users created in this script
)

# Loop for unlimited user logins
while true; do
  echo "${YELLOW}Do you want to log in as a test user? (y/n)${NC}"
  read -r LOGIN_USER

  if [ "$LOGIN_USER" = "y" ]; then
    echo "${YELLOW}Select a user to generate a magic link for:${NC}"
    select MAGIC_LINK_EMAIL in "${USERS[@]}"; do
      if [[ -n "$MAGIC_LINK_EMAIL" ]]; then
        echo "${BLUE}Creating magic link for $MAGIC_LINK_EMAIL...${NC}"
        MAGIC_LINK_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
          -H "Content-Type: application/json" \
          -d "{\"email\":\"$MAGIC_LINK_EMAIL\",\"isRegistration\":false,\"turnstileToken\":\"test-token\"}")
        MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
        MAGIC_LINK="http://localhost:5173/auth/verify?token=$MAGIC_TOKEN"
        echo "${BLUE}Magic link: $MAGIC_LINK${NC}"
        echo "$MAGIC_LINK" | pbcopy
        echo "${GREEN}Magic link copied to clipboard${NC}"
        echo "${YELLOW}Open the link in the browser? (y/n)${NC}"
        read -r OPEN_LINK_QUESTION
        if [ "$OPEN_LINK_QUESTION" = "y" ]; then
          open "$MAGIC_LINK"
        fi
        break
      else
        echo "${RED}Invalid selection. Please try again.${NC}"
      fi
    done
  else
    break
  fi
done

# ========================================
# USER DELETION
# ========================================
# ========================================
# CONFIRMATION BEFORE DELETION
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}IMPORTANT: About to delete test-anonymize@example.com${NC}"
echo "${YELLOW}========================================${NC}"
echo "${RED}⚠️  WARNING: If you are currently logged in as test-anonymize@example.com,${NC}"
echo "${RED}   please log out first, otherwise the deletion will fail!${NC}"
echo ""
echo "${YELLOW}Are you ready to proceed with user deletion? (y/n)${NC}"
read -r CONFIRM_DELETION

if [ "$CONFIRM_DELETION" != "y" ]; then
    echo "${BLUE}Deletion cancelled. Test completed without deletion.${NC}"
    echo "${GREEN}Test completed successfully!${NC}"
    exit 0
fi

echo "${GREEN}Proceeding with user deletion...${NC}"
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
if [ "$VERSE_COUNT" != "10" ]; then
    echo "${RED}Error: Expected 10 verses for user 2, found $VERSE_COUNT${NC}"
    exit 1
fi

if [ "$POINTS_COUNT" != "23" ]; then
    echo "${RED}Error: Expected 23 point events for user 2, found $POINTS_COUNT${NC}"
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

exit 0