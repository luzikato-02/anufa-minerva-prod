# Manufacturing Desktop App - Electron Edition

This document explains how to build and run the Electron desktop application with local database synchronization.

## Features

- **Local SQLite Database**: All data is stored locally using SQLite, allowing offline access
- **Remote Synchronization**: Sync your local data with the Laravel server when online
- **Conflict Resolution**: Handle data conflicts between local and remote databases
- **Auto-sync**: Optional automatic synchronization at configurable intervals
- **Cross-platform**: Works on Windows, macOS, and Linux

## Prerequisites

- Node.js 18+ 
- npm or yarn
- For native modules (better-sqlite3): Python 3 and a C++ compiler
  - Windows: Install Visual Studio Build Tools
  - macOS: Install Xcode Command Line Tools (`xcode-select --install`)
  - Linux: Install build-essential (`sudo apt-get install build-essential`)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Rebuild native modules for Electron:
```bash
npm rebuild better-sqlite3 --runtime=electron --target=33.2.0 --disturl=https://electronjs.org/headers
```

## Development

Run the app in development mode with hot-reload:

```bash
npm run electron:dev
```

This starts both Vite dev server and Electron, with automatic reload on file changes.

## Building the App

### Build for current platform:
```bash
npm run electron:dist
```

### Build for specific platforms:
```bash
# Windows
npm run electron:dist:win

# macOS
npm run electron:dist:mac

# Linux
npm run electron:dist:linux
```

Built applications will be in the `release/` directory.

## Project Structure

```
electron/
├── main.ts          # Electron main process
├── preload.ts       # Preload script for secure IPC
├── database.ts      # Local SQLite database service
├── sync.ts          # Synchronization service
└── tsconfig.json    # TypeScript config for Electron

resources/js/
├── electron-app.tsx           # Electron-specific app entry
├── layouts/
│   └── electron-app-layout.tsx # Desktop app layout
├── pages/
│   └── database-sync.tsx      # Sync management page
├── hooks/
│   └── use-electron.ts        # Electron detection hooks
└── types/
    └── electron.d.ts          # TypeScript types for Electron API
```

## Database Synchronization

### Sync Settings

1. Open the app and navigate to **Database Sync** in the sidebar
2. Configure the server connection:
   - **Server URL**: Your Laravel server URL (e.g., `https://your-server.com`)
   - **API Token**: Get this by logging in on the web app and generating a token
3. Choose sync options:
   - Auto-sync (and interval)
   - Sync on startup
   - Which data types to sync

### Manual Sync

- **Sync All**: Uploads local changes and downloads remote changes
- **Pull from Server**: Only download remote changes
- **Push to Server**: Only upload local changes

### Conflict Resolution

When the same record is modified both locally and remotely, a conflict is created. You can resolve conflicts by:

1. Going to the **Conflicts** tab
2. Viewing both versions (local and remote)
3. Choosing which version to keep

## Local Database

The local SQLite database is stored in the user data directory:

- **Windows**: `%APPDATA%/manufacturing-desktop-app/local_data.db`
- **macOS**: `~/Library/Application Support/manufacturing-desktop-app/local_data.db`
- **Linux**: `~/.config/manufacturing-desktop-app/local_data.db`

### Tables

- `tension_records` - Tension measurement data
- `stock_taking_records` - Stock take session data
- `finish_earlier_records` - Finish earlier records
- `sync_settings` - Synchronization configuration
- `sync_history` - Log of sync operations
- `sync_conflicts` - Pending conflicts to resolve

## API Token Generation

To get an API token for the desktop app:

1. Log in to the web application
2. The mobile API uses Laravel Sanctum for authentication
3. Call the login endpoint:
   ```bash
   curl -X POST https://your-server.com/api/mobile/login \
     -H "Content-Type: application/json" \
     -d '{"login": "your@email.com", "password": "yourpassword"}'
   ```
4. Copy the `access_token` from the response

## Troubleshooting

### Native module build errors

If you get errors related to `better-sqlite3`, try:

```bash
# Clear node modules and reinstall
rm -rf node_modules
npm install

# Rebuild for Electron
./node_modules/.bin/electron-rebuild
```

### Connection issues

1. Verify the server URL is correct and accessible
2. Check that your API token is valid
3. Ensure the server's CORS settings allow requests from Electron

### Database errors

If the database becomes corrupted:

1. Close the app
2. Navigate to the user data directory
3. Delete `local_data.db` (this will reset all local data)
4. Restart the app and sync from remote

## Security Notes

- API tokens are stored locally in the SQLite database
- Use HTTPS for the server URL in production
- The app uses context isolation and disables Node integration in the renderer process for security
