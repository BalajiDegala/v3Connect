# Cert-Manager Installation Script

param(
    [switch]$Install = $false,
    [switch]$Staging = $false,
    [string]$Email = "admin@ankiyacloud.com"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Cert-Manager Setup for Ankiya Cloud      " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$CERT_MANAGER_VERSION = "v1.15.0"

if ($Install) {
    Write-Host "`n>>> Installing cert-manager $CERT_MANAGER_VERSION..." -ForegroundColor Yellow
    
    # Install cert-manager
    kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/$CERT_MANAGER_VERSION/cert-manager.yaml"
    
    Write-Host "Waiting for cert-manager to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s
    
    Write-Host "cert-manager installed successfully!" -ForegroundColor Green
}

# Update email in ClusterIssuers
Write-Host "`n>>> Configuring ClusterIssuers with email: $Email" -ForegroundColor Yellow

$issuerType = if ($Staging) { "letsencrypt-staging" } else { "letsencrypt-prod" }
Write-Host "Using issuer: $issuerType" -ForegroundColor Cyan

# Apply cert-manager configuration
kubectl apply -f cert-manager.yaml

Write-Host "`n>>> Checking certificate status..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
kubectl get certificates -n ankiya-cloud
kubectl get certificaterequests -n ankiya-cloud

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  Cert-Manager Setup Complete!             " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update domain names in cert-manager.yaml" -ForegroundColor White
Write-Host "2. Update email address in ClusterIssuers" -ForegroundColor White
Write-Host "3. Update Ingress to use TLS:" -ForegroundColor White
Write-Host "   - Add annotation: cert-manager.io/cluster-issuer: letsencrypt-prod" -ForegroundColor White
Write-Host "   - Add tls section with hosts and secretName" -ForegroundColor White
Write-Host ""
Write-Host "Monitor certificate status:" -ForegroundColor Cyan
Write-Host "  kubectl get certificates -n ankiya-cloud" -ForegroundColor White
Write-Host "  kubectl describe certificate ankiya-tls -n ankiya-cloud" -ForegroundColor White
