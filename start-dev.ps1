# Ankiya Cloud Development Startup Script
# This script ensures PostgreSQL port-forward is running before starting the backend

Write-Host "🚀 Starting Ankiya Cloud Development Environment" -ForegroundColor Cyan

# Check if port 5432 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue

if (-not $portInUse) {
    Write-Host "📡 Starting PostgreSQL port-forward..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl port-forward -n ankiya-cloud svc/postgresql-service 5432:5432" -WindowStyle Minimized
    Start-Sleep -Seconds 3
    Write-Host "✅ PostgreSQL port-forward started" -ForegroundColor Green
} else {
    Write-Host "✅ PostgreSQL port-forward already running" -ForegroundColor Green
}

# Start backend server
Write-Host "🔧 Starting backend server..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\backend"
npm run dev
