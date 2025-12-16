# CI/CD Configuration

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### 1. `lint.yml` - Code Quality
- **Runs on**: Push/PR to `main` or `develop`
- **Purpose**: Ensures code quality and formatting
- **Actions**:
  - Laravel Pint (PHP formatting)
  - Prettier (Frontend formatting)
  - ESLint (JS/TS linting)

### 2. `tests.yml` - Automated Testing
- **Runs on**: Push/PR to `main` or `develop`
- **Purpose**: Runs test suite
- **Actions**:
  - PHPUnit tests
  - Frontend build verification

### 3. `main.yml` - Automatic Deployment
- **Runs on**: Push to `main` branch
- **Purpose**: Deploy to cPanel production
- **Steps**:
  1. Run tests (must pass)
  2. Build assets
  3. Deploy via FTP
  4. Run optimization commands via SSH

### 4. `deploy-manual.yml` - Manual Deployment
- **Runs on**: Manual trigger
- **Purpose**: On-demand deployment with options
- **Features**:
  - Environment selection
  - Optional migrations
  - Deployment summary

## Required Secrets

Configure these in: **Repository Settings → Secrets and variables → Actions**

| Secret Name | Description |
|-------------|-------------|
| `CPANEL_FTP_SERVER` | FTP hostname (e.g., ftp.yourdomain.com) |
| `CPANEL_FTP_USERNAME` | FTP username |
| `CPANEL_FTP_PASSWORD` | FTP password |
| `CPANEL_DEPLOY_PATH` | Deployment path (e.g., /public_html/) |
| `CPANEL_SSH_HOST` | SSH hostname |
| `CPANEL_SSH_USERNAME` | SSH username |
| `CPANEL_SSH_PASSWORD` | SSH password |
| `CPANEL_SSH_PORT` | SSH port (default: 22) |

## Usage

### Automatic Deployment
Simply push to main:
```bash
git push origin main
```

### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **Manual Deployment to cPanel**
3. Click **Run workflow**
4. Choose options and run

## Monitoring

View deployment status:
- GitHub → Repository → Actions tab
- Click on any workflow run for details
- View logs for troubleshooting

## Customization

### Change Deployment Branch
Edit `main.yml`:
```yaml
on:
  push:
    branches:
      - production  # Change from 'main'
```

### Add Staging Environment
Duplicate `main.yml` and modify:
- Different branch trigger
- Different FTP/SSH credentials
- Different deploy path

### Skip Tests
Comment out or remove the `tests` job in `main.yml` (not recommended)

## Troubleshooting

### Deployment Fails
1. Check Actions logs
2. Verify GitHub Secrets are correct
3. Test FTP/SSH credentials manually
4. Check cPanel server access

### Tests Fail
1. Review test logs in Actions
2. Run tests locally: `./vendor/bin/phpunit`
3. Fix failing tests before pushing

## Documentation

For detailed setup and troubleshooting:
- **Quick Setup**: See `/QUICK-SETUP.md`
- **Full Guide**: See `/DEPLOYMENT.md`
- **Checklist**: See `/DEPLOYMENT-CHECKLIST.md`
- **Architecture**: See `/CI-CD-ARCHITECTURE.md`
