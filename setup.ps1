# Ankiya Cloud - Quick Start Script

Write-Host "🚀 Ankiya Cloud - Quick Start Setup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js found: $(node --version)`n" -ForegroundColor Green

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  PostgreSQL CLI not found. Make sure PostgreSQL is installed." -ForegroundColor Yellow
} else {
    Write-Host "✅ PostgreSQL found`n" -ForegroundColor Green
}

# Backend Setup
Write-Host "`n📦 Setting up Backend..." -ForegroundColor Cyan
Set-Location backend

if (!(Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Please configure .env file with your credentials!" -ForegroundColor Yellow
    Write-Host "   - Database URL" -ForegroundColor Yellow
    Write-Host "   - Keycloak settings" -ForegroundColor Yellow
    Write-Host "   - Razorpay keys" -ForegroundColor Yellow
    Write-Host "   - SMTP settings`n" -ForegroundColor Yellow
}

Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n🗄️  Setting up database..." -ForegroundColor Cyan
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate

Write-Host "`nAttempting database migration..." -ForegroundColor Yellow
Write-Host "⚠️  Make sure PostgreSQL is running and .env is configured!" -ForegroundColor Yellow
npm run prisma:migrate

# Frontend Setup
Write-Host "`n🎨 Setting up Frontend..." -ForegroundColor Cyan
Set-Location ..

if (!(Test-Path ".env")) {
    Write-Host "Creating frontend .env file..." -ForegroundColor Yellow
    @"
VITE_API_URL=http://localhost:5000/api
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=ankiya-cloud
VITE_KEYCLOAK_CLIENT_ID=ankiya-cloud-frontend
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
"@ | Out-File -FilePath ".env" -Encoding utf8
    Write-Host "✅ Frontend .env created`n" -ForegroundColor Green
}

Write-Host "`n✨ Setup Complete!" -ForegroundColor Green
Write-Host "====================================`n" -ForegroundColor Cyan

Write-Host "📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Setup Keycloak (see backend/SETUP.md)" -ForegroundColor White
Write-Host "2. Configure .env files" -ForegroundColor White
Write-Host "3. Run backend: cd backend && npm run dev" -ForegroundColor White
Write-Host "4. Run frontend: npm run dev`n" -ForegroundColor White

Write-Host "📚 Documentation: backend/SETUP.md`n" -ForegroundColor Cyan
