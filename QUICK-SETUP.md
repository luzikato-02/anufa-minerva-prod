# Quick Setup Guide - CI/CD for cPanel

Get your CI/CD pipeline up and running in minutes!

## Choose Your Deployment Method

### 🚀 Method 1: GitHub Actions (Recommended for Production)
**Best for**: Automatic deployments, no server dependencies

### 🔧 Method 2: cPanel Git Control  
**Best for**: Quick updates, manual control

---

## Method 1: GitHub Actions Setup (5 minutes)

### Step 1: Configure GitHub Secrets (2 min)

Go to: **Your Repository → Settings → Secrets and variables → Actions → New repository secret**

Add these 8 secrets:

```
CPANEL_FTP_SERVER          → ftp.yourdomain.com
CPANEL_FTP_USERNAME        → username@yourdomain.com
CPANEL_FTP_PASSWORD        → your_ftp_password
CPANEL_DEPLOY_PATH         → /public_html/
CPANEL_SSH_HOST            → yourdomain.com
CPANEL_SSH_USERNAME        → your_cpanel_username
CPANEL_SSH_PASSWORD        → your_ssh_password
CPANEL_SSH_PORT            → 22
```

**Where to find these:**
- FTP credentials: cPanel → FTP Accounts
- SSH credentials: cPanel → SSH Access
- Deploy path: Usually `/public_html/` or `/home/username/public_html/`

### Step 2: Enable SSH in cPanel (1 min)

1. Log in to cPanel
2. Search for "SSH Access"
3. Click "Manage SSH Keys"
4. If SSH is disabled, contact your hosting provider

### Step 3: Deploy! (2 min)

```bash
git add .
git commit -m "Setup CI/CD"
git push origin main
```

✅ **Done!** Check the deployment progress:
- GitHub → Your Repo → Actions tab
- Watch the deployment live!

---

## Method 2: cPanel Git Control (10 minutes)

### Step 1: Enable Git in cPanel (2 min)

1. Log in to cPanel
2. Search for "Git™ Version Control"
3. If not found, contact your hosting provider

### Step 2: Create Repository Connection (3 min)

In cPanel Git Version Control:

1. Click **"Create"** button
2. Fill in:
   ```
   Clone URL: https://github.com/yourusername/yourrepo.git
   (For private repos: https://YOUR_GITHUB_TOKEN@github.com/yourusername/yourrepo.git)
   
   Repository Path: /home/username/repositories/myapp
   Repository Name: my-laravel-app
   ```
3. Click **"Create"**

**To create GitHub Token:**
- GitHub → Settings → Developer settings → Personal access tokens
- Generate new token (classic) with `repo` scope

### Step 3: Configure Deployment (2 min)

1. Click **"Manage"** next to your repository
2. Set **Deployment Path**: `/home/username/public_html`
3. Click **"Update"**

### Step 4: Adjust PHP Path in .cpanel.yml (2 min)

Check your PHP version:
- cPanel → MultiPHP Manager

Edit `.cpanel.yml` and replace all `/opt/cpanel/ea-php84/` with your PHP version:
- PHP 8.2: `/opt/cpanel/ea-php82/`
- PHP 8.3: `/opt/cpanel/ea-php83/`
- PHP 8.4: `/opt/cpanel/ea-php84/`

### Step 5: Deploy! (1 min)

1. In cPanel Git Version Control, click **"Manage"**
2. Click **"Pull or Deploy"** → **"Update"**
3. Watch the deployment log

✅ **Done!**

---

## Post-Deployment Setup (Required for First Time)

### Step 1: Create Database (2 min)

cPanel → MySQL® Databases:

1. Create database: `myapp_db`
2. Create user: `myapp_user`
3. Add user to database with ALL PRIVILEGES
4. Note down the credentials

### Step 2: Configure .env File (3 min)

Via cPanel File Manager:

1. Navigate to your deployment directory
2. Edit `.env` file (or create from `.env.example`)
3. Update:

```env
APP_NAME="Your App Name"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp_db
DB_USERNAME=myapp_user
DB_PASSWORD=your_db_password
```

### Step 3: Run Migrations (2 min)

Via cPanel Terminal:

```bash
cd ~/public_html
php artisan migrate --force
```

### Step 4: Set Document Root (2 min)

cPanel → Domains → Manage:

1. Find your domain
2. Update **Document Root** to: `/home/username/public_html/public`
3. Save

---

## Verification Checklist

Visit your domain and check:

- [ ] ✅ Homepage loads without errors
- [ ] ✅ No 500 errors
- [ ] ✅ CSS/JS assets loading
- [ ] ✅ Login/Register works
- [ ] ✅ Database operations work

---

## Troubleshooting

### 500 Internal Server Error
```bash
# Via SSH or cPanel Terminal
cd ~/public_html
chmod -R 755 storage bootstrap/cache
php artisan config:clear
php artisan cache:clear
```

### Assets Not Loading (404 on CSS/JS)
- **Check**: Document root points to `/public` directory
- **Fix**: cPanel → Domains → Update Document Root

### Database Connection Error
- **Check**: `.env` database credentials
- **Verify**: Database and user exist in cPanel MySQL

### Permission Errors
```bash
chmod -R 755 storage bootstrap/cache
find storage -type f -exec chmod 644 {} \;
```

---

## Daily Usage

### Deploying New Changes

**Method 1 (GitHub Actions):**
```bash
git add .
git commit -m "Your changes"
git push origin main
```
→ Deploys automatically!

**Method 2 (cPanel Git):**
```bash
git add .
git commit -m "Your changes"
git push origin main
```
→ Then click "Update" in cPanel Git Version Control

---

## Need Help?

📖 **Detailed Guide**: See `DEPLOYMENT.md`  
✅ **Step-by-step**: See `DEPLOYMENT-CHECKLIST.md`  
🏗️ **Architecture**: See `CI-CD-ARCHITECTURE.md`

---

## Quick Commands Reference

```bash
# Clear all caches
php artisan optimize:clear

# Optimize for production
php artisan optimize

# Run migrations
php artisan migrate --force

# View logs
tail -100 storage/logs/laravel.log

# Test database connection
php artisan tinker
>>> DB::connection()->getPdo();
```

---

**🎉 That's it! Your CI/CD is now set up!**

Every push to `main` will now automatically deploy to your cPanel server (Method 1) or be ready to deploy with one click (Method 2).
