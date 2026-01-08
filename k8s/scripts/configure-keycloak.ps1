# Keycloak Realm Configuration Script
# Run this after Keycloak is running to set up the ankiya realm

param(
    [string]$KeycloakUrl = "http://localhost:32645",
    [string]$AdminUser = "admin",
    [string]$AdminPassword = "admin_dev_password"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Keycloak Realm Configuration             " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Keycloak is accessible
Write-Host ">>> Checking Keycloak connectivity..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$KeycloakUrl/health/ready" -UseBasicParsing -TimeoutSec 5
    Write-Host "Keycloak is ready!" -ForegroundColor Green
} catch {
    Write-Host "Keycloak is not accessible at $KeycloakUrl" -ForegroundColor Red
    Write-Host "Make sure Keycloak is running and port-forwarded" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Try: kubectl port-forward svc/keycloak-service 8080:8080 -n ankiya-cloud" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Manual Configuration Steps               " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open Keycloak Admin Console:" -ForegroundColor Cyan
Write-Host "  URL: $KeycloakUrl" -ForegroundColor White
Write-Host "  Username: $AdminUser" -ForegroundColor White
Write-Host "  Password: $AdminPassword" -ForegroundColor White
Write-Host ""

Write-Host "Step 1: Create Realm" -ForegroundColor Yellow
Write-Host "  - Click dropdown (top-left, shows 'master')" -ForegroundColor White
Write-Host "  - Click 'Create Realm'" -ForegroundColor White
Write-Host "  - Realm name: ankiya" -ForegroundColor White
Write-Host "  - Click 'Create'" -ForegroundColor White
Write-Host ""

Write-Host "Step 2: Create Backend Client" -ForegroundColor Yellow
Write-Host "  - Go to Clients > Create client" -ForegroundColor White
Write-Host "  - Client ID: ankiya-backend" -ForegroundColor White
Write-Host "  - Client authentication: ON" -ForegroundColor White
Write-Host "  - Authorization: ON" -ForegroundColor White
Write-Host "  - Click Next, then Save" -ForegroundColor White
Write-Host "  - Go to Credentials tab, copy the Client Secret" -ForegroundColor White
Write-Host "  - Update KEYCLOAK_CLIENT_SECRET in .env file" -ForegroundColor White
Write-Host ""

Write-Host "Step 3: Create Frontend Client" -ForegroundColor Yellow
Write-Host "  - Go to Clients > Create client" -ForegroundColor White
Write-Host "  - Client ID: ankiya-frontend" -ForegroundColor White
Write-Host "  - Client authentication: OFF (public client)" -ForegroundColor White
Write-Host "  - Click Next" -ForegroundColor White
Write-Host "  - Valid redirect URIs: http://localhost:5173/*" -ForegroundColor White
Write-Host "  - Web origins: http://localhost:5173" -ForegroundColor White
Write-Host "  - Click Save" -ForegroundColor White
Write-Host ""

Write-Host "Step 4: Create Roles" -ForegroundColor Yellow
Write-Host "  - Go to Realm roles > Create role" -ForegroundColor White
Write-Host "  - Create: admin, studio_owner, studio_user" -ForegroundColor White
Write-Host ""

Write-Host "Step 5: Create Test User" -ForegroundColor Yellow
Write-Host "  - Go to Users > Add user" -ForegroundColor White
Write-Host "  - Username: testadmin" -ForegroundColor White
Write-Host "  - Email: testadmin@example.com" -ForegroundColor White
Write-Host "  - Email verified: ON" -ForegroundColor White
Write-Host "  - Click Create" -ForegroundColor White
Write-Host "  - Go to Credentials tab, set password" -ForegroundColor White
Write-Host "  - Go to Role mapping, assign 'admin' role" -ForegroundColor White
Write-Host ""

Write-Host "Step 6: Enable Organizations (Optional)" -ForegroundColor Yellow
Write-Host "  - Go to Realm settings > General" -ForegroundColor White
Write-Host "  - Enable 'Organizations'" -ForegroundColor White
Write-Host "  - This allows multi-tenant studio management" -ForegroundColor White
Write-Host ""

Write-Host "============================================" -ForegroundColor Green
Write-Host "  Opening Keycloak Admin Console...        " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

Start-Process $KeycloakUrl
