# Ankiya Cloud - Secret Generator Script
# Generates secure secrets and creates Kubernetes secret manifests

param(
    [string]$OutputFile = "..\03-secrets\secrets-generated.yaml",
    [switch]$Apply = $false,
    [string]$Namespace = "ankiya-cloud"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Ankiya Cloud - Secret Generator          " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Function to generate random password
function New-RandomPassword {
    param([int]$Length = 24)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    $password = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $password
}

# Function to generate alphanumeric password (for compatibility)
function New-AlphanumericPassword {
    param([int]$Length = 32)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $password = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $password
}

# Function to encode to base64
function ConvertTo-Base64 {
    param([string]$Text)
    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Text))
}

Write-Host "Generating secure passwords..." -ForegroundColor Yellow

# Generate all passwords
$secrets = @{
    # PostgreSQL
    POSTGRES_USER = "ankiya_admin"
    POSTGRES_PASSWORD = New-RandomPassword -Length 24
    POSTGRES_DB = "ankiya_cloud"
    
    # Redis
    REDIS_PASSWORD = New-RandomPassword -Length 24
    
    # Keycloak
    KEYCLOAK_ADMIN = "admin"
    KEYCLOAK_ADMIN_PASSWORD = New-RandomPassword -Length 24
    KEYCLOAK_CLIENT_SECRET = New-AlphanumericPassword -Length 32
    
    # MinIO
    MINIO_ROOT_USER = "minioadmin"
    MINIO_ROOT_PASSWORD = New-RandomPassword -Length 24
    
    # JWT & Session
    JWT_SECRET = New-AlphanumericPassword -Length 64
    SESSION_SECRET = New-AlphanumericPassword -Length 64
}

# Interactive prompts for external services
Write-Host "`n--- External Service Configuration ---" -ForegroundColor Cyan

# Razorpay
Write-Host "`nRazorpay Configuration:" -ForegroundColor Yellow
$razorpayKeyId = Read-Host "Enter Razorpay Key ID (or press Enter to skip)"
if ([string]::IsNullOrEmpty($razorpayKeyId)) { $razorpayKeyId = "rzp_test_placeholder" }

$razorpayKeySecret = Read-Host "Enter Razorpay Key Secret (or press Enter to skip)"
if ([string]::IsNullOrEmpty($razorpayKeySecret)) { $razorpayKeySecret = "razorpay_secret_placeholder" }

$razorpayWebhookSecret = Read-Host "Enter Razorpay Webhook Secret (or press Enter to skip)"
if ([string]::IsNullOrEmpty($razorpayWebhookSecret)) { $razorpayWebhookSecret = "webhook_secret_placeholder" }

$secrets["RAZORPAY_KEY_ID"] = $razorpayKeyId
$secrets["RAZORPAY_KEY_SECRET"] = $razorpayKeySecret
$secrets["RAZORPAY_WEBHOOK_SECRET"] = $razorpayWebhookSecret

# SMTP
Write-Host "`nSMTP Configuration:" -ForegroundColor Yellow
$smtpHost = Read-Host "Enter SMTP Host (default: smtp.gmail.com)"
if ([string]::IsNullOrEmpty($smtpHost)) { $smtpHost = "smtp.gmail.com" }

$smtpUser = Read-Host "Enter SMTP User/Email"
if ([string]::IsNullOrEmpty($smtpUser)) { $smtpUser = "your-email@gmail.com" }

$smtpPass = Read-Host "Enter SMTP Password/App Password"
if ([string]::IsNullOrEmpty($smtpPass)) { $smtpPass = "smtp_password_placeholder" }

$secrets["SMTP_HOST"] = $smtpHost
$secrets["SMTP_USER"] = $smtpUser
$secrets["SMTP_PASS"] = $smtpPass

# Generate YAML content
Write-Host "`nGenerating Kubernetes secrets manifest..." -ForegroundColor Yellow

$yamlContent = @"
# =====================================================
# ANKIYA CLOUD - GENERATED SECRETS
# Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =====================================================
# WARNING: Keep this file secure! Do not commit to git!
# =====================================================

apiVersion: v1
kind: Secret
metadata:
  name: ankiya-secrets
  namespace: $Namespace
  labels:
    app.kubernetes.io/name: ankiya-cloud
    app.kubernetes.io/part-of: ankiya-platform
type: Opaque
data:
  # PostgreSQL
  POSTGRES_USER: $(ConvertTo-Base64 $secrets["POSTGRES_USER"])
  POSTGRES_PASSWORD: $(ConvertTo-Base64 $secrets["POSTGRES_PASSWORD"])
  POSTGRES_DB: $(ConvertTo-Base64 $secrets["POSTGRES_DB"])

  # Redis
  REDIS_PASSWORD: $(ConvertTo-Base64 $secrets["REDIS_PASSWORD"])

  # Keycloak
  KEYCLOAK_ADMIN: $(ConvertTo-Base64 $secrets["KEYCLOAK_ADMIN"])
  KEYCLOAK_ADMIN_PASSWORD: $(ConvertTo-Base64 $secrets["KEYCLOAK_ADMIN_PASSWORD"])
  KEYCLOAK_CLIENT_SECRET: $(ConvertTo-Base64 $secrets["KEYCLOAK_CLIENT_SECRET"])

  # MinIO
  MINIO_ROOT_USER: $(ConvertTo-Base64 $secrets["MINIO_ROOT_USER"])
  MINIO_ROOT_PASSWORD: $(ConvertTo-Base64 $secrets["MINIO_ROOT_PASSWORD"])

  # Razorpay
  RAZORPAY_KEY_ID: $(ConvertTo-Base64 $secrets["RAZORPAY_KEY_ID"])
  RAZORPAY_KEY_SECRET: $(ConvertTo-Base64 $secrets["RAZORPAY_KEY_SECRET"])
  RAZORPAY_WEBHOOK_SECRET: $(ConvertTo-Base64 $secrets["RAZORPAY_WEBHOOK_SECRET"])

  # SMTP
  SMTP_HOST: $(ConvertTo-Base64 $secrets["SMTP_HOST"])
  SMTP_USER: $(ConvertTo-Base64 $secrets["SMTP_USER"])
  SMTP_PASS: $(ConvertTo-Base64 $secrets["SMTP_PASS"])

  # JWT & Session
  JWT_SECRET: $(ConvertTo-Base64 $secrets["JWT_SECRET"])
  SESSION_SECRET: $(ConvertTo-Base64 $secrets["SESSION_SECRET"])

---
# Grafana Secrets
apiVersion: v1
kind: Secret
metadata:
  name: grafana-secrets
  namespace: $Namespace
  labels:
    app: grafana
type: Opaque
data:
  admin-user: $(ConvertTo-Base64 "admin")
  admin-password: $(ConvertTo-Base64 (New-RandomPassword -Length 16))
"@

# Save to file
$yamlContent | Out-File -FilePath $OutputFile -Encoding utf8
Write-Host "Secrets saved to: $OutputFile" -ForegroundColor Green

# Save plaintext passwords for reference
$plaintextFile = "..\03-secrets\secrets-plaintext.txt"
$plaintextContent = @"
# =====================================================
# ANKIYA CLOUD - PLAINTEXT SECRETS REFERENCE
# Generated on: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# =====================================================
# WARNING: DELETE THIS FILE AFTER SAVING CREDENTIALS!
# DO NOT COMMIT TO GIT!
# =====================================================

PostgreSQL:
  User: $($secrets["POSTGRES_USER"])
  Password: $($secrets["POSTGRES_PASSWORD"])
  Database: $($secrets["POSTGRES_DB"])

Redis:
  Password: $($secrets["REDIS_PASSWORD"])

Keycloak:
  Admin User: $($secrets["KEYCLOAK_ADMIN"])
  Admin Password: $($secrets["KEYCLOAK_ADMIN_PASSWORD"])
  Client Secret: $($secrets["KEYCLOAK_CLIENT_SECRET"])

MinIO:
  User: $($secrets["MINIO_ROOT_USER"])
  Password: $($secrets["MINIO_ROOT_PASSWORD"])

Razorpay:
  Key ID: $($secrets["RAZORPAY_KEY_ID"])
  Key Secret: $($secrets["RAZORPAY_KEY_SECRET"])
  Webhook Secret: $($secrets["RAZORPAY_WEBHOOK_SECRET"])

SMTP:
  Host: $($secrets["SMTP_HOST"])
  User: $($secrets["SMTP_USER"])
  Password: $($secrets["SMTP_PASS"])

JWT & Session:
  JWT Secret: $($secrets["JWT_SECRET"])
  Session Secret: $($secrets["SESSION_SECRET"])
"@

$plaintextContent | Out-File -FilePath $plaintextFile -Encoding utf8
Write-Host "Plaintext reference saved to: $plaintextFile" -ForegroundColor Yellow
Write-Host "  ⚠️  DELETE THIS FILE AFTER SAVING CREDENTIALS!" -ForegroundColor Red

# Apply to cluster if requested
if ($Apply) {
    Write-Host "`nApplying secrets to cluster..." -ForegroundColor Yellow
    kubectl apply -f $OutputFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Secrets applied successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to apply secrets!" -ForegroundColor Red
    }
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  Secret Generation Complete!              " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review the generated secrets in: $OutputFile" -ForegroundColor White
Write-Host "2. Save the plaintext passwords from: $plaintextFile" -ForegroundColor White
Write-Host "3. DELETE the plaintext file after saving!" -ForegroundColor Red
Write-Host "4. Apply secrets: kubectl apply -f $OutputFile" -ForegroundColor White
Write-Host ""
