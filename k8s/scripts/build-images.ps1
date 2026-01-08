# Ankiya Cloud - Docker Build and Push Script

param(
    [string]$Registry = "docker.io/ankiya",
    [string]$Tag = "latest",
    [switch]$Push = $false,
    [switch]$Backend = $false,
    [switch]$Frontend = $false,
    [switch]$All = $false
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Ankiya Cloud - Docker Build           " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Environment variables for frontend build
$env:VITE_API_URL = "https://api.ankiya.example.com"
$env:VITE_KEYCLOAK_URL = "https://auth.ankiya.example.com"
$env:VITE_KEYCLOAK_REALM = "ankiya-cloud"
$env:VITE_KEYCLOAK_CLIENT_ID = "ankiya-cloud-frontend"
$env:VITE_RAZORPAY_KEY_ID = "your_razorpay_key_id"

function Build-Backend {
    Write-Host "`n>>> Building Backend..." -ForegroundColor Yellow
    
    Push-Location backend
    
    docker build `
        -t "${Registry}/backend:${Tag}" `
        -f Dockerfile `
        .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Backend built successfully!" -ForegroundColor Green
    } else {
        Write-Host "Backend build failed!" -ForegroundColor Red
        Pop-Location
        return $false
    }
    
    Pop-Location
    return $true
}

function Build-Frontend {
    Write-Host "`n>>> Building Frontend..." -ForegroundColor Yellow
    
    docker build `
        -t "${Registry}/frontend:${Tag}" `
        --build-arg VITE_API_URL=$env:VITE_API_URL `
        --build-arg VITE_KEYCLOAK_URL=$env:VITE_KEYCLOAK_URL `
        --build-arg VITE_KEYCLOAK_REALM=$env:VITE_KEYCLOAK_REALM `
        --build-arg VITE_KEYCLOAK_CLIENT_ID=$env:VITE_KEYCLOAK_CLIENT_ID `
        --build-arg VITE_RAZORPAY_KEY_ID=$env:VITE_RAZORPAY_KEY_ID `
        -f Dockerfile `
        .
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Frontend built successfully!" -ForegroundColor Green
    } else {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        return $false
    }
    
    return $true
}

function Push-Images {
    Write-Host "`n>>> Pushing images to registry..." -ForegroundColor Yellow
    
    if ($Backend -or $All) {
        docker push "${Registry}/backend:${Tag}"
    }
    
    if ($Frontend -or $All) {
        docker push "${Registry}/frontend:${Tag}"
    }
    
    Write-Host "Images pushed successfully!" -ForegroundColor Green
}

# Main
if ($All -or (!$Backend -and !$Frontend)) {
    Build-Backend
    Build-Frontend
} else {
    if ($Backend) { Build-Backend }
    if ($Frontend) { Build-Frontend }
}

if ($Push) {
    Push-Images
}

Write-Host "`n>>> Docker images:" -ForegroundColor Cyan
docker images | Select-String "ankiya"

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "    Build Complete!                        " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
