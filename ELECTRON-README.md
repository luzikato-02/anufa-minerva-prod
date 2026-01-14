# Anufa Minerva - Electron Desktop App

This document explains how to build and run the Electron desktop version of Anufa Minerva.

## Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- For Windows builds: Windows 10/11 or GitHub Actions Windows runner
- For Linux builds: Ubuntu/Debian or similar
- For macOS builds: macOS 10.15 or higher

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Mode

For development, you need to run both the Laravel server and the Electron app:

**Terminal 1 - Start Laravel:**
```bash
composer dev
```

**Terminal 2 - Start Electron (after Laravel is running):**
```bash
npm run electron:start
```

Or use the concurrent development command (requires Laravel running separately):
```bash
npm run electron:dev
```

## Building for Production

### Build for All Platforms

```bash
npm run electron:build
```

### Build for Specific Platforms

**Windows:**
```bash
npm run electron:make:win
```

**Linux:**
```bash
npm run electron:make:linux
```

**macOS:**
```bash
npm run electron:make:mac
```

## Automated Builds with GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/build-electron.yml`) that automatically builds the Electron app for Windows, Linux, and macOS.

### Triggering Builds

1. **Push to main/master branch** - Triggers automatic builds
2. **Create a version tag** - Triggers builds with GitHub Release
3. **Manual trigger** - Use the Actions tab in GitHub

### Creating a Release

1. Tag your release:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions will automatically build all platforms and create a draft release.

## Desktop App Features

### Offline Mode
The desktop app includes a local SQLite database for offline operation. Data is stored locally and synced when online.

### Data Synchronization
- **Automatic sync** when online
- **Manual sync** via File menu → Data Sync → Sync Now
- **Conflict resolution** for data conflicts between local and remote

### Local Database
Located at: `%APPDATA%/anufa-minerva/anufa-minerva-local.db` (Windows)

## Data Sync Architecture

### How It Works

1. **Local Changes**: When you create or modify records offline, they're stored locally with `local_modified = 1`
2. **Upload**: On sync, local changes are uploaded to the server
3. **Conflict Detection**: If both local and server have different versions, a conflict is created
4. **Download**: Server changes are downloaded and merged with local data
5. **Conflict Resolution**: Master users can resolve conflicts via the admin panel

### Sync Tables

The following tables support synchronization:
- `tension_records`
- `twisting_measurements`
- `weaving_measurements`
- `tension_problems`
- `stock_taking_records`
- `finish_earlier_records`

### Conflict Resolution (Admin Panel)

1. Navigate to Admin → Data Sync
2. View pending conflicts
3. For each conflict, choose:
   - **Keep Local**: Use the client's data
   - **Keep Remote**: Use the server's data
   - **Merge**: Manually combine both
   - **Dismiss**: Ignore the conflict

## Project Structure

```
/electron
├── main.js         # Main Electron process
├── preload.js      # Preload script (IPC bridge)
└── setup.html      # Server configuration page

/forge.config.js    # Electron Forge configuration
/package.json       # Updated with Electron scripts
```

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

Rebuild native modules:
```bash
npm run rebuild
```

### App crashes on startup

1. Delete the local database: `%APPDATA%/anufa-minerva/anufa-minerva-local.db`
2. Restart the app

### Build fails on Windows

Ensure you have Visual Studio Build Tools installed:
```bash
npm install --global windows-build-tools
```

### Sync fails

1. Check server URL configuration
2. Verify authentication token
3. Check network connectivity
4. Review sync logs in Admin → Data Sync → Logs

## Security Notes

1. The app uses context isolation for security
2. Node integration is disabled in renderer
3. HTTPS is required for production server connections
4. Authentication tokens are stored securely

## License

MIT License - see LICENSE file
