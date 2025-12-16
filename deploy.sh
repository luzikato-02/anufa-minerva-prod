#!/bin/bash

###############################################################################
# cPanel Deployment Script for Laravel Application
# This script should be executed on the cPanel server after deployment
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Laravel deployment process...${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}.env file created. Please update it with your production values.${NC}"
    else
        echo -e "${RED}Error: .env.example not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Check if APP_KEY is set
if ! grep -q "APP_KEY=base64:" .env; then
    echo -e "${YELLOW}Generating application key...${NC}"
    php artisan key:generate
fi

# Install/Update Composer dependencies (if composer is available)
if command -v composer &> /dev/null; then
    echo -e "${GREEN}Installing Composer dependencies...${NC}"
    composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev
else
    echo -e "${YELLOW}Warning: Composer not found. Skipping dependency installation.${NC}"
    echo -e "${YELLOW}Please ensure vendor directory is deployed or install composer.${NC}"
fi

# Create storage link
echo -e "${GREEN}Creating storage link...${NC}"
php artisan storage:link 2>/dev/null || echo -e "${YELLOW}Storage link already exists or failed to create.${NC}"

# Set proper permissions
echo -e "${GREEN}Setting directory permissions...${NC}"
find storage -type f -exec chmod 644 {} \;
find storage -type d -exec chmod 755 {} \;
find bootstrap/cache -type f -exec chmod 644 {} \;
find bootstrap/cache -type d -exec chmod 755 {} \;

# Clear and cache configurations
echo -e "${GREEN}Optimizing application...${NC}"
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

echo -e "${GREEN}Caching configurations...${NC}"
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run database migrations (commented out by default for safety)
# Uncomment the following lines if you want to run migrations automatically
# echo -e "${GREEN}Running database migrations...${NC}"
# php artisan migrate --force

# Clear application cache (optional)
# php artisan cache:clear

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Important: Don't forget to:${NC}"
echo -e "  1. Update your .env file with production values"
echo -e "  2. Run database migrations if needed: ${GREEN}php artisan migrate --force${NC}"
echo -e "  3. Ensure your database is properly configured"
echo -e "  4. Set up your cron jobs for Laravel scheduler (if needed)"
echo -e "  5. Configure your queue workers (if needed)"
echo ""
