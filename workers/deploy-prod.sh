#!/bin/bash

# Exit on any error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production deployment process...${NC}"

# Check if we're in the workers directory
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}Error: Please run this script from the workers directory${NC}"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

# List pending migrations
echo -e "\n${YELLOW}Checking pending migrations...${NC}"
npx wrangler d1 migrations list scripture-memory --env production

# Confirm before proceeding
echo -e "\n${YELLOW}WARNING: This will deploy changes to production.${NC}"
echo -e "Please review the pending migrations above."
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 1
fi

# Apply migrations
echo -e "\n${YELLOW}Applying migrations...${NC}"
npx wrangler d1 migrations apply scripture-memory --env production

# Verify migrations were applied
echo -e "\n${YELLOW}Verifying migrations...${NC}"
npx wrangler d1 migrations list scripture-memory --env production

# Deploy worker
echo -e "\n${YELLOW}Deploying worker...${NC}"
npx wrangler deploy --env production

echo -e "\n${GREEN}Production deployment completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the worker is functioning correctly"
echo "2. Push your frontend changes to main to trigger Pages deployment"
echo "3. Test the complete application in production" 