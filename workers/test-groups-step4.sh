#!/bin/bash

# Test Step 4: Group Leaderboards
echo "Testing Step 4: Group Leaderboards"

# Create test users
echo "Creating test users..."
MAGIC_LINK_RESPONSE1=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test1@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN1=$(echo "$MAGIC_LINK_RESPONSE1" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE1=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN1")
SESSION_TOKEN1=$(echo "$VERIFY_RESPONSE1" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE2=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test2@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN2=$(echo "$MAGIC_LINK_RESPONSE2" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE2=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN2")
SESSION_TOKEN2=$(echo "$VERIFY_RESPONSE2" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

MAGIC_LINK_RESPONSE3=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"leaderboard-test3@example.com","isRegistration":true,"turnstileToken":"test-token"}')

MAGIC_TOKEN3=$(echo "$MAGIC_LINK_RESPONSE3" | grep -o '"message":"token=[^"]*' | cut -d'=' -f2 | cut -d'"' -f1)
VERIFY_RESPONSE3=$(curl -s -i "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN3")
SESSION_TOKEN3=$(echo "$VERIFY_RESPONSE3" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Create group
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8787/groups/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"name":"Leaderboard Test Group","description":"Testing leaderboards"}')

GROUP_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)

# Get user IDs
USER_ID1=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test1@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
USER_ID2=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test2@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')
USER_ID3=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM users WHERE email = 'leaderboard-test3@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

echo "Debug - GROUP_ID: $GROUP_ID"
echo "Debug - USER_ID1: $USER_ID1"
echo "Debug - USER_ID2: $USER_ID2"
echo "Debug - USER_ID3: $USER_ID3"

# Invite and add members
echo "Inviting members to group..."

# Invite user 2
INVITE_RESPONSE2=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"leaderboard-test2@example.com"}')

INVITATION_ID2=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'leaderboard-test2@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

JOIN_RESPONSE2=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d "{\"invitationId\":$INVITATION_ID2}")

# Invite user 3
INVITE_RESPONSE3=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"email":"leaderboard-test3@example.com"}')

INVITATION_ID3=$(npx wrangler d1 execute DB --env development --command="SELECT id FROM group_invitations WHERE group_id = $GROUP_ID AND email = 'leaderboard-test3@example.com';" | cat | sed -n 's/.*"id": \([0-9]*\).*/\1/p')

JOIN_RESPONSE3=$(curl -s -X POST http://localhost:8787/groups/$GROUP_ID/join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d "{\"invitationId\":$INVITATION_ID3}")

# Set display names
echo "Setting display names..."
UPDATE_NAME1_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID1/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"displayName":"Top Performer"}')

UPDATE_NAME2_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID2/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"displayName":"Second Place"}')

UPDATE_NAME3_RESPONSE=$(curl -s -X PUT http://localhost:8787/groups/$GROUP_ID/members/$USER_ID3/display-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d '{"displayName":"Third Place"}')

# Add some points to create a leaderboard
echo "Adding points to create leaderboard..."
POINTS_RESPONSE1=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN1" \
  -d '{"event_type":"verse_added","points":1000}')

POINTS_RESPONSE2=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN2" \
  -d '{"event_type":"verse_added","points":800}')

POINTS_RESPONSE3=$(curl -s -X POST http://localhost:8787/gamification/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN3" \
  -d '{"event_type":"verse_added","points":600}')

# Test 1: Get leaderboard
echo "Testing get leaderboard..."
LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=points" \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Leaderboard response: $LEADERBOARD_RESPONSE"

if echo "$LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "✓ Get leaderboard test passed"
else
    echo "✗ Get leaderboard test failed"
    exit 1
fi

# Test 2: Get group stats
echo "Testing get group stats..."
STATS_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/stats \
  -H "Authorization: Bearer $SESSION_TOKEN1")

echo "Stats response: $STATS_RESPONSE"

if echo "$STATS_RESPONSE" | grep -q '"total_members"'; then
    echo "✓ Get group stats test passed"
else
    echo "✗ Get group stats test failed"
    exit 1
fi

# Test 3: Get member ranking
echo "Testing get member ranking..."
RANKING_RESPONSE=$(curl -s -X GET http://localhost:8787/groups/$GROUP_ID/members/$USER_ID2/ranking \
  -H "Authorization: Bearer $SESSION_TOKEN2")

echo "Ranking response: $RANKING_RESPONSE"

if echo "$RANKING_RESPONSE" | grep -q '"rank"'; then
    echo "✓ Get member ranking test passed"
else
    echo "✗ Get member ranking test failed"
    exit 1
fi

# Test 4: Test different metrics
echo "Testing different metrics..."
STREAK_LEADERBOARD_RESPONSE=$(curl -s -X GET "http://localhost:8787/groups/$GROUP_ID/leaderboard?metric=current_streak" \
  -H "Authorization: Bearer $SESSION_TOKEN1")

if echo "$STREAK_LEADERBOARD_RESPONSE" | grep -q '"rank":1'; then
    echo "✓ Different metrics test passed"
else
    echo "✗ Different metrics test failed"
    exit 1
fi

echo "Step 4 completed successfully!" 