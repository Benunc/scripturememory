#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${YELLOW}========================================${NC}"
echo "${YELLOW}ASSIGNING SILLY DISPLAY NAMES TO USERS${NC}"
echo "${YELLOW}========================================${NC}"

echo "${BLUE}Running silly names migration on production...${NC}"

# Run the migration on production
RESULT=$(npx wrangler d1 execute DB --env production --file=migrations/0015_assign_silly_display_names.sql)

echo "${BLUE}Migration result:${NC}"
echo "$RESULT"

# Check if successful
if echo "$RESULT" | grep -q "error"; then
    echo "${RED}✗ Migration failed${NC}"
    echo "${RED}Full result: $RESULT${NC}"
    exit 1
else
    echo "${GREEN}✓ Migration completed successfully!${NC}"
fi

echo "${GREEN}Operation completed!${NC}" 