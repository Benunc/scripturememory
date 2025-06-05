#!/bin/bash

# Exit on error
set -e

# Function to check command status
check_status() {
  if [ $? -ne 0 ]; then
    echo "Command failed with status $?"
    exit 1
  fi
}

# Create a test user
echo "Creating test user..."
RESPONSE=$(curl -s -X POST http://localhost:8787/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test-delete@example.com","isRegistration":true,"turnstileToken":"test-token"}')
check_status

# Extract magic link token
MAGIC_TOKEN=$(echo $RESPONSE | grep -o 'token=[^"]*' | cut -d'=' -f2)
echo "Magic token: $MAGIC_TOKEN"

# Verify magic link
echo "Verifying magic link..."
RESPONSE=$(curl -s -X GET "http://localhost:8787/auth/verify?token=$MAGIC_TOKEN")
check_status

# Extract session token
SESSION_TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Session token: $SESSION_TOKEN"

# Add a test verse
echo "Adding test verse..."
RESPONSE=$(curl -s -X POST http://localhost:8787/verses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"reference":"John 3:16","text":"For God so loved the world...","translation":"NIV"}')
check_status

# Verify verse was added
echo "Verifying verse was added..."
RESPONSE=$(curl -s -X GET http://localhost:8787/verses \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

# Delete the user
echo "Deleting user..."
RESPONSE=$(curl -s -X DELETE http://localhost:8787/auth/delete \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

# Verify user was deleted by trying to get verses
echo "Verifying user was deleted..."
RESPONSE=$(curl -s -X GET http://localhost:8787/verses \
  -H "Authorization: Bearer $SESSION_TOKEN")
check_status

# Check if we get a 401 (unauthorized) response
if [[ $RESPONSE == *"Invalid or expired session"* ]]; then
  echo "✅ Test passed: User was successfully deleted"
else
  echo "❌ Test failed: User deletion verification failed"
  exit 1
fi 