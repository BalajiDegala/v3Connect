# Ankiya Cloud - Full Deployment Script for Windows

param(
    [string]$Action = "deploy",
    [switch]$SkipMetalLB = $false,
    [switch]$SkipMonitoring = $false,
    [string]$Namespace = "ankiya-cloud"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "    Ankiya Cloud Kubernetes Deployment     " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check kubectl
if (!(Get-Command kubectl -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: kubectl not found. Please install kubectl." -ForegroundColor Red
    exit 1
}

# Check cluster connectivity
Write-Host "Checking cluster connectivity..." -ForegroundColor Yellow
$clusterInfo = kubectl cluster-info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to Kubernetes cluster." -ForegroundColor Red
    Write-Host $clusterInfo -ForegroundColor Red
    exit 1
}
Write-Host "Connected to cluster!" -ForegroundColor Green

function Deploy-Component {
    param(
        [string]$Name,
        [string]$Path
    )
    
    Write-Host "`n>>> Deploying $Name..." -ForegroundColor Yellow
    
    if (Test-Path $Path) {
        kubectl apply -f $Path
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    $Name deployed successfully!" -ForegroundColor Green
        } else {
            Write-Host "    ERROR deploying $Name!" -ForegroundColor Red
            return $false
        }
    } else {
        Write-Host "    WARNING: Path not found: $Path" -ForegroundColor Yellow
    }
    return $true
}

function Wait-ForPod {
    param(
        [string]$LabelSelector,
        [int]$TimeoutSeconds = 300
    )
    
    Write-Host "Waiting for pods with label: $LabelSelector..." -ForegroundColor Yellow
    kubectl wait --for=condition=ready pod -l $LabelSelector -n $Namespace --timeout="${TimeoutSeconds}s"
}

function Deploy-All {
    Write-Host "`nStarting full deployment..." -ForegroundColor Cyan
    
    # 1. Namespace
    Deploy-Component "Namespace" "00-namespace/"
    Start-Sleep -Seconds 2
    
    # 2. MetalLB (if not skipped)
    if (!$SkipMetalLB) {
        Write-Host "`n>>> Installing MetalLB..." -ForegroundColor Yellow
        kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml
        Write-Host "Waiting for MetalLB to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
        kubectl wait --namespace metallb-system --for=condition=ready pod --selector=app=metallb --timeout=120s
        Deploy-Component "MetalLB Config" "01-metallb/"
    }
    
    # 3. Storage
    Deploy-Component "Storage Classes & PVCs" "02-storage/"
    
    # 4. Secrets & ConfigMaps
    Deploy-Component "Secrets & ConfigMaps" "03-secrets/"
    
    # 5. PostgreSQL
    Deploy-Component "PostgreSQL" "04-postgresql/postgresql.yaml"
    Wait-ForPod "app=postgresql" 180
    
    # 6. Redis
    Deploy-Component "Redis" "05-redis/"
    Wait-ForPod "app=redis" 120
    
    # 7. Keycloak
    Deploy-Component "Keycloak" "06-keycloak/"
    Wait-ForPod "app=keycloak" 300
    
    # 8. MinIO
    Deploy-Component "MinIO" "07-minio/"
    Wait-ForPod "app=minio" 120
    
    # Run MinIO init job
    Start-Sleep -Seconds 30
    kubectl apply -f 07-minio/minio.yaml
    
    # 9. Backend
    Write-Host "`n>>> Running database migrations..." -ForegroundColor Yellow
    kubectl apply -f 08-backend/backend-migrate.yaml
    Start-Sleep -Seconds 30
    
    Deploy-Component "Backend" "08-backend/backend.yaml"
    Wait-ForPod "app=backend" 180
    
    # 10. Frontend
    Deploy-Component "Frontend" "09-frontend/"
    Wait-ForPod "app=frontend" 120
    
    # 11. Ingress
    Deploy-Component "Ingress" "10-ingress/"
    
    # 12. Monitoring (if not skipped)
    if (!$SkipMonitoring) {
        Deploy-Component "Prometheus" "11-monitoring/prometheus.yaml"
        Deploy-Component "Grafana" "11-monitoring/grafana.yaml"
        Deploy-Component "Loki" "11-monitoring/loki.yaml"
    }
    
    # 13. Network Policies
    Deploy-Component "Network Policies" "12-network-policies/"
    
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "    Deployment Complete!                   " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
}

function Show-Status {
    Write-Host "`n>>> Cluster Status" -ForegroundColor Cyan
    
    Write-Host "`n--- Pods ---" -ForegroundColor Yellow
    kubectl get pods -n $Namespace -o wide
    
    Write-Host "`n--- Services ---" -ForegroundColor Yellow
    kubectl get svc -n $Namespace
    
    Write-Host "`n--- Ingress ---" -ForegroundColor Yellow
    kubectl get ingress -n $Namespace
    
    Write-Host "`n--- PVCs ---" -ForegroundColor Yellow
    kubectl get pvc -n $Namespace
}

function Delete-All {
    Write-Host "`nWARNING: This will delete all Ankiya Cloud resources!" -ForegroundColor Red
    $confirm = Read-Host "Type 'yes' to confirm"
    
    if ($confirm -eq "yes") {
        Write-Host "Deleting resources..." -ForegroundColor Yellow
        
        kubectl delete -f 12-network-policies/ --ignore-not-found
        kubectl delete -f 11-monitoring/ --ignore-not-found
        kubectl delete -f 10-ingress/ --ignore-not-found
        kubectl delete -f 09-frontend/ --ignore-not-found
        kubectl delete -f 08-backend/ --ignore-not-found
        kubectl delete -f 07-minio/ --ignore-not-found
        kubectl delete -f 06-keycloak/ --ignore-not-found
        kubectl delete -f 05-redis/ --ignore-not-found
        kubectl delete -f 04-postgresql/ --ignore-not-found
        kubectl delete -f 03-secrets/ --ignore-not-found
        kubectl delete -f 02-storage/ --ignore-not-found
        kubectl delete namespace $Namespace --ignore-not-found
        
        Write-Host "All resources deleted!" -ForegroundColor Green
    } else {
        Write-Host "Cancelled." -ForegroundColor Yellow
    }
}

# Main
switch ($Action) {
    "deploy" { Deploy-All }
    "status" { Show-Status }
    "delete" { Delete-All }
    default {
        Write-Host "Usage: .\deploy.ps1 [-Action deploy|status|delete] [-SkipMetalLB] [-SkipMonitoring]" -ForegroundColor Yellow
    }
}
