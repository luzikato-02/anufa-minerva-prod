<#
.SYNOPSIS
  Build the app from the current git HEAD into app.zip for manual upload
  and extraction via cPanel File Manager.

.DESCRIPTION
  Exports the committed git tree (uncommitted changes are NOT included -
  commit first), installs PHP/Node dependencies, builds frontend assets,
  and zips the result. Run this locally - it never touches the server.

  The subdomain's document root should point directly at
  <app checkout>/public (cPanel > Domains) - this keeps .env/vendor/app
  code out of the webroot (Apache only serves the docroot and below)
  without needing a separate synced docroot directory.

  After it finishes:
    1. Upload deploy/dist/app.zip to the app checkout directory on cPanel
       and extract it there.
    2. Delete the zip file from the server.
    3. Via cPanel Terminal, run: php artisan deploy:finalize
       (migrations, role/permission seeding, admin bootstrap, cache warmup)

.EXAMPLE
  powershell -File deploy/build.ps1
#>

$ErrorActionPreference = 'Stop'

$RootDir = (Resolve-Path "$PSScriptRoot\..").Path
$DistDir = Join-Path $RootDir 'deploy\dist'
$BuildDir = Join-Path $env:TEMP ("minerva-build-" + [guid]::NewGuid())
$ArchiveTar = Join-Path $env:TEMP ("minerva-head-" + [guid]::NewGuid() + '.tar')

function Invoke-Checked {
    param([string]$Exe, [string[]]$ExeArgs)
    & $Exe @ExeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "$Exe $($ExeArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

try {
    New-Item -ItemType Directory -Path $BuildDir | Out-Null

    Write-Host "==> Exporting committed tree (git HEAD) to $BuildDir"
    Write-Host "    (uncommitted changes are NOT included - commit first)"
    Push-Location $RootDir
    # ':!.claude' excludes Claude Code project tooling (not app code) - it
    # includes a symlink that Windows can't extract without elevated
    # privileges (Developer Mode / SeCreateSymbolicLinkPrivilege).
    Invoke-Checked git @('archive', '-o', $ArchiveTar, 'HEAD', '--', '.', ':!.claude')
    Pop-Location
    Invoke-Checked tar @('-xf', $ArchiveTar, '-C', $BuildDir)

    Push-Location $BuildDir

    Write-Host "==> Installing PHP dependencies (--no-dev)"
    Invoke-Checked composer @('install', '--no-dev', '--prefer-dist', '--optimize-autoloader', '--no-interaction')

    Write-Host "==> Installing Node dependencies"
    # npm.cmd (not bare "npm") - PowerShell resolves the unqualified name to
    # npm.ps1 first, which mishandles args passed through this splatted
    # helper (drops/garbles characters, e.g. "ci" becomes an unknown "pm"
    # command). The .cmd shim doesn't have that problem.
    Invoke-Checked npm.cmd @('ci')

    Write-Host "==> Building frontend assets"
    Invoke-Checked npm.cmd @('run', 'build')

    Write-Host "==> Creating archive"
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    $AppZip = Join-Path $DistDir 'app.zip'
    Remove-Item -Force -ErrorAction SilentlyContinue $AppZip

    # public/ (including public/build, the compiled frontend assets) is
    # included as-is - the docroot points directly at <app checkout>/public,
    # so index.php's default relative paths work unmodified.
    Invoke-Checked tar @('-a', '-c', '-f', $AppZip, '--exclude=node_modules', '--exclude=tests', '.')

    Pop-Location

    Write-Host ""
    Write-Host "==> Built:"
    Write-Host "    $AppZip"
    Write-Host ""
    Write-Host "==> Next steps:"
    Write-Host "    1. Upload app.zip to the app checkout dir on cPanel and extract it there"
    Write-Host "    2. Delete the zip file from the server"
    Write-Host "    3. Via cPanel Terminal: php artisan deploy:finalize"
}
finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $BuildDir
    Remove-Item -Force -ErrorAction SilentlyContinue $ArchiveTar
}
