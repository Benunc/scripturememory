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
    echo "${YELLOW}Aggressively cleaning database...${NC}"
    # First, disable foreign keys
    npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = OFF;" | cat
    check_status
    
    # Drop all tables that might exist (including new marketing and notification tables)
    npx wrangler d1 execute DB --env development --command="DROP TABLE IF EXISTS notification_logs; DROP TABLE IF EXISTS notification_settings; DROP TABLE IF EXISTS marketing_events; DROP TABLE IF EXISTS user_permissions; DROP TABLE IF EXISTS admin_audit_log; DROP TABLE IF EXISTS super_admins; DROP TABLE IF EXISTS group_invitations; DROP TABLE IF EXISTS group_members; DROP TABLE IF EXISTS groups; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS anonymized_users;" | cat
    check_status
    
    # Re-enable foreign keys
    npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = ON;" | cat
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
  -d '{"email":"test-anonymize@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
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
    -d '{"email":"test-anonymize2@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":true}')
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
# Test initial state - should be 0
echo "${YELLOW}Checking initial longest word guess streak...${NC}"
INITIAL_STREAK_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = 2;" | cat)
check_status
echo "${BLUE}Initial streak data:${NC}"
echo "$INITIAL_STREAK_CHECK"

# Extract the initial streak value
INITIAL_STREAK_JSON=$(echo "$INITIAL_STREAK_CHECK" | sed -n '/\[/,/\]/p')
INITIAL_STREAK_VALUE=$(echo "$INITIAL_STREAK_JSON" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$INITIAL_STREAK_VALUE" != "0" ]; then
    echo "${RED}Error: Expected initial longest word guess streak of 0, found $INITIAL_STREAK_VALUE${NC}"
    exit 1
fi
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

# ========================================
# LONGEST WORD GUESS STREAK TESTS
# ========================================
echo "${YELLOW}Testing longest word guess streak functionality...${NC}"

# Test word guess streak of 16 (should update longest streak)
echo "${YELLOW}Testing word guess streak of 16...${NC}"
for i in {1..16}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 7200000))) # 2 hours apart
  STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":$i},\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added word guess streak event: length $i at $TIMESTAMP${NC}"
done

# Check that longest streak was updated to 16
echo "${YELLOW}Checking longest streak after 16-word streak...${NC}"
STREAK_3_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = 2;" | cat)
check_status
echo "${BLUE}Longest streak after 16-word streak:${NC}"
echo "$STREAK_3_CHECK"
STREAK_3_JSON=$(echo "$STREAK_3_CHECK" | sed -n '/\[/,/\]/p')
STREAK_3_VALUE=$(echo "$STREAK_3_JSON" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_3_VALUE" != "16" ]; then
    echo "${RED}Error: Expected longest word guess streak of 16, found $STREAK_3_VALUE${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak updated to 16${NC}"

# Test shorter streak (should NOT update longest streak)
echo "${YELLOW}Testing shorter word guess streak of 2 (should not update longest)...${NC}"
for i in {1..2}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 14400000))) # 4 hours apart
  STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN2" \
    -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":$i},\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added word guess streak event: length $i at $TIMESTAMP${NC}"
done

# Check that longest streak remains 5
echo "${YELLOW}Checking longest streak after shorter streak...${NC}"
STREAK_SHORT_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = 2;" | cat)
check_status
STREAK_SHORT_JSON=$(echo "$STREAK_SHORT_CHECK" | sed -n '/\[/,/\]/p')
STREAK_SHORT_VALUE=$(echo "$STREAK_SHORT_JSON" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_SHORT_VALUE" != "16" ]; then
    echo "${RED}Error: Expected longest word guess streak to remain 16, found $STREAK_SHORT_VALUE${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak correctly remains 16${NC}"

# Test incorrect word guess (should reset current streak but not affect longest)
echo "${YELLOW}Testing incorrect word guess (should not affect longest streak)...${NC}"
INCORRECT_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"event_type\":\"word_incorrect\",\"points\":0.0,\"metadata\":{\"streak_length\":0},\"created_at\":$((BASE_TIMESTAMP + 18000000))}")
check_status
echo "${BLUE}Added incorrect word guess event${NC}"

# Check that longest streak still remains 16
echo "${YELLOW}Checking longest streak after incorrect guess...${NC}"
STREAK_INCORRECT_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = 2;" | cat)
check_status
STREAK_INCORRECT_JSON=$(echo "$STREAK_INCORRECT_CHECK" | sed -n '/\[/,/\]/p')
STREAK_INCORRECT_VALUE=$(echo "$STREAK_INCORRECT_JSON" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_INCORRECT_VALUE" != "16" ]; then
    echo "${RED}Error: Expected longest word guess streak to remain 16 after incorrect guess, found $STREAK_INCORRECT_VALUE${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak correctly remains 16 after incorrect guess${NC}"

# Test that longest streak appears in user stats
echo "${YELLOW}Testing longest word guess streak in user stats...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats response:${NC}"
echo "$STATS_RESPONSE"

# Check if longest_word_guess_streak appears in the response
if ! echo "$STATS_RESPONSE" | grep -q "longest_word_guess_streak"; then
    echo "${RED}Error: longest_word_guess_streak not found in stats response${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak appears in user stats${NC}"

# Test that longest streak appears in user stats
echo "${YELLOW}Testing longest word guess streak in user stats...${NC}"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats" \
  -H "Authorization: Bearer $SESSION_TOKEN2")
check_status
echo "${BLUE}Stats response:${NC}"
echo "$STATS_RESPONSE"

# Check if longest_word_guess_streak appears in the response
if ! echo "$STATS_RESPONSE" | grep -q "longest_word_guess_streak"; then
    echo "${RED}Error: longest_word_guess_streak not found in stats response${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak appears in user stats${NC}"

echo "${GREEN}✓ All longest word guess streak tests passed${NC}"

# Test for new user streak bug fix (multiple calls with same streak length)
echo "${YELLOW}Testing new user streak bug fix...${NC}"

# Create a new test user for this specific test
echo "${YELLOW}Creating test user for streak bug fix...${NC}"
MAGIC_LINK_RESPONSE_BUGFIX=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-streak-bugfix@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","marketingOptIn":false}')
check_status

# Extract magic token for bug fix test user
MAGIC_TOKEN_BUGFIX=$(extract_magic_token "$MAGIC_LINK_RESPONSE_BUGFIX")
echo "${BLUE}Magic token for bug fix test user: $MAGIC_TOKEN_BUGFIX${NC}"
check_status

# Log in the bug fix test user
echo "${YELLOW}Logging in bug fix test user...${NC}"
VERIFY_RESPONSE_BUGFIX=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN_BUGFIX")
check_status
SESSION_TOKEN_BUGFIX=$(extract_token "$VERIFY_RESPONSE_BUGFIX")
echo "${BLUE}Session token for bug fix test user: $SESSION_TOKEN_BUGFIX${NC}"

# Verify initial longest streak is 0
echo "${YELLOW}Verifying initial longest streak is 0...${NC}"
INITIAL_STREAK_CHECK_BUGFIX=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = (SELECT id FROM users WHERE email = 'test-streak-bugfix@example.com');" | cat)
check_status
echo "${BLUE}Initial streak data:${NC}"
echo "$INITIAL_STREAK_CHECK_BUGFIX"

# Extract the initial streak value
INITIAL_STREAK_JSON_BUGFIX=$(echo "$INITIAL_STREAK_CHECK_BUGFIX" | sed -n '/\[/,/\]/p')
INITIAL_STREAK_VALUE_BUGFIX=$(echo "$INITIAL_STREAK_JSON_BUGFIX" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$INITIAL_STREAK_VALUE_BUGFIX" != "0" ]; then
    echo "${RED}Error: Expected initial longest word guess streak of 0, found $INITIAL_STREAK_VALUE_BUGFIX${NC}"
    exit 1
fi

echo "${GREEN}✓ Initial longest streak is 0${NC}"

# Send multiple API calls with the same streak length (3) - this should only update once
echo "${YELLOW}Testing multiple API calls with same streak length...${NC}"
for i in {1..3}; do
  TIMESTAMP=$((BASE_TIMESTAMP + (i * 3600000))) # 1 hour apart
  STREAK_RESPONSE_BUGFIX=$(curl -s -X POST http://localhost:8787/gamification/points \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SESSION_TOKEN_BUGFIX" \
    -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":3},\"created_at\":$TIMESTAMP}")
  check_status
  echo "${BLUE}Added word guess streak event $i: length 3 at $TIMESTAMP${NC}"
done

# Check that longest streak was only updated once to 3 (not incremented multiple times)
echo "${YELLOW}Checking longest streak after multiple calls...${NC}"
STREAK_CHECK_BUGFIX=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = (SELECT id FROM users WHERE email = 'test-streak-bugfix@example.com');" | cat)
check_status
echo "${BLUE}Longest streak after multiple calls:${NC}"
echo "$STREAK_CHECK_BUGFIX"
STREAK_JSON_BUGFIX=$(echo "$STREAK_CHECK_BUGFIX" | sed -n '/\[/,/\]/p')
STREAK_VALUE_BUGFIX=$(echo "$STREAK_JSON_BUGFIX" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_VALUE_BUGFIX" != "3" ]; then
    echo "${RED}Error: Expected longest word guess streak of 3, found $STREAK_VALUE_BUGFIX${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak correctly updated to 3 (not incremented multiple times)${NC}"

# Test with is_new_longest flag (should update even if streak length is same)
echo "${YELLOW}Testing with is_new_longest flag...${NC}"
STREAK_RESPONSE_FLAG=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_BUGFIX" \
  -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":3,\"is_new_longest\":true},\"created_at\":$((BASE_TIMESTAMP + 14400000))}")
check_status
echo "${BLUE}Added word guess streak event with is_new_longest flag${NC}"

# Check that longest streak remains 3 (should not change since it's the same length)
echo "${YELLOW}Checking longest streak after is_new_longest flag...${NC}"
STREAK_CHECK_FLAG=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = (SELECT id FROM users WHERE email = 'test-streak-bugfix@example.com');" | cat)
check_status
STREAK_JSON_FLAG=$(echo "$STREAK_CHECK_FLAG" | sed -n '/\[/,/\]/p')
STREAK_VALUE_FLAG=$(echo "$STREAK_JSON_FLAG" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_VALUE_FLAG" != "3" ]; then
    echo "${RED}Error: Expected longest word guess streak to remain 3, found $STREAK_VALUE_FLAG${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak correctly remains 3 after is_new_longest flag${NC}"

# Test with higher streak length (should update)
echo "${YELLOW}Testing with higher streak length...${NC}"
STREAK_RESPONSE_HIGHER=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_BUGFIX" \
  -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":5},\"created_at\":$((BASE_TIMESTAMP + 18000000))}")
check_status
echo "${BLUE}Added word guess streak event with length 5${NC}"

# Check that longest streak was updated to 5
echo "${YELLOW}Checking longest streak after higher streak...${NC}"
STREAK_CHECK_HIGHER=$(npx wrangler d1 execute DB --env development --command="SELECT longest_word_guess_streak FROM user_stats WHERE user_id = (SELECT id FROM users WHERE email = 'test-streak-bugfix@example.com');" | cat)
check_status
STREAK_JSON_HIGHER=$(echo "$STREAK_CHECK_HIGHER" | sed -n '/\[/,/\]/p')
STREAK_VALUE_HIGHER=$(echo "$STREAK_JSON_HIGHER" | grep -A1 '"longest_word_guess_streak":' | grep "longest_word_guess_streak" | awk '{print $2}' | tr -d ',')

if [ "$STREAK_VALUE_HIGHER" != "5" ]; then
    echo "${RED}Error: Expected longest word guess streak to be 5, found $STREAK_VALUE_HIGHER${NC}"
    exit 1
fi

echo "${GREEN}✓ Longest word guess streak correctly updated to 5${NC}"

# Log out the bug fix test user
echo "${YELLOW}Logging out bug fix test user...${NC}"
LOGOUT_RESPONSE_BUGFIX=$(curl -s -X POST http://localhost:8787/auth/sign-out \
    -H "Authorization: Bearer $SESSION_TOKEN_BUGFIX")
check_status

echo "${GREEN}✓ All streak bug fix tests passed${NC}"

# VERSE STREAK TESTS
echo "${YELLOW}Testing verse streak functionality...${NC}"

# Create a new test user for verse streak tests
echo "${YELLOW}Creating test user for verse streak tests...${NC}"
MAGIC_LINK_RESPONSE_VERSE_STREAK=$(curl -s -X POST http://localhost:8787/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{"email":"test-verse-streak@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","marketingOptIn":false}')
check_status

# Extract magic token for verse streak test user
MAGIC_TOKEN_VERSE_STREAK=$(extract_magic_token "$MAGIC_LINK_RESPONSE_VERSE_STREAK")
echo "${BLUE}Magic token for verse streak test user: $MAGIC_TOKEN_VERSE_STREAK${NC}"
check_status

# Log in the verse streak test user
echo "${YELLOW}Logging in verse streak test user...${NC}"
VERIFY_RESPONSE_VERSE_STREAK=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN_VERSE_STREAK")
check_status
SESSION_TOKEN_VERSE_STREAK=$(extract_token "$VERIFY_RESPONSE_VERSE_STREAK")
echo "${BLUE}Session token for verse streak test user: $SESSION_TOKEN_VERSE_STREAK${NC}"

# Test initial verse streak state
echo "${YELLOW}Testing initial verse streak state...${NC}"
INITIAL_VERSE_STREAKS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/verse-streaks" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status
echo "${BLUE}Initial verse streaks response:${NC}"
echo "$INITIAL_VERSE_STREAKS_RESPONSE"

# Verify initial verse streaks are empty
if ! echo "$INITIAL_VERSE_STREAKS_RESPONSE" | grep -q '"verse_streaks":\[\]'; then
    echo "${RED}Error: Expected empty verse streaks array initially${NC}"
    exit 1
fi

echo "${GREEN}✓ Initial verse streaks are empty${NC}"

# Test creating verse streak for Genesis 1:1
echo "${YELLOW}Testing verse streak creation for Genesis 1:1...${NC}"
VERSE_STREAK_RESPONSE1=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK" \
  -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":5,\"verse_reference\":\"Genesis 1:1\"},\"created_at\":$((BASE_TIMESTAMP + 20000000))}")
check_status
echo "${BLUE}Added verse streak event for Genesis 1:1: length 5${NC}"

# Check verse streaks after first event
echo "${YELLOW}Checking verse streaks after first event...${NC}"
VERSE_STREAKS_CHECK1=$(curl -s -X GET "http://localhost:8787/gamification/verse-streaks" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status
echo "${BLUE}Verse streaks after first event:${NC}"
echo "$VERSE_STREAKS_CHECK1"

# Verify Genesis 1:1 streak was created
if ! echo "$VERSE_STREAKS_CHECK1" | grep -q '"verse_reference":"Genesis 1:1"'; then
    echo "${RED}Error: Genesis 1:1 verse streak not found${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK1" | grep -q '"longest_guess_streak":5'; then
    echo "${RED}Error: Genesis 1:1 longest streak should be 5${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK1" | grep -q '"current_guess_streak":5'; then
    echo "${RED}Error: Genesis 1:1 current streak should be 5${NC}"
    exit 1
fi

echo "${GREEN}✓ Genesis 1:1 verse streak created successfully${NC}"

# Test updating verse streak for Genesis 1:1
echo "${YELLOW}Testing verse streak update for Genesis 1:1...${NC}"
VERSE_STREAK_RESPONSE2=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK" \
  -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":10,\"verse_reference\":\"Genesis 1:1\"},\"created_at\":$((BASE_TIMESTAMP + 21000000))}")
check_status
echo "${BLUE}Updated verse streak event for Genesis 1:1: length 10${NC}"

# Check verse streaks after update
echo "${YELLOW}Checking verse streaks after update...${NC}"
VERSE_STREAKS_CHECK2=$(curl -s -X GET "http://localhost:8787/gamification/verse-streaks" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status

# Verify Genesis 1:1 streak was updated
if ! echo "$VERSE_STREAKS_CHECK2" | grep -q '"longest_guess_streak":10'; then
    echo "${RED}Error: Genesis 1:1 longest streak should be 10${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK2" | grep -q '"current_guess_streak":10'; then
    echo "${RED}Error: Genesis 1:1 current streak should be 10${NC}"
    exit 1
fi

echo "${GREEN}✓ Genesis 1:1 verse streak updated successfully${NC}"

# Test creating verse streak for different verse (John 3:16)
echo "${YELLOW}Testing verse streak creation for John 3:16...${NC}"
VERSE_STREAK_RESPONSE3=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK" \
  -d "{\"event_type\":\"word_correct\",\"points\":1.0,\"metadata\":{\"streak_length\":3,\"verse_reference\":\"John 3:16\"},\"created_at\":$((BASE_TIMESTAMP + 22000000))}")
check_status
echo "${BLUE}Added verse streak event for John 3:16: length 3${NC}"

# Check verse streaks after adding second verse
echo "${YELLOW}Checking verse streaks after adding second verse...${NC}"
VERSE_STREAKS_CHECK3=$(curl -s -X GET "http://localhost:8787/gamification/verse-streaks" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status

# Verify both verses have streaks
if ! echo "$VERSE_STREAKS_CHECK3" | grep -q '"verse_reference":"Genesis 1:1"'; then
    echo "${RED}Error: Genesis 1:1 verse streak not found after adding John 3:16${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK3" | grep -q '"verse_reference":"John 3:16"'; then
    echo "${RED}Error: John 3:16 verse streak not found${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK3" | grep -q '"longest_guess_streak":3'; then
    echo "${RED}Error: John 3:16 longest streak should be 3${NC}"
    exit 1
fi

echo "${GREEN}✓ John 3:16 verse streak created successfully${NC}"

# Test resetting verse streak
echo "${YELLOW}Testing verse streak reset...${NC}"
RESET_VERSE_STREAK_RESPONSE=$(curl -s -X POST http://localhost:8787/gamification/verse-streaks/reset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK" \
  -d '{"verse_reference":"Genesis 1:1"}')
check_status
echo "${BLUE}Reset verse streak response:${NC}"
echo "$RESET_VERSE_STREAK_RESPONSE"

# Check verse streaks after reset
echo "${YELLOW}Checking verse streaks after reset...${NC}"
VERSE_STREAKS_CHECK4=$(curl -s -X GET "http://localhost:8787/gamification/verse-streaks" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status

# Verify Genesis 1:1 current streak was reset but longest streak remains
if ! echo "$VERSE_STREAKS_CHECK4" | grep -q '"current_guess_streak":0'; then
    echo "${RED}Error: Genesis 1:1 current streak should be 0 after reset${NC}"
    exit 1
fi

if ! echo "$VERSE_STREAKS_CHECK4" | grep -q '"longest_guess_streak":10'; then
    echo "${RED}Error: Genesis 1:1 longest streak should remain 10 after reset${NC}"
    exit 1
fi

echo "${GREEN}✓ Genesis 1:1 verse streak reset successfully${NC}"

# Test verse streaks in user stats
echo "${YELLOW}Testing verse streaks in user stats...${NC}"
STATS_WITH_VERSE_STREAKS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/stats" \
  -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status

# Verify verse_streaks appears in stats
if ! echo "$STATS_WITH_VERSE_STREAKS_RESPONSE" | grep -q '"verse_streaks"'; then
    echo "${RED}Error: verse_streaks not found in stats response${NC}"
    exit 1
fi

echo "${GREEN}✓ Verse streaks appear in user stats${NC}"

# Log out the verse streak test user
echo "${YELLOW}Logging out verse streak test user...${NC}"
LOGOUT_RESPONSE_VERSE_STREAK=$(curl -s -X POST http://localhost:8787/auth/sign-out \
    -H "Authorization: Bearer $SESSION_TOKEN_VERSE_STREAK")
check_status

echo "${GREEN}✓ All verse streak tests passed${NC}"

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
    -d '{"email":"test-anonymize3@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","marketingOptIn":false}')
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
  -d '{"email":"group-leader@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
check_status

GROUP_USER2_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-member@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":true}')
check_status

GROUP_USER3_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-outsider@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
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
  -d '{"email":"super-admin@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":true}')
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

if echo "$PERMISSION_DENIED_RESPONSE" | grep -q "You do not have permission to remove members from this group"; then
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
  -d '{"email":"true-regular-member@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
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

# Test 1: No parameters (except marketing which is now required)
echo "${YELLOW}Test 1: Creating magic link with minimal parameters...${NC}"
NO_PARAMS_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"no-params@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
check_status
NO_PARAMS_TOKEN=$(extract_magic_token "$NO_PARAMS_RESPONSE")
echo "${BLUE}No params token: $NO_PARAMS_TOKEN${NC}"

# Test 1.5: Marketing opt-in
echo "${YELLOW}Test 1.5: Creating magic link with marketing opt-in...${NC}"
MARKETING_OPT_IN_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"marketing-opt-in@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":true}')
check_status
MARKETING_OPT_IN_TOKEN=$(extract_magic_token "$MARKETING_OPT_IN_RESPONSE")
echo "${BLUE}Marketing opt-in token: $MARKETING_OPT_IN_TOKEN${NC}"

# Test 1.6: Marketing opt-out (explicit)
echo "${YELLOW}Test 1.6: Creating magic link with marketing opt-out (explicit)...${NC}"
MARKETING_OPT_OUT_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"marketing-opt-out@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
check_status
MARKETING_OPT_OUT_TOKEN=$(extract_magic_token "$MARKETING_OPT_OUT_RESPONSE")
echo "${BLUE}Marketing opt-out token: $MARKETING_OPT_OUT_TOKEN${NC}"

# Test 2: Verse set only
echo "${YELLOW}Test 2: Creating magic link with verse set only...${NC}"
VERSE_ONLY_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"verse-only@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","marketingOptIn":false"}')
check_status
VERSE_ONLY_TOKEN=$(extract_magic_token "$VERSE_ONLY_RESPONSE")
echo "${BLUE}Verse only token: $VERSE_ONLY_TOKEN${NC}"

# Test 3: Group code only
echo "${YELLOW}Test 3: Creating magic link with group code only...${NC}"
GROUP_ONLY_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"group-only@example.com","isRegistration":true,"turnstileToken":"test-token","groupCode":"test-group-123","marketingOptIn":true"}')
check_status
GROUP_ONLY_TOKEN=$(extract_magic_token "$GROUP_ONLY_RESPONSE")
echo "${BLUE}Group only token: $GROUP_ONLY_TOKEN${NC}"

# Test 4: Both verse set and group code
echo "${YELLOW}Test 4: Creating magic link with both verse set and group code...${NC}"
BOTH_PARAMS_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"both-params@example.com","isRegistration":true,"turnstileToken":"test-token","verseSet":"childrens_verses","groupCode":"test-group-123","marketingOptIn":false"}')
check_status
BOTH_PARAMS_TOKEN=$(extract_magic_token "$BOTH_PARAMS_RESPONSE")
echo "${BLUE}Both params token: $BOTH_PARAMS_TOKEN${NC}"

# Test 5: Invalid group code
echo "${YELLOW}Test 5: Creating magic link with invalid group code...${NC}"
INVALID_GROUP_RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-group@example.com","isRegistration":true,"turnstileToken":"test-token","groupCode":"invalid-group-999","marketingOptIn":false"}')
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

# Verify marketing opt-in
echo "${YELLOW}Verifying marketing opt-in magic link...${NC}"
MARKETING_OPT_IN_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$MARKETING_OPT_IN_TOKEN")
check_status
MARKETING_OPT_IN_SESSION=$(extract_token "$MARKETING_OPT_IN_VERIFY")
echo "${BLUE}Marketing opt-in session: $MARKETING_OPT_IN_SESSION${NC}"

# Verify marketing opt-out
echo "${YELLOW}Verifying marketing opt-out magic link...${NC}"
MARKETING_OPT_OUT_VERIFY=$(curl -s -i "http://localhost:8787/auth/verify?token=$MARKETING_OPT_OUT_TOKEN")
check_status
MARKETING_OPT_OUT_SESSION=$(extract_token "$MARKETING_OPT_OUT_VERIFY")
echo "${BLUE}Marketing opt-out session: $MARKETING_OPT_OUT_SESSION${NC}"

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



# ========================================
# SUPER ADMIN TESTS
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}TESTING SUPER ADMIN FUNCTIONALITY${NC}"
echo "${YELLOW}========================================${NC}"

#test the ability to view verses from a specific user
echo "${YELLOW}Testing the ability to view verses from a specific user...${NC}"

# Test 1: Super admin viewing verses from a regular user
echo "${YELLOW}Test 1: Super admin viewing verses from regular user...${NC}"
SUPER_ADMIN_VIEW_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/2/verses" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $SUPER_ADMIN_VIEW_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin view failed: $SUPER_ADMIN_VIEW_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Super admin view response: $SUPER_ADMIN_VIEW_RESPONSE${NC}"

# Test 2: Regular user trying to view another user's verses (should fail)
echo "${YELLOW}Test 2: Regular user trying to view another user's verses (should fail)...${NC}"
REGULAR_USER_VIEW_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/1/verses" \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

if [[ $REGULAR_USER_VIEW_RESPONSE != *"error"* ]]; then
    echo "${RED}Regular user view should have failed but succeeded: $REGULAR_USER_VIEW_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Regular user view correctly failed: $REGULAR_USER_VIEW_RESPONSE${NC}"

# Test 3: Super admin viewing verses from non-existent user
echo "${YELLOW}Test 3: Super admin viewing verses from non-existent user...${NC}"
NONEXISTENT_USER_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/999/verses" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $NONEXISTENT_USER_RESPONSE != *"error"* ]]; then
    echo "${RED}Non-existent user view should have failed but succeeded: $NONEXISTENT_USER_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Non-existent user view correctly failed: $NONEXISTENT_USER_RESPONSE${NC}"

# Test 4: Super admin viewing verses without userId parameter
echo "${YELLOW}Test 4: Super admin viewing verses without userId parameter...${NC}"
NO_USERID_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users//verses" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $NO_USERID_RESPONSE != *"error"* ]]; then
    echo "${RED}Missing userId should have failed but succeeded: $NO_USERID_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Missing userId correctly failed: $NO_USERID_RESPONSE${NC}"

# Test 5: Unauthenticated request
echo "${YELLOW}Test 5: Unauthenticated request...${NC}"
UNAUTH_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/2/verses")
check_status

if [[ $UNAUTH_RESPONSE != *"error"* ]]; then
    echo "${RED}Unauthenticated request should have failed but succeeded: $UNAUTH_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Unauthenticated request correctly failed: $UNAUTH_RESPONSE${NC}"

# Test 6: Super admin viewing their own verses
echo "${YELLOW}Test 6: Super admin viewing their own verses...${NC}"
SELF_VIEW_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/1/verses" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $SELF_VIEW_RESPONSE == *"error"* ]]; then
    echo "${RED}Self view failed: $SELF_VIEW_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Self view response: $SELF_VIEW_RESPONSE${NC}"

# Test 7: Invalid userId format
echo "${YELLOW}Test 7: Invalid userId format...${NC}"
INVALID_USERID_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users/abc/verses" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $INVALID_USERID_RESPONSE != *"error"* ]]; then
    echo "${RED}Invalid userId should have failed but succeeded: $INVALID_USERID_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Invalid userId correctly failed: $INVALID_USERID_RESPONSE${NC}"

echo "${GREEN}✓ All admin verse viewing tests passed${NC}"

# ========================================
# TIME-BASED STATS TESTS
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}TIME-BASED STATS TESTS${NC}"
echo "${YELLOW}========================================${NC}"

# Test 1: Get time-based stats for current user (all time)
echo "${YELLOW}Test 1: Get time-based stats for current user (all time)...${NC}"
TIME_STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=all" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $TIME_STATS_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based stats failed: $TIME_STATS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based stats response: $TIME_STATS_RESPONSE${NC}"

# Test 2: Get time-based stats for current user (this month)
echo "${YELLOW}Test 2: Get time-based stats for current user (this month)...${NC}"
TIME_STATS_MONTH_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=this_month" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $TIME_STATS_MONTH_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based stats (this month) failed: $TIME_STATS_MONTH_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based stats (this month) response: $TIME_STATS_MONTH_RESPONSE${NC}"

# Test 3: Get time-based stats for current user (last month)
echo "${YELLOW}Test 3: Get time-based stats for current user (last month)...${NC}"
TIME_STATS_LAST_MONTH_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=last_month" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $TIME_STATS_LAST_MONTH_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based stats (last month) failed: $TIME_STATS_LAST_MONTH_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based stats (last month) response: $TIME_STATS_LAST_MONTH_RESPONSE${NC}"

# Test 4: Get time-based stats for another user (as super admin)
echo "${YELLOW}Test 4: Get time-based stats for another user (as super admin)...${NC}"
TIME_STATS_OTHER_USER_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=all&user_id=2" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $TIME_STATS_OTHER_USER_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based stats for other user failed: $TIME_STATS_OTHER_USER_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based stats for other user response: $TIME_STATS_OTHER_USER_RESPONSE${NC}"

# Test 5: Invalid timeframe parameter
echo "${YELLOW}Test 5: Invalid timeframe parameter...${NC}"
INVALID_TIMEFRAME_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=invalid" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $INVALID_TIMEFRAME_RESPONSE != *"error"* ]]; then
    echo "${RED}Invalid timeframe should have failed but succeeded: $INVALID_TIMEFRAME_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Invalid timeframe correctly failed: $INVALID_TIMEFRAME_RESPONSE${NC}"

# Test 6: Unauthorized access (no token)
echo "${YELLOW}Test 6: Unauthorized access (no token)...${NC}"
UNAUTHORIZED_TIME_STATS_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/time-based-stats?timeframe=all")
check_status

if [[ $UNAUTHORIZED_TIME_STATS_RESPONSE != *"error"* ]]; then
    echo "${RED}Unauthorized access should have failed but succeeded: $UNAUTHORIZED_TIME_STATS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Unauthorized access correctly failed: $UNAUTHORIZED_TIME_STATS_RESPONSE${NC}"

echo "${GREEN}✓ All time-based stats tests passed${NC}"

# ========================================
# TIME-BASED LEADERBOARD TESTS
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}TIME-BASED LEADERBOARD TESTS${NC}"
echo "${YELLOW}========================================${NC}"

# Test 1: Get time-based leaderboard (all time, points)
echo "${YELLOW}Test 1: Get time-based leaderboard (all time, points)...${NC}"
TIME_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=all&metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $TIME_LEADERBOARD_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based leaderboard failed: $TIME_LEADERBOARD_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based leaderboard response: $TIME_LEADERBOARD_RESPONSE${NC}"

# Test 2: Get time-based leaderboard (this month, verses mastered)
echo "${YELLOW}Test 2: Get time-based leaderboard (this month, verses mastered)...${NC}"
TIME_LEADERBOARD_VERSES_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=this_month&metric=verses_mastered" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $TIME_LEADERBOARD_VERSES_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based leaderboard (verses mastered) failed: $TIME_LEADERBOARD_VERSES_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based leaderboard (verses mastered) response: $TIME_LEADERBOARD_VERSES_RESPONSE${NC}"

# Test 3: Get time-based leaderboard (verses mastered, all time)
echo "${YELLOW}Test 3: Get time-based leaderboard (verses mastered, all time)...${NC}"
TIME_LEADERBOARD_VERSES_ALL_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=all&metric=verses_mastered" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $TIME_LEADERBOARD_VERSES_ALL_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based leaderboard (verses mastered, all time) failed: $TIME_LEADERBOARD_VERSES_ALL_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based leaderboard (verses mastered, all time) response: $TIME_LEADERBOARD_VERSES_ALL_RESPONSE${NC}"

# Test 4: Get time-based leaderboard (points, this year)
echo "${YELLOW}Test 4: Get time-based leaderboard (points, this year)...${NC}"
TIME_LEADERBOARD_POINTS_YEAR_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=this_year&metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $TIME_LEADERBOARD_POINTS_YEAR_RESPONSE == *"error"* ]]; then
    echo "${RED}Time-based leaderboard (points, this year) failed: $TIME_LEADERBOARD_POINTS_YEAR_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Time-based leaderboard (points, this year) response: $TIME_LEADERBOARD_POINTS_YEAR_RESPONSE${NC}"

# Test 5: Invalid metric parameter
echo "${YELLOW}Test 5: Invalid metric parameter...${NC}"
INVALID_METRIC_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=all&metric=accuracy" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $INVALID_METRIC_RESPONSE != *"error"* ]]; then
    echo "${RED}Invalid metric should have failed but succeeded: $INVALID_METRIC_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Invalid metric correctly failed: $INVALID_METRIC_RESPONSE${NC}"

# Test 6: Invalid timeframe parameter for leaderboard
echo "${YELLOW}Test 6: Invalid timeframe parameter for leaderboard...${NC}"
INVALID_LEADERBOARD_TIMEFRAME_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=invalid&metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $INVALID_LEADERBOARD_TIMEFRAME_RESPONSE != *"error"* ]]; then
    echo "${RED}Invalid timeframe for leaderboard should have failed but succeeded: $INVALID_LEADERBOARD_TIMEFRAME_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Invalid timeframe for leaderboard correctly failed: $INVALID_LEADERBOARD_TIMEFRAME_RESPONSE${NC}"

# Test 7: Missing group ID
echo "${YELLOW}Test 7: Missing group ID...${NC}"
MISSING_GROUP_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/?timeframe=all&metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $MISSING_GROUP_RESPONSE != *"error"* ]]; then
    echo "${RED}Missing group ID should have failed but succeeded: $MISSING_GROUP_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Missing group ID correctly failed: $MISSING_GROUP_RESPONSE${NC}"

# Test 8: Access leaderboard as non-member
echo "${YELLOW}Test 8: Access leaderboard as non-member...${NC}"
NON_MEMBER_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/999?timeframe=all&metric=points" \
  -H "Authorization: Bearer $GROUP_SESSION1")
check_status

if [[ $NON_MEMBER_LEADERBOARD_RESPONSE != *"error"* ]]; then
    echo "${RED}Non-member access should have failed but succeeded: $NON_MEMBER_LEADERBOARD_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Non-member access correctly failed: $NON_MEMBER_LEADERBOARD_RESPONSE${NC}"

# Test 9: Access leaderboard as super admin (should work even for non-existent group)
echo "${YELLOW}Test 9: Access leaderboard as super admin...${NC}"
SUPER_ADMIN_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/999?timeframe=all&metric=points" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

# This should succeed for super admin even if group doesn't exist (empty leaderboard)
if [[ $SUPER_ADMIN_LEADERBOARD_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin leaderboard access failed: $SUPER_ADMIN_LEADERBOARD_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Super admin leaderboard response: $SUPER_ADMIN_LEADERBOARD_RESPONSE${NC}"

# Test 10: Unauthorized access to leaderboard (no token)
echo "${YELLOW}Test 10: Unauthorized access to leaderboard (no token)...${NC}"
UNAUTHORIZED_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/gamification/leaderboard/1?timeframe=all&metric=points")
check_status

if [[ $UNAUTHORIZED_LEADERBOARD_RESPONSE != *"error"* ]]; then
    echo "${RED}Unauthorized leaderboard access should have failed but succeeded: $UNAUTHORIZED_LEADERBOARD_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Unauthorized leaderboard access correctly failed: $UNAUTHORIZED_LEADERBOARD_RESPONSE${NC}"

echo "${GREEN}✓ All time-based leaderboard tests passed${NC}"

# ========================================
# ADMIN ROUTE TESTS
# ========================================
echo "${YELLOW}========================================${NC}"
echo "${YELLOW}TESTING ADMIN ROUTES${NC}"
echo "${YELLOW}========================================${NC}"

# Test 1: Super admin accessing /admin/users
echo "${YELLOW}Test 1: Super admin accessing /admin/users...${NC}"

# Debug: Test super admin session first
echo "${YELLOW}Debug: Testing super admin session...${NC}"
SUPER_ADMIN_TEST=$(curl -s -X GET "http://localhost:8787/admin/check-super-admin" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
echo "${BLUE}Super admin test response: $SUPER_ADMIN_TEST${NC}"

ADMIN_USERS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $ADMIN_USERS_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin /admin/users failed: $ADMIN_USERS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Admin users response: $ADMIN_USERS_RESPONSE${NC}"

# Verify the response contains users data
if echo "$ADMIN_USERS_RESPONSE" | grep -q '"users"'; then
    echo "${GREEN}✓ Super admin can access /admin/users${NC}"
else
    echo "${RED}✗ Super admin /admin/users response missing users data${NC}"
    exit 1
fi

# Test 2: Super admin accessing /admin/groups
echo "${YELLOW}Test 2: Super admin accessing /admin/groups...${NC}"
ADMIN_GROUPS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/groups" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $ADMIN_GROUPS_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin /admin/groups failed: $ADMIN_GROUPS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Admin groups response: $ADMIN_GROUPS_RESPONSE${NC}"

# Verify the response contains groups data
if echo "$ADMIN_GROUPS_RESPONSE" | grep -q '"groups"'; then
    echo "${GREEN}✓ Super admin can access /admin/groups${NC}"
else
    echo "${RED}✗ Super admin /admin/groups response missing groups data${NC}"
    exit 1
fi

# Test 3: Super admin accessing /admin/permissions
echo "${YELLOW}Test 3: Super admin accessing /admin/permissions...${NC}"
ADMIN_PERMISSIONS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/permissions" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $ADMIN_PERMISSIONS_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin /admin/permissions failed: $ADMIN_PERMISSIONS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Admin permissions response: $ADMIN_PERMISSIONS_RESPONSE${NC}"

# Verify the response contains permissions data
if echo "$ADMIN_PERMISSIONS_RESPONSE" | grep -q '"permissions"'; then
    echo "${GREEN}✓ Super admin can access /admin/permissions${NC}"
else
    echo "${RED}✗ Super admin /admin/permissions response missing permissions data${NC}"
    exit 1
fi

# Test 4: Super admin accessing /admin/audit-log
echo "${YELLOW}Test 4: Super admin accessing /admin/audit-log...${NC}"
ADMIN_AUDIT_LOG_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/audit-log" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $ADMIN_AUDIT_LOG_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin /admin/audit-log failed: $ADMIN_AUDIT_LOG_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Admin audit log response: $ADMIN_AUDIT_LOG_RESPONSE${NC}"

# Verify the response contains audit log data
if echo "$ADMIN_AUDIT_LOG_RESPONSE" | grep -q '"auditLog"'; then
    echo "${GREEN}✓ Super admin can access /admin/audit-log${NC}"
else
    echo "${RED}✗ Super admin /admin/audit-log response missing audit log data${NC}"
    exit 1
fi

# Test 5: Regular user trying to access /admin/users (should fail)
echo "${YELLOW}Test 5: Regular user trying to access /admin/users (should fail)...${NC}"
REGULAR_USER_ADMIN_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users" \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

if [[ $REGULAR_USER_ADMIN_RESPONSE != *"error"* ]]; then
    echo "${RED}Regular user /admin/users should have failed but succeeded: $REGULAR_USER_ADMIN_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Regular user /admin/users correctly failed: $REGULAR_USER_ADMIN_RESPONSE${NC}"

# Test 6: Regular user trying to access /admin/groups (should fail)
echo "${YELLOW}Test 6: Regular user trying to access /admin/groups (should fail)...${NC}"
REGULAR_USER_ADMIN_GROUPS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/groups" \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

if [[ $REGULAR_USER_ADMIN_GROUPS_RESPONSE != *"error"* ]]; then
    echo "${RED}Regular user /admin/groups should have failed but succeeded: $REGULAR_USER_ADMIN_GROUPS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Regular user /admin/groups correctly failed: $REGULAR_USER_ADMIN_GROUPS_RESPONSE${NC}"

# Test 7: Unauthenticated access to /admin/users (should fail)
echo "${YELLOW}Test 7: Unauthenticated access to /admin/users (should fail)...${NC}"
UNAUTH_ADMIN_USERS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/users")
check_status

if [[ $UNAUTH_ADMIN_USERS_RESPONSE != *"error"* ]]; then
    echo "${RED}Unauthenticated /admin/users should have failed but succeeded: $UNAUTH_ADMIN_USERS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Unauthenticated /admin/users correctly failed: $UNAUTH_ADMIN_USERS_RESPONSE${NC}"

# Test 8: Unauthenticated access to /admin/groups (should fail)
echo "${YELLOW}Test 8: Unauthenticated access to /admin/groups (should fail)...${NC}"
UNAUTH_ADMIN_GROUPS_RESPONSE=$(curl -s -X GET "http://localhost:8787/admin/groups")
check_status

if [[ $UNAUTH_ADMIN_GROUPS_RESPONSE != *"error"* ]]; then
    echo "${RED}Unauthenticated /admin/groups should have failed but succeeded: $UNAUTH_ADMIN_GROUPS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Unauthenticated /admin/groups correctly failed: $UNAUTH_ADMIN_GROUPS_RESPONSE${NC}"

# Test 9: Super admin accessing /admin/permissions/user/:userId
echo "${YELLOW}Test 9: Super admin accessing /admin/permissions/user/:userId...${NC}"

# First, get the actual user ID for test-anonymize2@example.com to ensure we're using a valid user
echo "${YELLOW}Getting user ID for test-anonymize2@example.com...${NC}"
USER_ID_CHECK=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'test-anonymize2@example.com';" | cat)
check_status

# Extract the user ID from the response
USER_ID_JSON=$(echo "$USER_ID_CHECK" | sed -n '/\[/,/\]/p')
TARGET_USER_ID=$(echo "$USER_ID_JSON" | grep -A1 '"id":' | grep "id" | awk '{print $2}' | tr -d ',')

if [ -z "$TARGET_USER_ID" ]; then
    echo "${RED}Error: Could not find user ID for test-anonymize2@example.com${NC}"
    echo "${BLUE}User ID check response: $USER_ID_CHECK${NC}"
    exit 1
fi

echo "${BLUE}Using user ID $TARGET_USER_ID for test-anonymize2@example.com${NC}"

# Debug: Show the full URL being called
FULL_URL="http://localhost:8787/admin/permissions/user/$TARGET_USER_ID"
echo "${BLUE}Calling URL: $FULL_URL${NC}"

# Debug: Show the super admin session token (first few characters)
SUPER_ADMIN_SESSION_PREFIX=$(echo "$SUPER_ADMIN_SESSION" | cut -c1-20)
echo "${BLUE}Super admin session token (first 20 chars): $SUPER_ADMIN_SESSION_PREFIX...${NC}"

# Debug: Test if the super admin session is still valid
echo "${YELLOW}Testing super admin session validity...${NC}"
SESSION_TEST=$(curl -s -X GET "http://localhost:8787/admin/check-super-admin" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
echo "${BLUE}Session test response: $SESSION_TEST${NC}"

ADMIN_USER_PERMISSIONS_RESPONSE=$(curl -s -X GET "$FULL_URL" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

echo "${BLUE}Raw response: $ADMIN_USER_PERMISSIONS_RESPONSE${NC}"

if [[ $ADMIN_USER_PERMISSIONS_RESPONSE == *"error"* ]]; then
    echo "${BLUE}Admin user permissions response: $ADMIN_USER_PERMISSIONS_RESPONSE${NC}"
    echo "${RED}Super admin /admin/permissions/user/:userId failed: $ADMIN_USER_PERMISSIONS_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Admin user permissions response: $ADMIN_USER_PERMISSIONS_RESPONSE${NC}"

# Verify the response contains user permissions data
if echo "$ADMIN_USER_PERMISSIONS_RESPONSE" | grep -q '"permissions"'; then
    echo "${GREEN}✓ Super admin can access /admin/permissions/user/:userId${NC}"
else
    echo "${RED}✗ Super admin /admin/permissions/user/:userId response missing permissions data${NC}"
    exit 1
fi

# Test 10: Super admin granting permission
echo "${YELLOW}Test 10: Super admin granting permission...${NC}"
GRANT_PERMISSION_RESPONSE=$(curl -s -X POST "http://localhost:8787/admin/permissions/grant" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d "{\"targetUserId\":$TARGET_USER_ID,\"permissionType\":\"create_groups\"}")
check_status

if [[ $GRANT_PERMISSION_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin grant permission failed: $GRANT_PERMISSION_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Grant permission response: $GRANT_PERMISSION_RESPONSE${NC}"

# Verify the response indicates success
if echo "$GRANT_PERMISSION_RESPONSE" | grep -q '"success"'; then
    echo "${GREEN}✓ Super admin can grant permissions${NC}"
else
    echo "${RED}✗ Super admin grant permission response missing success indicator${NC}"
    exit 1
fi

# Test 11: Super admin revoking permission
echo "${YELLOW}Test 11: Super admin revoking permission...${NC}"
REVOKE_PERMISSION_RESPONSE=$(curl -s -X POST "http://localhost:8787/admin/permissions/revoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION" \
  -d "{\"targetUserId\":$TARGET_USER_ID,\"permissionType\":\"create_groups\"}")
check_status

if [[ $REVOKE_PERMISSION_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin revoke permission failed: $REVOKE_PERMISSION_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Revoke permission response: $REVOKE_PERMISSION_RESPONSE${NC}"

# Verify the response indicates success
if echo "$REVOKE_PERMISSION_RESPONSE" | grep -q '"success"'; then
    echo "${GREEN}✓ Super admin can revoke permissions${NC}"
else
    echo "${RED}✗ Super admin revoke permission response missing success indicator${NC}"
    exit 1
fi

# Test 12: Super admin deleting a group
echo "${YELLOW}Test 12: Super admin deleting a group...${NC}"
DELETE_GROUP_RESPONSE=$(curl -s -X DELETE "http://localhost:8787/admin/groups/$GROUP_ID/delete" \
  -H "Authorization: Bearer $SUPER_ADMIN_SESSION")
check_status

if [[ $DELETE_GROUP_RESPONSE == *"error"* ]]; then
    echo "${RED}Super admin delete group failed: $DELETE_GROUP_RESPONSE${NC}"
    exit 1
fi

echo "${BLUE}Delete group response: $DELETE_GROUP_RESPONSE${NC}"

# Verify the response indicates success
if echo "$DELETE_GROUP_RESPONSE" | grep -q '"success"'; then
    echo "${GREEN}✓ Super admin can delete groups${NC}"
else
    echo "${RED}✗ Super admin delete group response missing success indicator${NC}"
    exit 1
fi

echo "${GREEN}✓ All admin route tests passed${NC}"

# ========================================
# USER LOGIN SECTION
# ========================================
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
  "marketing-opt-in@example.com"
  "marketing-opt-out@example.com"
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

if [ "$POINTS_COUNT" != "44" ]; then
    echo "${RED}Error: Expected 44 point events for user 2, found $POINTS_COUNT${NC}"
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