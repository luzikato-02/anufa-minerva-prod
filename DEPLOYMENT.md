# cPanel Deployment Guide

This guide explains how to deploy your Laravel + React application to cPanel using CI/CD automation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Methods](#deployment-methods)
3. [Method 1: GitHub Actions + FTP](#method-1-github-actions--ftp)
4. [Method 2: cPanel Git Version Control](#method-2-cpanel-git-version-control)
5. [Post-Deployment Setup](#post-deployment-setup)
6. [Troubleshooting](#troubleshooting)
7. [Environment Configuration](#environment-configuration)

---

## Prerequisites

### Server Requirements

- PHP 8.2 or higher
- Composer
- Node.js 18+ (optional, for building on server)
- MySQL/MariaDB or SQLite
- SSH access (recommended)
- Git (for cPanel Git deployment)

### cPanel Requirements

- cPanel account with File Manager access
- FTP/SFTP credentials
- SSH access (recommended)
- Terminal access in cPanel
- Git Version Control feature (for Git deployment method)

---

## Deployment Methods

This repository supports two deployment methods:

### Method 1: GitHub Actions + FTP (Recommended)
- **Pros**: Fully automated, builds happen in GitHub, no server dependencies needed
- **Cons**: Requires FTP credentials

### Method 2: cPanel Git Version Control
- **Pros**: Direct integration with cPanel, uses cPanel's native Git feature
- **Cons**: Requires Node.js and Composer on server, manual trigger

---

## Method 1: GitHub Actions + FTP

This method uses GitHub Actions to build your application and deploy it via FTP.

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CPANEL_FTP_SERVER` | Your cPanel FTP hostname | `ftp.yourdomain.com` |
| `CPANEL_FTP_USERNAME` | Your FTP username | `username@yourdomain.com` |
| `CPANEL_FTP_PASSWORD` | Your FTP password | `your_ftp_password` |
| `CPANEL_DEPLOY_PATH` | Path to deploy directory | `/public_html/` or `/home/username/public_html/` |
| `CPANEL_SSH_HOST` | Your cPanel SSH hostname | `yourdomain.com` or IP address |
| `CPANEL_SSH_USERNAME` | Your SSH username | `username` |
| `CPANEL_SSH_PASSWORD` | Your SSH password | `your_ssh_password` |
| `CPANEL_SSH_PORT` | SSH port (optional) | `22` (default) |

### Step 2: GitHub Actions Workflow

The workflow is already configured in `.github/workflows/main.yml`. It will:

1. ✅ Run tests to ensure code quality
2. 📦 Install PHP dependencies (production only)
3. 🎨 Build frontend assets with Vite
4. 📤 Deploy to cPanel via FTP
5. 🔧 Run optimization commands via SSH

### Step 3: Trigger Deployment

Deployment triggers automatically when you push to the `main` branch:

```bash
git push origin main
```

You can also manually trigger deployment from GitHub Actions tab → Deploy to cPanel → Run workflow.

### Step 4: Monitor Deployment

1. Go to your repository on GitHub
2. Click on "Actions" tab
3. Click on the latest workflow run
4. Monitor the deployment progress

---

## Method 2: cPanel Git Version Control

This method uses cPanel's native Git Version Control feature.

### Step 1: Enable Git Version Control in cPanel

1. Log in to your cPanel account
2. Navigate to **Git™ Version Control**
3. Click **Create** button

### Step 2: Configure Git Repository

Fill in the repository details:

- **Clone URL**: Your GitHub repository URL (use HTTPS)
  ```
  https://github.com/yourusername/yourrepo.git
  ```
- **Repository Path**: Where to clone (e.g., `/home/username/repositories/yourapp`)
- **Repository Name**: Give it a name (e.g., `my-laravel-app`)

### Step 3: Set Up GitHub Token (if private repo)

If your repository is private:

1. Generate a Personal Access Token on GitHub:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` scope
2. Use this format for Clone URL:
   ```
   https://YOUR_TOKEN@github.com/yourusername/yourrepo.git
   ```

### Step 4: Configure Deployment Path

After creating the repository:

1. Click **Manage** next to your repository
2. Set **Deployment Path**: `/home/username/public_html` (or your desired path)
3. The `.cpanel.yml` file will handle automatic deployment tasks

### Step 5: Deploy

Click **Update/Pull** button in cPanel Git Version Control to deploy:

1. Navigate to Git™ Version Control
2. Click **Manage** next to your repository
3. Click **Update** or **Pull** button
4. cPanel will execute the tasks defined in `.cpanel.yml`

### Important Notes for cPanel Git Method

**PHP Version Path**: The `.cpanel.yml` file uses PHP 8.4 by default. Adjust the path if needed:

```yaml
# For PHP 8.2
- /opt/cpanel/ea-php82/root/usr/bin/php artisan migrate

# For PHP 8.3
- /opt/cpanel/ea-php83/root/usr/bin/php artisan migrate

# For PHP 8.4
- /opt/cpanel/ea-php84/root/usr/bin/php artisan migrate
```

Check available PHP versions in cPanel → MultiPHP Manager.

---

## Post-Deployment Setup

### 1. Configure .env File

After first deployment, configure your environment variables:

**Via cPanel File Manager:**
1. Navigate to your deployment directory
2. Edit `.env` file
3. Update these critical values:

```env
APP_NAME="Your App Name"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=your_database_user
DB_PASSWORD=your_database_password

# Mail Configuration (if using email)
MAIL_MAILER=smtp
MAIL_HOST=smtp.yourdomain.com
MAIL_PORT=587
MAIL_USERNAME=your_email@yourdomain.com
MAIL_PASSWORD=your_email_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@yourdomain.com
MAIL_FROM_NAME="${APP_NAME}"
```

**Via SSH:**
```bash
cd /home/username/public_html
nano .env
```

### 2. Create Database

1. In cPanel, go to **MySQL® Databases**
2. Create a new database
3. Create a database user
4. Grant all privileges to the user
5. Update `.env` with database credentials

### 3. Run Database Migrations

**Via SSH:**
```bash
cd /home/username/public_html
php artisan migrate --force
```

**Via cPanel Terminal:**
```bash
cd ~/public_html
/opt/cpanel/ea-php84/root/usr/bin/php artisan migrate --force
```

### 4. Set Up Document Root

Your Laravel application's public directory should be the document root:

1. In cPanel, go to **Domains** → **Domains**
2. Click **Manage** next to your domain
3. Update **Document Root** to: `/home/username/public_html/public`
4. Save changes

### 5. Configure .htaccess (if needed)

Ensure `/public/.htaccess` exists with proper Laravel routing rules:

```apache
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
```

### 6. Set Up Cron Jobs (Optional)

If you use Laravel's task scheduler:

1. In cPanel, go to **Cron Jobs**
2. Add a new cron job:
   - **Minute**: `*`
   - **Hour**: `*`
   - **Day**: `*`
   - **Month**: `*`
   - **Weekday**: `*`
   - **Command**: `/opt/cpanel/ea-php84/root/usr/bin/php /home/username/public_html/artisan schedule:run >> /dev/null 2>&1`

### 7. Set Up Queue Workers (Optional)

If you use queues, set up Supervisor or a cron job:

**Cron approach** (runs every minute):
```bash
* * * * * /opt/cpanel/ea-php84/root/usr/bin/php /home/username/public_html/artisan queue:work --stop-when-empty
```

---

## Troubleshooting

### Issue: 500 Internal Server Error

**Solutions:**

1. **Check file permissions:**
   ```bash
   chmod -R 755 storage bootstrap/cache
   find storage -type f -exec chmod 644 {} \;
   find storage -type d -exec chmod 755 {} \;
   ```

2. **Clear and recache:**
   ```bash
   php artisan config:clear
   php artisan cache:clear
   php artisan config:cache
   ```

3. **Check logs:**
   ```bash
   tail -f storage/logs/laravel.log
   ```

4. **Enable debug mode temporarily:**
   In `.env`, set `APP_DEBUG=true` (remember to set it back to `false` after fixing)

### Issue: Assets Not Loading (404 for CSS/JS)

**Solutions:**

1. **Verify public path:**
   - Document root must point to `public` directory
   - Check in cPanel → Domains → Manage

2. **Check asset paths in .env:**
   ```env
   ASSET_URL=https://yourdomain.com
   ```

3. **Rebuild assets:**
   ```bash
   npm run build
   ```

### Issue: Database Connection Error

**Solutions:**

1. **Check database credentials in .env**
2. **Verify database exists in cPanel MySQL® Databases**
3. **Test connection:**
   ```bash
   php artisan tinker
   >>> DB::connection()->getPdo();
   ```

### Issue: Storage Link Not Working

**Solutions:**

```bash
php artisan storage:link
```

If it fails, create manually:
```bash
ln -s /home/username/public_html/storage/app/public /home/username/public_html/public/storage
```

### Issue: PHP Version Mismatch

**Solutions:**

1. Check available PHP versions: cPanel → MultiPHP Manager
2. Update `.cpanel.yml` with correct PHP path
3. Update in cPanel → Select PHP Version

### Issue: Composer/Node.js Not Found on cPanel

**Solutions:**

**For Composer:**
```bash
cd ~
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
chmod +x /usr/local/bin/composer
```

**For Node.js:**
- Contact your hosting provider
- Or use Method 1 (GitHub Actions) which builds on GitHub servers

### Issue: Permission Denied Errors

**Solutions:**

```bash
# Fix ownership (replace username with your cPanel username)
chown -R username:username /home/username/public_html

# Fix permissions
find /home/username/public_html -type f -exec chmod 644 {} \;
find /home/username/public_html -type d -exec chmod 755 {} \;
chmod -R 775 storage bootstrap/cache
```

---

## Environment Configuration

### Production Best Practices

```env
# Always in production
APP_ENV=production
APP_DEBUG=false

# Use database session driver for better reliability
SESSION_DRIVER=database

# Use database cache for shared hosting
CACHE_STORE=database

# Use database queue for simple setup
QUEUE_CONNECTION=database

# Optimize logging
LOG_CHANNEL=daily
LOG_LEVEL=error
```

### Security Checklist

- [ ] `APP_DEBUG=false` in production
- [ ] Strong `APP_KEY` generated
- [ ] Database credentials secured
- [ ] `.env` file is not accessible via web
- [ ] `storage` and `bootstrap/cache` have correct permissions
- [ ] HTTPS enabled (use cPanel AutoSSL or Let's Encrypt)
- [ ] Sensitive endpoints protected with authentication

---

## Maintenance Commands

### Clear All Caches
```bash
php artisan optimize:clear
```

### Optimize for Production
```bash
php artisan optimize
```

### View Logs
```bash
tail -100 storage/logs/laravel.log
```

### Run Migrations
```bash
php artisan migrate --force
```

### Rollback Migrations
```bash
php artisan migrate:rollback --force
```

---

## Additional Resources

- [Laravel Deployment Documentation](https://laravel.com/docs/deployment)
- [cPanel Git Documentation](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-version-control/)
- [Laravel Optimization Guide](https://laravel.com/docs/deployment#optimization)

---

## Support

If you encounter issues:

1. Check the logs: `storage/logs/laravel.log`
2. Review this documentation
3. Check cPanel error logs
4. Contact your hosting provider for server-specific issues

---

**Last Updated**: December 2025
