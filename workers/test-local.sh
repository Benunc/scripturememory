#!/bin/zsh

# Test script for local development of Scripture Memory API
# Usage: ./test-local.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${BLUE}Scripture Memory API Local Test Script${NC}\n"

# 0. Run Migrations (if needed)
echo "${GREEN}0. Run Database Migrations${NC}"
echo "npx wrangler d1 execute DB --env development --file=./migrations/0000_initial_schema.sql"
echo "npx wrangler d1 execute DB --env development --file=./migrations/0001_add_progress_tables.sql"
echo "npx wrangler d1 execute DB --env development --file=./migrations/0002_add_gamification_tables.sql"
echo "npx wrangler d1 execute DB --env development --file=./migrations/0003_add_unique_constraint_to_verses_reference.sql"
echo "\nRun these commands if you get 'no such table' errors\n"

# 1. Request Magic Link
echo "${GREEN}1. Request Magic Link${NC}"
echo "curl -X POST http://localhost:8787/auth/magic-link \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Origin: http://localhost:8787\" \\"
echo "  -d '{\"email\":\"test@example.com\",\"isRegistration\":false,\"turnstileToken\":\"test-token\"}'"
echo "\nCheck Wrangler dev server output for the magic link token\n"

# 2. Verify Magic Link (Login)
echo "${GREEN}2. Verify Magic Link (Login)${NC}"
echo "curl -i \"http://localhost:8787/auth/verify?token=YOUR_TOKEN_HERE\""
echo "\nSave the session token from the response\n"

# 3. Add a Verse
echo "${GREEN}3. Add a Verse${NC}"
echo "curl -X POST http://localhost:8787/verses \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\" \\"
echo "  -d '{\"reference\":\"John 3:16\",\"text\":\"For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.\",\"translation\":\"NIV\",\"status\":\"not_started\"}'"
echo "\nExpected: 201 Created response\n"

# 4. Get All Verses
echo "${GREEN}4. Get All Verses${NC}"
echo "curl -X GET http://localhost:8787/verses \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\""
echo "\nExpected: JSON array of verses\n"

# 5. Record Verse Progress
echo "${GREEN}5. Record Verse Progress${NC}"
echo "curl -X POST http://localhost:8787/progress/verse \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\" \\"
echo "  -d '{\"verse_reference\":\"John 3:16\",\"words_correct\":10,\"total_words\":10}'"
echo "\nExpected: 200 OK response\n"

# 6. Get User Stats
echo "${GREEN}6. Get User Stats${NC}"
echo "curl -X GET http://localhost:8787/gamification/stats \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\""
echo "\nExpected: JSON with user stats including points and streaks\n"

# 7. Record Point Event
echo "${GREEN}7. Record Point Event${NC}"
echo "curl -X POST http://localhost:8787/gamification/points \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\" \\"
echo "  -d '{\"event_type\":\"verse_mastered\",\"points\":10,\"metadata\":{\"verse_reference\":\"John 3:16\"}}'"
echo "\nExpected: 200 OK response\n"

# 8. Delete User
echo "\n${GREEN}8. Delete User${NC}"
echo "curl -X DELETE http://localhost:8787/auth/delete \\"
echo "  -H \"Authorization: Bearer YOUR_SESSION_TOKEN\""
echo "Expected: 204 No Content"
echo "Note: This will delete the user and all associated data"

echo "\n${YELLOW}Remember to:${NC}"
echo "1. Start the Wrangler dev server: npx wrangler dev --env development"
echo "2. Run migrations if needed (commands at top of script)"
echo "3. Copy each command and replace YOUR_SESSION_TOKEN with the actual token"
echo "4. Run commands in order"
echo "5. Check responses match expected results"

# TODO: Add more test commands as we implement them
# - Test gamification endpoints
# - Test progress tracking
# - Test verse retrieval
# - Test verse updates
# - Test verse deletion 