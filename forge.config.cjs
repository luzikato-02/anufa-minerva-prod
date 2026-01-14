const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const os = require('os');

// Check if we're on Windows
const isWindows = os.platform() === 'win32';

// Define makers based on platform
const makers = [];

// Squirrel (Windows installer) - only on Windows
if (isWindows) {
    makers.push({
        name: '@electron-forge/maker-squirrel',
        config: {
            name: 'AnufaMinerva',
            setupExe: 'AnufaMinerva-Setup.exe',
            setupIcon: './public/favicon.ico',
            iconUrl: 'https://raw.githubusercontent.com/your-repo/main/public/favicon.ico',
            loadingGif: './electron/installer-loading.gif',
            noMsi: false,
        },
    });
}

// ZIP - works on all platforms for cross-compilation
makers.push({
    name: '@electron-forge/maker-zip',
    platforms: ['darwin', 'linux', 'win32'],
});

// DEB (Linux) - only on Linux
if (os.platform() === 'linux') {
    makers.push({
        name: '@electron-forge/maker-deb',
        config: {
            options: {
                maintainer: 'Anufa Minerva',
                homepage: 'https://github.com/your-repo',
                icon: './public/favicon.png',
            },
        },
    });

    makers.push({
        name: '@electron-forge/maker-rpm',
        config: {},
    });
}

module.exports = {
    packagerConfig: {
        name: 'Anufa Minerva',
        executableName: 'anufa-minerva',
        icon: './public/favicon',
        asar: true,
        appBundleId: 'com.anufa.minerva',
        appCopyright: 'Copyright © 2026 Anufa Minerva',
        win32metadata: {
            CompanyName: 'Anufa Minerva',
            FileDescription: 'Production Data Management System',
            OriginalFilename: 'anufa-minerva.exe',
            ProductName: 'Anufa Minerva',
            InternalName: 'anufa-minerva',
        },
        ignore: [
            /^\/\.git/,
            /^\/\.github/,
            /^\/\.vscode/,
            /^\/node_modules\/(?!better-sqlite3)/,
            /^\/vendor/,
            /^\/storage\/(?!app)/,
            /^\/tests/,
            /^\/phpunit\.xml/,
            /^\/\.env/,
            /^\/\.editorconfig/,
            /^\/\.prettierrc/,
            /^\/composer/,
            /^\/artisan/,
            /^\/laravel/,
        ],
        extraResource: [
            './public',
        ],
    },
    rebuildConfig: {
        force: true,
    },
    makers: makers,
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
    hooks: {
        packageAfterCopy: async (config, buildPath, electronVersion, platform, arch) => {
            // Copy the electron folder to the build
            const fs = require('fs');
            const path = require('path');
            
            // Ensure electron folder is copied
            const electronSrc = path.join(process.cwd(), 'electron');
            const electronDest = path.join(buildPath, 'electron');
            
            if (fs.existsSync(electronSrc)) {
                fs.cpSync(electronSrc, electronDest, { recursive: true });
            }
            
            // Copy public folder
            const publicSrc = path.join(process.cwd(), 'public');
            const publicDest = path.join(buildPath, 'public');
            
            if (fs.existsSync(publicSrc)) {
                fs.cpSync(publicSrc, publicDest, { recursive: true });
            }
        },
    },
};
