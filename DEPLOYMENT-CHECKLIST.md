# cPanel Deployment Checklist

Use this checklist to ensure a smooth deployment process.

## Pre-Deployment

### Local Development
- [ ] All tests passing (`./vendor/bin/phpunit`)
- [ ] Code linted and formatted
- [ ] No console errors or warnings
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations tested
- [ ] All features tested locally

### GitHub Repository
- [ ] All changes committed to Git
- [ ] Code pushed to GitHub
- [ ] Latest changes on `main` branch
- [ ] GitHub Actions workflows configured

## GitHub Actions Setup (Method 1)

### Required GitHub Secrets
Navigate to: Repository → Settings → Secrets and variables → Actions

- [ ] `CPANEL_FTP_SERVER` - Your cPanel FTP hostname
- [ ] `CPANEL_FTP_USERNAME` - Your FTP username
- [ ] `CPANEL_FTP_PASSWORD` - Your FTP password
- [ ] `CPANEL_DEPLOY_PATH` - Deployment directory path
- [ ] `CPANEL_SSH_HOST` - SSH hostname
- [ ] `CPANEL_SSH_USERNAME` - SSH username
- [ ] `CPANEL_SSH_PASSWORD` - SSH password
- [ ] `CPANEL_SSH_PORT` - SSH port (default: 22)

### Workflow Verification
- [ ] `.github/workflows/main.yml` exists
- [ ] Workflow has correct branch triggers
- [ ] Test workflow can be triggered manually

## cPanel Git Setup (Method 2 - Alternative)

### cPanel Configuration
- [ ] Git Version Control feature available
- [ ] Repository cloned in cPanel
- [ ] Deployment path configured
- [ ] `.cpanel.yml` file committed to repository
- [ ] PHP version path correct in `.cpanel.yml`

## Server Setup

### cPanel Account
- [ ] cPanel login credentials available
- [ ] SSH access enabled
- [ ] Terminal access works
- [ ] PHP version 8.2+ available
- [ ] Composer installed (check: `which composer`)
- [ ] Node.js available (optional)

### Database
- [ ] MySQL database created
- [ ] Database user created
- [ ] User has all privileges on database
- [ ] Database credentials noted

### Domain Configuration
- [ ] Domain added to cPanel
- [ ] DNS configured and propagated
- [ ] SSL certificate installed (AutoSSL/Let's Encrypt)
- [ ] Document root points to `/public` directory

## First Deployment

### File Upload
- [ ] All application files deployed
- [ ] Vendor directory included (or composer run)
- [ ] Built assets present in `/public/build`

### Environment Configuration
- [ ] `.env` file created
- [ ] `APP_KEY` generated
- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_URL` set correctly
- [ ] Database credentials configured
- [ ] Mail settings configured (if needed)

### Directory Structure
- [ ] `storage` directory exists
- [ ] `storage/logs` directory exists
- [ ] `storage/framework/cache` exists
- [ ] `storage/framework/sessions` exists
- [ ] `storage/framework/views` exists
- [ ] `bootstrap/cache` exists

### Permissions
```bash
# Run these commands via SSH
chmod -R 755 storage bootstrap/cache
find storage -type f -exec chmod 644 {} \;
find storage -type d -exec chmod 755 {} \;
```

- [ ] Storage directories writable
- [ ] Bootstrap cache writable
- [ ] Correct file ownership set

### Laravel Setup
```bash
# Via SSH in deployment directory
php artisan storage:link
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

- [ ] Storage link created
- [ ] Database migrated
- [ ] Configuration cached
- [ ] Routes cached
- [ ] Views cached

## Post-Deployment Verification

### Functionality Tests
- [ ] Homepage loads without errors
- [ ] Authentication works (login/register)
- [ ] Database connections work
- [ ] File uploads work (if applicable)
- [ ] Email sending works (if applicable)
- [ ] API endpoints respond correctly

### Performance Checks
- [ ] Assets load quickly (CSS/JS)
- [ ] Images optimized and loading
- [ ] No console errors in browser
- [ ] Page load time acceptable

### Security Checks
- [ ] `APP_DEBUG=false` in production
- [ ] `.env` file not web-accessible
- [ ] HTTPS working correctly
- [ ] Security headers configured
- [ ] Sensitive routes protected

### Monitoring
- [ ] Error logs accessible
- [ ] Laravel logs working (`storage/logs`)
- [ ] cPanel error logs monitored

## Optional Setup

### Cron Jobs
If using Laravel Scheduler:
- [ ] Cron job configured for `artisan schedule:run`
- [ ] Schedule tested and working

### Queue Workers
If using queues:
- [ ] Queue worker cron job set up
- [ ] Queue processing verified
- [ ] Failed jobs table exists

### Backups
- [ ] Database backup strategy in place
- [ ] File backup configured
- [ ] Backup restoration tested

## Troubleshooting Ready

### Have Access To
- [ ] SSH terminal access
- [ ] cPanel File Manager
- [ ] Error logs location known
- [ ] Database management (phpMyAdmin)

### Know How To
- [ ] Clear Laravel caches
- [ ] View application logs
- [ ] Rollback deployment
- [ ] Access cPanel error logs

## Documentation

- [ ] Deployment documented for team
- [ ] Server credentials securely stored
- [ ] Runbook created for common issues
- [ ] Contact info for hosting support

## Monitoring & Maintenance

### Post-Launch
- [ ] Monitor error logs daily
- [ ] Set up uptime monitoring
- [ ] Configure error notifications
- [ ] Schedule regular backups

### Regular Maintenance
- [ ] Weekly log review scheduled
- [ ] Monthly dependency updates
- [ ] Security patches applied
- [ ] Database optimization routine

---

## Quick Reference Commands

### Clear All Caches
```bash
php artisan optimize:clear
```

### Optimize for Production
```bash
php artisan optimize
```

### View Recent Logs
```bash
tail -100 storage/logs/laravel.log
```

### Test Database Connection
```bash
php artisan tinker
>>> DB::connection()->getPdo();
```

### Rebuild Everything
```bash
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## Emergency Rollback

If something goes wrong:

1. **Via cPanel Git** (if using Git method):
   - Go to Git Version Control
   - Click Manage → Show log
   - Click rollback to previous commit

2. **Via FTP** (if using GitHub Actions):
   - Keep a backup of previous working version
   - Upload backup files via FTP
   - Run optimization commands

3. **Database Rollback**:
   ```bash
   php artisan migrate:rollback --force
   ```

---

## Support Resources

- **Laravel Docs**: https://laravel.com/docs
- **cPanel Docs**: https://docs.cpanel.net
- **This Project**: See `DEPLOYMENT.md`

---

**Remember**: Always test in a staging environment before deploying to production!
