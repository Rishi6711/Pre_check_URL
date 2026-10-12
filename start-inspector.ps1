# Pre Check URL Launcher
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $ScriptDir "Precheckwebsite"

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Starting Pre Check URL Server..." -ForegroundColor Green
Write-Host "Directory: $AppDir" -ForegroundColor Gray
Write-Host "=========================================================" -ForegroundColor Cyan

# Ensure Node.js path is in environment
if (Test-Path "C:\Program Files\nodejs\node.exe") {
    $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
}

# Start node server
Start-Process "http://localhost:4000"
Set-Location $AppDir
& "C:\Program Files\nodejs\node.exe" server.js
