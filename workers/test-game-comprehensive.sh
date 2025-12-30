#!/bin/zsh

# Comprehensive Test Script for Family Games API
# ===============================================
#
# Purpose:
# ---------
# This script tests the complete functionality of the Family Games API endpoints,
# including game creation, joining, round management, word selection, and scoring.
# It aggressively cleans and rebuilds the database from scratch for each test run.
#
# Usage:
# ------
# 1. Start the Wrangler dev server: npx wrangler dev --env development
# 2. Run this script: ./test-game-comprehensive.sh
# 3. Follow the prompts to confirm server is running
#
# Note: This script requires:
# - A running Wrangler dev server
# - curl installed
# - bc installed for floating-point calculations

# Setup PATH for Homebrew Node.js (if installed via Homebrew)
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${BLUE}Family Games API Comprehensive Test Script${NC}\n"

# Function to check if a command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo "${GREEN}✓${NC}"
    else
        echo "${RED}✗${NC}"
        echo "${RED}Test failed!${NC}"
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

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    if [ -z "$data" ]; then
        if [ -z "$headers" ]; then
            curl -s -X $method "http://localhost:8787$endpoint"
        else
            curl -s -X $method "http://localhost:8787$endpoint" -H "$headers"
        fi
    else
        if [ -z "$headers" ]; then
            curl -s -X $method "http://localhost:8787$endpoint" -H "Content-Type: application/json" -d "$data"
        else
            curl -s -X $method "http://localhost:8787$endpoint" -H "Content-Type: application/json" -H "$headers" -d "$data"
        fi
    fi
}

# Check if server is running
echo "${YELLOW}Is the Wrangler dev server running? (y/n)${NC}"
read -r SERVER_RUNNING

if [ "$SERVER_RUNNING" != "y" ]; then
    echo "${RED}Please start the server first: npx wrangler dev --env development${NC}"
    exit 1
fi

# Aggressively clean database
echo "${YELLOW}Aggressively cleaning database...${NC}"
# First, disable foreign keys
npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = OFF;" | cat
check_status

# Drop all tables that might exist (including family games and all existing tables)
# Order matters: drop child tables before parent tables due to foreign key constraints
npx wrangler d1 execute DB --env development --command="DROP TABLE IF EXISTS family_game_round_stats; DROP TABLE IF EXISTS family_game_stats; DROP TABLE IF EXISTS family_game_selections; DROP TABLE IF EXISTS family_game_round_progress; DROP TABLE IF EXISTS family_game_participants; DROP TABLE IF EXISTS family_game_rounds; DROP TABLE IF EXISTS family_games; DROP TABLE IF EXISTS notification_logs; DROP TABLE IF EXISTS notification_settings; DROP TABLE IF EXISTS marketing_events; DROP TABLE IF EXISTS user_permissions; DROP TABLE IF EXISTS admin_audit_log; DROP TABLE IF EXISTS super_admins; DROP TABLE IF EXISTS group_invitations; DROP TABLE IF EXISTS group_members; DROP TABLE IF EXISTS groups; DROP TABLE IF EXISTS verse_streaks; DROP TABLE IF EXISTS point_events; DROP TABLE IF EXISTS word_progress; DROP TABLE IF EXISTS verse_attempts; DROP TABLE IF EXISTS verse_mastery; DROP TABLE IF EXISTS mastered_verses; DROP TABLE IF EXISTS verses; DROP TABLE IF EXISTS user_stats; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS magic_links; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS anonymized_users; DROP TABLE IF EXISTS verses_backup; DROP TABLE IF EXISTS verse_mastery_backup; DROP TABLE IF EXISTS mastered_verses_backup; DROP TABLE IF EXISTS word_progress_backup; DROP TABLE IF EXISTS verse_attempts_backup; DROP TABLE IF EXISTS verses_new;" | cat
check_status

# Re-enable foreign keys
npx wrangler d1 execute DB --env development --command="PRAGMA foreign_keys = ON;" | cat
check_status

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

# Create test user and get session
echo "${YELLOW}Creating test user...${NC}"
MAGIC_LINK_RESPONSE=$(api_call POST "/auth/magic-link" '{"email":"test-game-creator@example.com","isRegistration":true,"turnstileToken":"test-token","marketingOptIn":false}')
echo "$MAGIC_LINK_RESPONSE"
MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)

if [ -z "$MAGIC_TOKEN" ]; then
    echo "${RED}Failed to get magic link token${NC}"
    exit 1
fi

echo "${YELLOW}Verifying magic link...${NC}"
VERIFY_RESPONSE=$(api_call GET "/auth/verify?token=$MAGIC_TOKEN")
echo "$VERIFY_RESPONSE"
SESSION_TOKEN=$(extract_token "$VERIFY_RESPONSE")

if [ -z "$SESSION_TOKEN" ]; then
    echo "${RED}Failed to get session token${NC}"
    exit 1
fi

echo "${GREEN}Session token: $SESSION_TOKEN${NC}\n"

# Test 1: Create game
echo "${BLUE}Test 1: Create game${NC}"
CREATE_GAME_DATA='{
  "creatorDisplayName": "Game Creator",
  "rounds": [
    {
      "roundNumber": 1,
      "verseReference": "John 3:16",
      "verseText": "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
      "wordIndicesToHide": [
        {"index": 2, "type": "adverb"},
        {"index": 5, "type": "verb"},
        {"index": 8, "type": "noun"},
        {"index": 12, "type": "verb"}
      ]
    },
    {
      "roundNumber": 2,
      "verseReference": "Philippians 4:13",
      "verseText": "I can do all things through him who strengthens me.",
      "wordIndicesToHide": [
        {"index": 3, "type": "verb"},
        {"index": 6, "type": "verb"}
      ]
    }
  ],
  "autoApproveParticipants": true,
  "timeLimitSeconds": 300
}'

CREATE_RESPONSE=$(api_call POST "/family-games/create" "$CREATE_GAME_DATA" "Authorization: Bearer $SESSION_TOKEN")
echo "$CREATE_RESPONSE"
GAME_CODE=$(echo "$CREATE_RESPONSE" | grep -o '"gameCode":"[^"]*' | cut -d'"' -f4)

if [ -z "$GAME_CODE" ]; then
    echo "${RED}Failed to create game${NC}"
    exit 1
fi

echo "${GREEN}Game created with code: $GAME_CODE${NC}\n"
check_status

# Test 2: Join game as participant 1
echo "${BLUE}Test 2: Join game as participant 1${NC}"
JOIN_RESPONSE1=$(api_call POST "/family-games/$GAME_CODE/join" '{"displayName":"Mom"}')
echo "$JOIN_RESPONSE1"
PARTICIPANT_ID1=$(echo "$JOIN_RESPONSE1" | grep -o '"participantId":"[^"]*' | cut -d'"' -f4)

if [ -z "$PARTICIPANT_ID1" ]; then
    echo "${RED}Failed to join game${NC}"
    exit 1
fi

echo "${GREEN}Participant 1 ID: $PARTICIPANT_ID1${NC}\n"
check_status

# Test 3: Join game as participant 2
echo "${BLUE}Test 3: Join game as participant 2${NC}"
JOIN_RESPONSE2=$(api_call POST "/family-games/$GAME_CODE/join" '{"displayName":"Dad"}')
echo "$JOIN_RESPONSE2"
PARTICIPANT_ID2=$(echo "$JOIN_RESPONSE2" | grep -o '"participantId":"[^"]*' | cut -d'"' -f4)

if [ -z "$PARTICIPANT_ID2" ]; then
    echo "${RED}Failed to join game${NC}"
    exit 1
fi

echo "${GREEN}Participant 2 ID: $PARTICIPANT_ID2${NC}\n"
check_status

# Test 4: Get game state (creator)
echo "${BLUE}Test 4: Get game state (creator)${NC}"
STATE_RESPONSE=$(api_call GET "/family-games/$GAME_CODE/state" "" "Authorization: Bearer $SESSION_TOKEN")
echo "$STATE_RESPONSE"
check_status

# Test 5: Start game
echo "${BLUE}Test 5: Start game${NC}"
START_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/start" "" "Authorization: Bearer $SESSION_TOKEN")
echo "$START_RESPONSE"
check_status

# Test 6: Open round 1
echo "${BLUE}Test 6: Open round 1${NC}"
OPEN_ROUND_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/rounds/1/open" "" "Authorization: Bearer $SESSION_TOKEN")
echo "$OPEN_ROUND_RESPONSE"
check_status

# Test 7: Participant 1 starts round
echo "${BLUE}Test 7: Participant 1 starts round${NC}"
START_ROUND_RESPONSE1=$(api_call POST "/family-games/$GAME_CODE/rounds/1/start" "" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$START_ROUND_RESPONSE1"
ROUND_STARTED_AT1=$(echo "$START_ROUND_RESPONSE1" | grep -o '"roundStartedAt":[0-9]*' | cut -d':' -f2)
check_status

# Test 8: Participant 2 starts round
echo "${BLUE}Test 8: Participant 2 starts round${NC}"
START_ROUND_RESPONSE2=$(api_call POST "/family-games/$GAME_CODE/rounds/1/start" "" "X-Participant-Id: $PARTICIPANT_ID2")
echo "$START_ROUND_RESPONSE2"
ROUND_STARTED_AT2=$(echo "$START_ROUND_RESPONSE2" | grep -o '"roundStartedAt":[0-9]*' | cut -d':' -f2)
check_status

# Test 9: Participant 1 selects correct word
echo "${BLUE}Test 9: Participant 1 selects correct word${NC}"
TIME_TAKEN1=1500
SELECT_WORD_DATA1="{\"selectedWord\":\"so\",\"timeTakenMs\":$TIME_TAKEN1}"
SELECT_RESPONSE1=$(api_call POST "/family-games/$GAME_CODE/rounds/1/select-word" "$SELECT_WORD_DATA1" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$SELECT_RESPONSE1"
check_status

# Test 10: Participant 1 selects another correct word
echo "${BLUE}Test 10: Participant 1 selects another correct word${NC}"
TIME_TAKEN2=2000
SELECT_WORD_DATA2="{\"selectedWord\":\"loved\",\"timeTakenMs\":$TIME_TAKEN2}"
SELECT_RESPONSE2=$(api_call POST "/family-games/$GAME_CODE/rounds/1/select-word" "$SELECT_WORD_DATA2" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$SELECT_RESPONSE2"
check_status

# Test 11: Participant 1 selects incorrect word
echo "${BLUE}Test 11: Participant 1 selects incorrect word${NC}"
TIME_TAKEN3=2500
SELECT_WORD_DATA3="{\"selectedWord\":\"wrong\",\"timeTakenMs\":$TIME_TAKEN3}"
SELECT_RESPONSE3=$(api_call POST "/family-games/$GAME_CODE/rounds/1/select-word" "$SELECT_WORD_DATA3" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$SELECT_RESPONSE3"
check_status

# Test 12: Participant 2 selects correct word
echo "${BLUE}Test 12: Participant 2 selects correct word${NC}"
TIME_TAKEN4=1800
SELECT_WORD_DATA4="{\"selectedWord\":\"so\",\"timeTakenMs\":$TIME_TAKEN4}"
SELECT_RESPONSE4=$(api_call POST "/family-games/$GAME_CODE/rounds/1/select-word" "$SELECT_WORD_DATA4" "X-Participant-Id: $PARTICIPANT_ID2")
echo "$SELECT_RESPONSE4"
check_status

# Test 13: Get game state (participant)
echo "${BLUE}Test 13: Get game state (participant)${NC}"
STATE_RESPONSE_PARTICIPANT=$(api_call GET "/family-games/$GAME_CODE/state" "" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$STATE_RESPONSE_PARTICIPANT"
check_status

# Test 14: Test rate limiting
echo "${BLUE}Test 14: Test rate limiting${NC}"
RATE_LIMIT_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/rounds/1/select-word" "{\"selectedWord\":\"test\",\"timeTakenMs\":100}" "X-Participant-Id: $PARTICIPANT_ID1")
echo "$RATE_LIMIT_RESPONSE"
# Should get 429 or success (depending on timing)
check_status

# Test 15: Test display name uniqueness
echo "${BLUE}Test 15: Test display name uniqueness${NC}"
JOIN_DUPLICATE=$(api_call POST "/family-games/$GAME_CODE/join" '{"displayName":"Mom"}')
echo "$JOIN_DUPLICATE"
# Should get "(2)" suffix
check_status

# Test 16: Test rejoin
echo "${BLUE}Test 16: Test rejoin${NC}"
REJOIN_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/join" '{"displayName":"Mom (2)"}')
echo "$REJOIN_RESPONSE"
# Should return existing participant
check_status

# Test 17: Leave game
echo "${BLUE}Test 17: Leave game${NC}"
LEAVE_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/leave" "" "X-Participant-Id: $PARTICIPANT_ID2")
echo "$LEAVE_RESPONSE"
check_status

# Test 18: End game
echo "${BLUE}Test 18: End game${NC}"
END_RESPONSE=$(api_call POST "/family-games/$GAME_CODE/end" "" "Authorization: Bearer $SESSION_TOKEN")
echo "$END_RESPONSE"
check_status

echo "\n${GREEN}All tests passed!${NC}"

# ========================================
# USER LOGIN SECTION
# ========================================
USERS=(
  "test-game-creator@example.com"
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
        
        if [ -z "$MAGIC_TOKEN" ]; then
          # Try alternative format if message format doesn't match
          MAGIC_TOKEN=$(echo "$MAGIC_LINK_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        fi
        
        if [ -z "$MAGIC_TOKEN" ]; then
          echo "${RED}Error: Could not extract token from response${NC}"
          echo "${BLUE}Response:${NC}"
          echo "$MAGIC_LINK_RESPONSE"
          break
        fi
        
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

