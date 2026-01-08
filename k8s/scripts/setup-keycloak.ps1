# Keycloak Setup Script for Ankiya Cloud
$KEYCLOAK_URL = "http://localhost:32645"
$ADMIN_USER = "admin"
$ADMIN_PASSWORD = "admin_dev_password"
$REALM_NAME = "ankiya"

Write-Host "Ankiya Cloud - Keycloak Setup" -ForegroundColor Cyan

# Step 1: Get Admin Token
Write-Host "[1/6] Getting admin access token..." -ForegroundColor Yellow
$tokenBody = @{
    grant_type = "password"
    client_id = "admin-cli"
    username = $ADMIN_USER
    password = $ADMIN_PASSWORD
}

try {
    $tokenResponse = Invoke-RestMethod -Uri "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" -Method POST -Body $tokenBody -ContentType "application/x-www-form-urlencoded"
    $ACCESS_TOKEN = $tokenResponse.access_token
    Write-Host "Admin token obtained" -ForegroundColor Green
} catch {
    Write-Host "Failed to get admin token: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $ACCESS_TOKEN"
    "Content-Type" = "application/json"
}

# Step 2: Create Realm
Write-Host "[2/6] Creating realm..." -ForegroundColor Yellow
$realmConfig = @{
    realm = $REALM_NAME
    enabled = $true
    displayName = "Ankiya Cloud Platform"
    registrationAllowed = $true
    registrationEmailAsUsername = $true
    resetPasswordAllowed = $true
    loginWithEmailAllowed = $true
    duplicateEmailsAllowed = $false
    verifyEmail = $false
    sslRequired = "none"
} | ConvertTo-Json -Depth 10

try {
    $null = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "Realm already exists" -ForegroundColor Yellow
} catch {
    try {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms" -Method POST -Headers $headers -Body $realmConfig
        Write-Host "Realm created" -ForegroundColor Green
    } catch {
        Write-Host "Failed to create realm: $_" -ForegroundColor Red
    }
}

# Step 3: Create Backend Client
Write-Host "[3/6] Creating backend client..." -ForegroundColor Yellow
$backendClient = @{
    clientId = "ankiya-backend"
    name = "Ankiya Backend API"
    enabled = $true
    clientAuthenticatorType = "client-secret"
    secret = "ankiya-backend-secret-key-2024"
    publicClient = $false
    serviceAccountsEnabled = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $false
    protocol = "openid-connect"
} | ConvertTo-Json -Depth 10

try {
    $existingClients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=ankiya-backend" -Method GET -Headers $headers
    if ($existingClients.Count -eq 0) {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" -Method POST -Headers $headers -Body $backendClient
        Write-Host "Backend client created" -ForegroundColor Green
    } else {
        Write-Host "Backend client exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}

# Step 4: Create Frontend Client
Write-Host "[4/6] Creating frontend client..." -ForegroundColor Yellow
$frontendClient = @{
    clientId = "ankiya-frontend"
    name = "Ankiya Frontend App"
    enabled = $true
    publicClient = $true
    directAccessGrantsEnabled = $true
    standardFlowEnabled = $true
    protocol = "openid-connect"
    rootUrl = "http://localhost:5173"
    baseUrl = "http://localhost:5173"
    redirectUris = @("http://localhost:5173/*", "http://localhost:3000/*")
    webOrigins = @("http://localhost:5173", "http://localhost:3000", "+")
} | ConvertTo-Json -Depth 10

try {
    $existingClients = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients?clientId=ankiya-frontend" -Method GET -Headers $headers
    if ($existingClients.Count -eq 0) {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/clients" -Method POST -Headers $headers -Body $frontendClient
        Write-Host "Frontend client created" -ForegroundColor Green
    } else {
        Write-Host "Frontend client exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}

# Step 5: Create Roles
Write-Host "[5/6] Creating roles..." -ForegroundColor Yellow
$roles = @("admin", "studio_owner", "studio_admin", "studio_user")
foreach ($roleName in $roles) {
    $roleJson = @{ name = $roleName } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles" -Method POST -Headers $headers -Body $roleJson
        Write-Host "  Role $roleName created" -ForegroundColor Green
    } catch {
        Write-Host "  Role $roleName exists" -ForegroundColor Yellow
    }
}

# Step 6: Create Test Users
Write-Host "[6/6] Creating test users..." -ForegroundColor Yellow

# Admin user
$adminUser = @{
    username = "admin@ankiya.cloud"
    email = "admin@ankiya.cloud"
    firstName = "Platform"
    lastName = "Admin"
    enabled = $true
    emailVerified = $true
    credentials = @(@{ type = "password"; value = "Admin@123"; temporary = $false })
} | ConvertTo-Json -Depth 10

try {
    $existing = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?email=admin@ankiya.cloud" -Method GET -Headers $headers
    if ($existing.Count -eq 0) {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" -Method POST -Headers $headers -Body $adminUser
        Write-Host "  Admin user created" -ForegroundColor Green
        
        # Assign admin role
        $user = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?email=admin@ankiya.cloud" -Method GET -Headers $headers
        $role = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles/admin" -Method GET -Headers $headers
        $roleMapping = "[$($role | ConvertTo-Json -Compress)]"
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$($user[0].id)/role-mappings/realm" -Method POST -Headers $headers -Body $roleMapping
        Write-Host "  Admin role assigned" -ForegroundColor Green
    } else {
        Write-Host "  Admin user exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

# Studio user
$studioUser = @{
    username = "studio@example.com"
    email = "studio@example.com"
    firstName = "Studio"
    lastName = "Owner"
    enabled = $true
    emailVerified = $true
    credentials = @(@{ type = "password"; value = "Studio@123"; temporary = $false })
} | ConvertTo-Json -Depth 10

try {
    $existing = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?email=studio@example.com" -Method GET -Headers $headers
    if ($existing.Count -eq 0) {
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users" -Method POST -Headers $headers -Body $studioUser
        Write-Host "  Studio user created" -ForegroundColor Green
        
        $user = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users?email=studio@example.com" -Method GET -Headers $headers
        $role = Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/roles/studio_owner" -Method GET -Headers $headers
        $roleMapping = "[$($role | ConvertTo-Json -Compress)]"
        Invoke-RestMethod -Uri "$KEYCLOAK_URL/admin/realms/$REALM_NAME/users/$($user[0].id)/role-mappings/realm" -Method POST -Headers $headers -Body $roleMapping
        Write-Host "  Studio role assigned" -ForegroundColor Green
    } else {
        Write-Host "  Studio user exists" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Keycloak Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Admin Console: $KEYCLOAK_URL/admin"
Write-Host "Realm: $REALM_NAME"
Write-Host ""
Write-Host "Test Users:"
Write-Host "  admin@ankiya.cloud / Admin@123"
Write-Host "  studio@example.com / Studio@123"
