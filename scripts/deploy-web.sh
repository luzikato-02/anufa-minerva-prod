#!/bin/bash

#====================================================================
# Anufa Minerva - Web Deployment Script for cPanel
#====================================================================
# This script prepares the Laravel + React application for deployment
# to a cPanel hosting environment.
#
# Usage: ./scripts/deploy-web.sh [options]
#
# Options:
#   --env=production    Set environment (default: production)
#   --output=NAME       Output filename (default: deploy-YYYY-MM-DD.zip)
#   --no-vendor         Skip vendor folder (install on server)
#   --no-node-modules   Skip node_modules (build locally)
#   --help              Show this help message
#====================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENV="production"
OUTPUT_NAME="deploy-$(date +%Y-%m-%d)"
INCLUDE_VENDOR=true
INCLUDE_NODE_MODULES=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build-deploy"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --env=*)
            ENV="${arg#*=}"
            shift
            ;;
        --output=*)
            OUTPUT_NAME="${arg#*=}"
            shift
            ;;
        --no-vendor)
            INCLUDE_VENDOR=false
            shift
            ;;
        --no-node-modules)
            INCLUDE_NODE_MODULES=false
            shift
            ;;
        --help)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *)
            ;;
    esac
done

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Anufa Minerva - Web Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command -v php &> /dev/null; then
    print_error "PHP is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

if ! command -v composer &> /dev/null; then
    print_warning "Composer not found. Vendor folder must be included or installed on server."
fi

if ! command -v zip &> /dev/null; then
    print_error "zip is not installed"
    exit 1
fi

print_status "Prerequisites check passed"

# Navigate to project root
cd "$PROJECT_ROOT"

# Clean previous build
if [ -d "$BUILD_DIR" ]; then
    print_info "Cleaning previous build..."
    rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR"

# Step 1: Install dependencies
print_info "Installing npm dependencies..."
npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
print_status "npm dependencies installed"

# Step 2: Build frontend assets
print_info "Building frontend assets for production..."
npm run build
print_status "Frontend assets built"

# Step 3: Install composer dependencies (if including vendor)
if [ "$INCLUDE_VENDOR" = true ] && command -v composer &> /dev/null; then
    print_info "Installing composer dependencies (production)..."
    composer install --no-dev --optimize-autoloader --no-interaction
    print_status "Composer dependencies installed"
fi

# Step 4: Create deployment structure
print_info "Creating deployment structure..."

# Create directories
mkdir -p "$BUILD_DIR/public_html"
mkdir -p "$BUILD_DIR/laravel"

# Copy Laravel application files to laravel folder (one level above public_html)
LARAVEL_DIRS=(
    "app"
    "bootstrap"
    "config"
    "database"
    "resources"
    "routes"
    "storage"
)

for dir in "${LARAVEL_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        cp -r "$dir" "$BUILD_DIR/laravel/"
    fi
done

# Copy required files
LARAVEL_FILES=(
    "artisan"
    "composer.json"
    "composer.lock"
    ".env.example"
)

for file in "${LARAVEL_FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BUILD_DIR/laravel/"
    fi
done

# Copy vendor if included
if [ "$INCLUDE_VENDOR" = true ] && [ -d "vendor" ]; then
    print_info "Copying vendor folder..."
    cp -r vendor "$BUILD_DIR/laravel/"
    print_status "Vendor folder copied"
fi

# Step 5: Copy public files
print_info "Copying public files..."
cp -r public/* "$BUILD_DIR/public_html/"

# Copy built assets
if [ -d "public/build" ]; then
    cp -r public/build "$BUILD_DIR/public_html/"
    print_status "Built assets copied"
fi

# Step 6: Create modified index.php for cPanel structure
print_info "Creating cPanel-compatible index.php..."

cat > "$BUILD_DIR/public_html/index.php" << 'INDEXPHP'
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../laravel/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../laravel/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
(require_once __DIR__.'/../laravel/bootstrap/app.php')
    ->handleRequest(Request::capture());
INDEXPHP

print_status "index.php created for cPanel"

# Step 7: Create .htaccess for public_html
print_info "Creating .htaccess..."

cat > "$BUILD_DIR/public_html/.htaccess" << 'HTACCESS'
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
HTACCESS

print_status ".htaccess created"

# Step 8: Create storage directory structure with proper permissions
print_info "Setting up storage directories..."

mkdir -p "$BUILD_DIR/laravel/storage/app/public"
mkdir -p "$BUILD_DIR/laravel/storage/framework/cache/data"
mkdir -p "$BUILD_DIR/laravel/storage/framework/sessions"
mkdir -p "$BUILD_DIR/laravel/storage/framework/views"
mkdir -p "$BUILD_DIR/laravel/storage/logs"

# Create .gitignore files to preserve directory structure
for dir in "$BUILD_DIR/laravel/storage/app/public" \
           "$BUILD_DIR/laravel/storage/framework/cache/data" \
           "$BUILD_DIR/laravel/storage/framework/sessions" \
           "$BUILD_DIR/laravel/storage/framework/views" \
           "$BUILD_DIR/laravel/storage/logs"; do
    echo "*" > "$dir/.gitignore"
    echo "!.gitignore" >> "$dir/.gitignore"
done

print_status "Storage directories created"

# Step 9: Create bootstrap cache directory
mkdir -p "$BUILD_DIR/laravel/bootstrap/cache"
echo "*" > "$BUILD_DIR/laravel/bootstrap/cache/.gitignore"
echo "!.gitignore" >> "$BUILD_DIR/laravel/bootstrap/cache/.gitignore"

# Step 10: Create deployment README
print_info "Creating deployment README..."

cat > "$BUILD_DIR/README-DEPLOYMENT.md" << 'README'
# Anufa Minerva - cPanel Deployment Guide

## Directory Structure

```
your-cpanel-account/
├── public_html/          # Upload contents of public_html folder here
│   ├── index.php
│   ├── .htaccess
│   ├── build/           # Compiled frontend assets
│   └── ...
└── laravel/             # Upload contents of laravel folder here (one level above public_html)
    ├── app/
    ├── bootstrap/
    ├── config/
    ├── database/
    ├── resources/
    ├── routes/
    ├── storage/
    ├── vendor/
    ├── artisan
    └── ...
```

## Deployment Steps

### 1. Upload Files
1. Extract the zip file
2. Upload contents of `public_html/` to your cPanel's `public_html/` directory
3. Upload contents of `laravel/` to a new folder called `laravel/` one level above public_html

### 2. Configure Environment
1. Copy `.env.example` to `.env` in the laravel folder
2. Edit `.env` with your database and app settings:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://your-domain.com
   
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=your_database
   DB_USERNAME=your_username
   DB_PASSWORD=your_password
   ```

### 3. Install Dependencies (if vendor not included)
If you didn't include the vendor folder, SSH into your server and run:
```bash
cd ~/laravel
composer install --no-dev --optimize-autoloader
```

### 4. Generate App Key
```bash
cd ~/laravel
php artisan key:generate
```

### 5. Run Migrations
```bash
php artisan migrate --force
```

### 6. Create Storage Link
You need to create a symbolic link from public_html to storage:
```bash
cd ~/public_html
ln -s ../laravel/storage/app/public storage
```

Or run from laravel folder:
```bash
php artisan storage:link
```

### 7. Set Permissions
```bash
chmod -R 755 ~/laravel/storage
chmod -R 755 ~/laravel/bootstrap/cache
```

### 8. Cache Configuration (Optional, for production)
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Troubleshooting

### 500 Internal Server Error
- Check storage and bootstrap/cache permissions
- Verify .env file exists and is properly configured
- Check PHP version (requires PHP 8.2+)

### CSS/JS Not Loading
- Ensure build folder was uploaded to public_html
- Check that paths in .htaccess are correct

### Database Connection Issues
- Verify database credentials in .env
- Check if database exists
- Ensure database user has proper permissions

## Support
For issues, please check the project documentation or create an issue on GitHub.
README

print_status "Deployment README created"

# Step 11: Create post-deployment script
print_info "Creating post-deployment script..."

cat > "$BUILD_DIR/post-deploy.sh" << 'POSTDEPLOY'
#!/bin/bash

# Post-deployment script for cPanel
# Run this via SSH after uploading files

set -e

LARAVEL_DIR=~/laravel

cd $LARAVEL_DIR

echo "Generating application key..."
php artisan key:generate --force

echo "Running database migrations..."
php artisan migrate --force

echo "Caching configuration..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Creating storage link..."
php artisan storage:link || true

echo "Setting permissions..."
chmod -R 755 storage
chmod -R 755 bootstrap/cache

echo "Deployment complete!"
POSTDEPLOY

chmod +x "$BUILD_DIR/post-deploy.sh"
print_status "Post-deployment script created"

# Step 12: Create the zip file
print_info "Creating deployment zip file..."

cd "$BUILD_DIR"
zip -r "../$OUTPUT_NAME.zip" . -x "*.DS_Store" -x "__MACOSX/*"

cd "$PROJECT_ROOT"

# Clean up build directory
rm -rf "$BUILD_DIR"

# Final output
ZIP_SIZE=$(du -h "$OUTPUT_NAME.zip" | cut -f1)

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Deployment Package Created!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "  ${BLUE}File:${NC} $OUTPUT_NAME.zip"
echo -e "  ${BLUE}Size:${NC} $ZIP_SIZE"
echo -e "  ${BLUE}Environment:${NC} $ENV"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "  1. Upload to cPanel File Manager"
echo "  2. Extract the zip file"
echo "  3. Follow README-DEPLOYMENT.md instructions"
echo ""
print_status "Deployment package ready!"
