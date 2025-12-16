# CI/CD Architecture for cPanel Deployment

## Overview

This repository implements a comprehensive CI/CD pipeline for deploying a Laravel + React (Inertia.js) application to cPanel hosting. The architecture supports two deployment methods and includes automated testing, building, and deployment processes.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer                                │
│                    (Git Push to GitHub)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Repository                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              GitHub Actions Workflows                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │   │
│  │  │   Linter   │  │   Tests    │  │   Deployment     │   │   │
│  │  │   (lint.   │  │  (tests.   │  │    (main.yml/    │   │   │
│  │  │    yml)    │  │   yml)     │  │  deploy-manual.  │   │   │
│  │  └────────────┘  └────────────┘  │      yml)        │   │   │
│  │                                   └─────────┬────────┘   │   │
│  └─────────────────────────────────────────────┼───────────┘   │
└────────────────────────────────────────────────┼───────────────┘
                                                  │
                ┌─────────────────────────────────┴─────────────────┐
                │                                                     │
                ▼                                                     ▼
    ┌───────────────────────┐                         ┌──────────────────────┐
    │  METHOD 1: FTP/SSH    │                         │ METHOD 2: Git Deploy │
    │  GitHub Actions       │                         │ cPanel Git Control   │
    │  ┌─────────────────┐  │                         │ ┌──────────────────┐ │
    │  │ 1. Run Tests    │  │                         │ │ 1. Pull from Git │ │
    │  │ 2. Build Assets │  │                         │ │ 2. Run .cpanel.  │ │
    │  │ 3. FTP Upload   │  │                         │ │    yml hooks     │ │
    │  │ 4. SSH Commands │  │                         │ │ 3. Build & Cache │ │
    │  └─────────────────┘  │                         │ └──────────────────┘ │
    └──────────┬────────────┘                         └──────────┬───────────┘
               │                                                  │
               └──────────────────────┬───────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │    cPanel Server        │
                        │  ┌──────────────────┐   │
                        │  │  Laravel App     │   │
                        │  │  + React Assets  │   │
                        │  └──────────────────┘   │
                        │  ┌──────────────────┐   │
                        │  │  MySQL Database  │   │
                        │  └──────────────────┘   │
                        └─────────────────────────┘
```

## Components

### 1. GitHub Actions Workflows

#### a. Linter Workflow (`.github/workflows/lint.yml`)
- **Trigger**: Push/PR to `main` or `develop` branches
- **Purpose**: Code quality and formatting
- **Actions**:
  - Runs Laravel Pint for PHP code formatting
  - Runs Prettier for frontend code formatting
  - Runs ESLint for JavaScript/TypeScript linting

#### b. Tests Workflow (`.github/workflows/tests.yml`)
- **Trigger**: Push/PR to `main` or `develop` branches
- **Purpose**: Automated testing
- **Actions**:
  - Sets up PHP 8.4 environment
  - Sets up Node.js 22
  - Installs dependencies
  - Builds frontend assets
  - Runs PHPUnit tests

#### c. Main Deployment Workflow (`.github/workflows/main.yml`)
- **Trigger**: Push to `main` branch, or manual trigger
- **Purpose**: Automated deployment to cPanel
- **Steps**:
  1. **Test Job**:
     - Runs full test suite
     - Ensures code quality before deployment
  
  2. **Deploy Job** (runs after tests pass):
     - Installs production dependencies (Composer & npm)
     - Builds optimized frontend assets
     - Deploys via FTP to cPanel
     - Executes post-deployment commands via SSH:
       - Clears caches
       - Optimizes application
       - Sets permissions
       - Creates storage link
       - Optionally runs migrations

#### d. Manual Deployment Workflow (`.github/workflows/deploy-manual.yml`)
- **Trigger**: Manual via GitHub Actions UI
- **Purpose**: On-demand deployment with options
- **Features**:
  - Environment selection (production/staging)
  - Optional migration execution
  - Detailed deployment summary

### 2. Deployment Configuration Files

#### a. `.cpanel.yml`
- **Purpose**: Automated deployment hooks for cPanel Git Version Control
- **When Used**: Method 2 (cPanel native Git deployment)
- **Actions**:
  - Installs Composer dependencies
  - Builds frontend assets
  - Runs Laravel optimization commands
  - Sets file permissions
  - Creates storage symlink

#### b. `.deployignore`
- **Purpose**: Specifies files/directories to exclude from deployment
- **Reduces**: Deployment size and time
- **Excludes**:
  - Development files (.git, .github, tests)
  - Dependencies (node_modules - rebuilt on server or in CI)
  - IDE configurations
  - Documentation files

#### c. `deploy.sh`
- **Purpose**: Manual deployment script for server-side execution
- **When Used**: Manual deployments or troubleshooting
- **Features**:
  - Environment setup
  - Dependency installation
  - Cache optimization
  - Permission fixing
  - Safety checks

### 3. Deployment Methods

#### Method 1: GitHub Actions + FTP/SSH (Recommended)

**Advantages:**
- ✅ Fully automated on git push
- ✅ Build happens in GitHub (no server resources used)
- ✅ Pre-deployment testing
- ✅ No special server requirements
- ✅ Works with any cPanel hosting

**Disadvantages:**
- ❌ Requires FTP and SSH credentials in GitHub Secrets
- ❌ Slower for large deployments (file transfer)

**Flow:**
```
Git Push → GitHub Actions → Tests → Build → FTP Upload → SSH Optimization
```

**Setup Requirements:**
- FTP credentials
- SSH credentials
- GitHub Secrets configured
- SSH access enabled on cPanel

#### Method 2: cPanel Git Version Control

**Advantages:**
- ✅ Native cPanel integration
- ✅ Direct Git pull (faster)
- ✅ Built-in version control UI
- ✅ Easy rollback via cPanel

**Disadvantages:**
- ❌ Requires Composer on server
- ❌ Requires Node.js on server (or pre-built assets)
- ❌ Manual trigger (click button in cPanel)
- ❌ Limited to cPanel's Git feature availability

**Flow:**
```
Git Push → GitHub → cPanel Git Pull → .cpanel.yml hooks → Optimization
```

**Setup Requirements:**
- cPanel Git Version Control enabled
- Composer installed on server
- Node.js installed on server (or use pre-built assets)
- Repository connected in cPanel

## File Structure

```
/workspace/
├── .github/
│   └── workflows/
│       ├── lint.yml              # Code quality checks
│       ├── tests.yml             # Automated testing
│       ├── main.yml              # Main deployment workflow
│       └── deploy-manual.yml     # Manual deployment workflow
│
├── .cpanel.yml                   # cPanel Git deployment hooks
├── .deployignore                 # Files to exclude from deployment
├── deploy.sh                     # Manual deployment script
│
├── DEPLOYMENT.md                 # Comprehensive deployment guide
├── DEPLOYMENT-CHECKLIST.md       # Step-by-step deployment checklist
└── CI-CD-ARCHITECTURE.md         # This file - architecture overview
```

## Security Considerations

### GitHub Secrets (Never commit these!)
All sensitive credentials are stored as GitHub Secrets:
- `CPANEL_FTP_SERVER`
- `CPANEL_FTP_USERNAME`
- `CPANEL_FTP_PASSWORD`
- `CPANEL_SSH_HOST`
- `CPANEL_SSH_USERNAME`
- `CPANEL_SSH_PASSWORD`
- `CPANEL_DEPLOY_PATH`

### Server Security
- `.env` file is never committed to Git
- Production uses `APP_DEBUG=false`
- File permissions are restricted (755/644)
- SSH access uses strong passwords or keys
- Database credentials are environment-specific

### Deployment Security
- Tests must pass before deployment
- Production dependencies only (`--no-dev`)
- Cached configurations for performance
- Excluded sensitive files from deployment

## Monitoring & Logging

### GitHub Actions
- Real-time deployment logs in Actions tab
- Email notifications on failure
- Deployment status badges (optional)

### Server Logs
- Laravel logs: `storage/logs/laravel.log`
- cPanel error logs: Available in cPanel
- SSH access for live log monitoring

## Rollback Strategy

### GitHub Actions Method
1. **Via Git**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
   Triggers automatic redeployment of previous version

2. **Manual Backup**:
   - Keep FTP backup of working version
   - Upload via FileZilla or cPanel File Manager

### cPanel Git Method
1. Via cPanel UI:
   - Git Version Control → Manage
   - View commit log
   - Click rollback to previous commit

### Database Rollback
```bash
# SSH into server
php artisan migrate:rollback --force --step=1
```

## Performance Optimizations

### Build Time
- Cached npm packages in GitHub Actions
- Cached Composer packages
- Parallel job execution where possible

### Deployment
- Excluded unnecessary files (.deployignore)
- Compressed file transfer (FTP compressed mode)
- Incremental updates (FTP only changed files)

### Runtime
- Laravel config/route/view caching
- Production-optimized Vite build
- Composer autoloader optimization

## Scalability

### Future Enhancements
- **Multi-environment support**: Add staging environment
- **Database backups**: Automated before deployment
- **Health checks**: Post-deployment verification
- **Slack/Discord notifications**: Deployment status
- **Zero-downtime deployments**: Using symlinks
- **CDN integration**: For static assets
- **Docker support**: Containerized deployments

### Monitoring Integration
- **Sentry**: Error tracking
- **New Relic**: Performance monitoring
- **UptimeRobot**: Availability monitoring
- **Laravel Telescope**: Debug in non-production

## Comparison: Method 1 vs Method 2

| Feature | GitHub Actions (Method 1) | cPanel Git (Method 2) |
|---------|---------------------------|----------------------|
| Automation | ✅ Fully automatic | ⚠️ Manual trigger |
| Build Location | GitHub servers | cPanel server |
| Server Requirements | Minimal | Composer + Node.js |
| Speed | Medium (file transfer) | Fast (git pull) |
| Testing | ✅ Pre-deployment | ❌ No automated tests |
| Rollback | Git revert + redeploy | ✅ One-click in cPanel |
| Cost | Free (GitHub) | Included in hosting |
| Setup Complexity | Medium | Low |
| Best For | Production deployments | Quick updates/testing |

## Troubleshooting Flow

```
Deployment Failed?
│
├─ Did tests fail?
│  └─ Fix code → Push again
│
├─ FTP connection error?
│  ├─ Check GitHub Secrets
│  └─ Verify FTP credentials
│
├─ SSH connection error?
│  ├─ Check SSH enabled in cPanel
│  └─ Verify port (usually 22)
│
├─ Build errors?
│  ├─ Check Node.js/PHP versions
│  └─ Review build logs
│
└─ Runtime errors?
   ├─ Check .env configuration
   ├─ Review storage/logs/laravel.log
   └─ Verify file permissions
```

## Getting Started

**Quick Start:**
1. Read `DEPLOYMENT.md` for detailed instructions
2. Use `DEPLOYMENT-CHECKLIST.md` for step-by-step setup
3. Configure GitHub Secrets (Method 1) OR cPanel Git (Method 2)
4. Push to `main` branch to trigger deployment

**First Time Setup:**
1. Follow "Method 1" or "Method 2" in DEPLOYMENT.md
2. Complete all checklist items in DEPLOYMENT-CHECKLIST.md
3. Test deployment with non-critical changes first
4. Monitor logs during first deployment

## Maintenance

### Regular Tasks
- **Weekly**: Review deployment logs
- **Monthly**: Update dependencies (Composer + npm)
- **Quarterly**: Security audit
- **Annually**: Review and optimize deployment pipeline

### Updates
- Keep GitHub Actions up to date
- Update PHP/Node versions in workflows
- Review and update `.cpanel.yml` paths
- Test rollback procedures periodically

## Support & Documentation

- **Deployment Guide**: See `DEPLOYMENT.md`
- **Checklist**: See `DEPLOYMENT-CHECKLIST.md`
- **Laravel Docs**: https://laravel.com/docs/deployment
- **GitHub Actions**: https://docs.github.com/actions
- **cPanel Git**: https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-version-control/

---

**Architecture Version**: 1.0  
**Last Updated**: December 2025  
**Compatible with**: Laravel 12, PHP 8.2+, Node.js 18+, cPanel with Git support
