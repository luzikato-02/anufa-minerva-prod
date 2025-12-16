# 🚀 Automated Deployment to cPanel

This repository includes a complete CI/CD pipeline for deploying your Laravel + React application to cPanel hosting.

## Quick Start

**⭐ New to deployment?** Start here: [`QUICK-SETUP.md`](QUICK-SETUP.md)

## Documentation

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| [`QUICK-SETUP.md`](QUICK-SETUP.md) | Fast setup guide with minimal details | 5 min |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Complete guide with troubleshooting | 20 min |
| [`DEPLOYMENT-CHECKLIST.md`](DEPLOYMENT-CHECKLIST.md) | Step-by-step deployment checklist | 15 min |
| [`CI-CD-ARCHITECTURE.md`](CI-CD-ARCHITECTURE.md) | Architecture and design overview | 10 min |
| [`CI-CD-SETUP-SUMMARY.md`](CI-CD-SETUP-SUMMARY.md) | What was created and why | 5 min |

## Deployment Methods

### Method 1: GitHub Actions (Recommended)
✅ **Fully automated** - Push to `main` = Auto deploy  
✅ **No server dependencies** - Builds in GitHub  
✅ **Pre-deployment testing** - Tests must pass  
✅ **Production ready** - Optimized builds  

**Setup**: Add 8 GitHub Secrets → Push to deploy

### Method 2: cPanel Git Version Control
✅ **One-click deployment** - Click "Update" in cPanel  
✅ **Native cPanel integration** - Uses cPanel's Git feature  
✅ **Easy rollback** - Built into cPanel UI  

**Setup**: Connect repo in cPanel → Click Update to deploy

## Features

- 🧪 **Automated Testing** - PHPUnit tests before deployment
- 🎨 **Asset Building** - Optimized Vite builds
- 🔒 **Secure** - Credentials in GitHub Secrets
- 📦 **Optimized** - Only necessary files deployed
- 🔄 **Cache Management** - Automatic Laravel optimization
- 📊 **Monitoring** - Real-time deployment logs

## How It Works

```
Code Change → GitHub → Tests → Build → Deploy → Optimize → Live ✅
```

**Automatic triggers:**
- Push to `main` branch → Production deployment
- Push to `develop` → Linting and tests
- Pull requests → Code quality checks

## First Deployment

1. **Choose method** (GitHub Actions or cPanel Git)
2. **Configure credentials** (GitHub Secrets or cPanel)
3. **Push to main** (or click Update in cPanel)
4. **Setup .env** on server
5. **Run migrations**
6. **Set document root** to `/public`

**Detailed steps**: See [`QUICK-SETUP.md`](QUICK-SETUP.md)

## Daily Usage

**To deploy new changes:**

```bash
git add .
git commit -m "Your changes"
git push origin main
```

**Method 1**: Deploys automatically ✨  
**Method 2**: Click "Update" in cPanel

## Troubleshooting

**Common issues:**
- 500 Error → Check permissions: `chmod -R 755 storage bootstrap/cache`
- Assets 404 → Document root must point to `/public`
- Database error → Verify `.env` credentials

**Full troubleshooting**: See [`DEPLOYMENT.md`](DEPLOYMENT.md) → Troubleshooting section

## Configuration Files

| File | Purpose |
|------|---------|
| `.github/workflows/main.yml` | Production deployment workflow |
| `.github/workflows/deploy-manual.yml` | Manual deployment with options |
| `.cpanel.yml` | cPanel Git deployment hooks |
| `.deployignore` | Files to exclude from deployment |
| `deploy.sh` | Manual deployment script |

## Support

Need help? Check these resources in order:
1. [`QUICK-SETUP.md`](QUICK-SETUP.md) - Quick start
2. [`DEPLOYMENT.md`](DEPLOYMENT.md) - Full guide
3. [`DEPLOYMENT-CHECKLIST.md`](DEPLOYMENT-CHECKLIST.md) - Checklist
4. GitHub Actions logs - For deployment errors
5. `storage/logs/laravel.log` - For application errors

## Security Checklist

Before going live:
- [ ] `APP_DEBUG=false` in production
- [ ] Strong database passwords
- [ ] HTTPS enabled (AutoSSL)
- [ ] GitHub Secrets properly configured
- [ ] `.env` file not in Git

---

**Ready to deploy?** → Start with [`QUICK-SETUP.md`](QUICK-SETUP.md) 🚀
