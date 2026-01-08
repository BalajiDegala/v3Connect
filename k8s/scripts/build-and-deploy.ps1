# Build and Deploy Images Script
# Builds Docker images and deploys to Kubernetes

param(
    [string]$Registry = "localhost:5000",  # Local registry or your registry
    [string]$Tag = "latest",
    [switch]$SkipBuild = $false,
    [switch]$LocalDev = $true  # Use for local development without registry
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "F:\ankiya\ConnectAnk"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Ankiya Cloud - Build & Deploy            " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Docker
Write-Host ">>> Checking Docker..." -ForegroundColor Yellow
docker version | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running!" -ForegroundColor Red
    exit 1
}
Write-Host "Docker is ready" -ForegroundColor Green

if (-not $SkipBuild) {
    # Build Frontend
    Write-Host ""
    Write-Host ">>> Building Frontend Image..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    
    if ($LocalDev) {
        docker build -t ankiya-frontend:$Tag -f Dockerfile .
    } else {
        docker build -t $Registry/ankiya-frontend:$Tag -f Dockerfile .
        docker push $Registry/ankiya-frontend:$Tag
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Frontend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Frontend image built successfully" -ForegroundColor Green

    # Build Backend
    Write-Host ""
    Write-Host ">>> Building Backend Image..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\backend"
    
    if ($LocalDev) {
        docker build -t ankiya-backend:$Tag -f Dockerfile .
    } else {
        docker build -t $Registry/ankiya-backend:$Tag -f Dockerfile .
        docker push $Registry/ankiya-backend:$Tag
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Backend image built successfully" -ForegroundColor Green
}

# Import images to K3s/Rancher (for local development)
if ($LocalDev) {
    Write-Host ""
    Write-Host ">>> Importing images to Kubernetes..." -ForegroundColor Yellow
    
    # For K3s, we can import directly
    # For other K8s distributions, you may need to push to a registry
    
    # Save and import frontend
    docker save ankiya-frontend:$Tag -o "$ProjectRoot\k8s\frontend-image.tar"
    # For k3s: sudo k3s ctr images import frontend-image.tar
    # For Rancher Desktop with containerd:
    # nerdctl --namespace k8s.io load -i frontend-image.tar
    
    # Save and import backend
    docker save ankiya-backend:$Tag -o "$ProjectRoot\k8s\backend-image.tar"
    
    Write-Host "Images saved to k8s/*.tar" -ForegroundColor Green
    Write-Host ""
    Write-Host "For Rancher Desktop, import with:" -ForegroundColor Cyan
    Write-Host "  nerdctl --namespace k8s.io load -i k8s/frontend-image.tar" -ForegroundColor White
    Write-Host "  nerdctl --namespace k8s.io load -i k8s/backend-image.tar" -ForegroundColor White
}

# Deploy to Kubernetes
Write-Host ""
Write-Host ">>> Deploying to Kubernetes..." -ForegroundColor Yellow

Set-Location $ProjectRoot

# Apply frontend deployment
$frontendYaml = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: ankiya-cloud
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: ankiya-frontend:$Tag
          imagePullPolicy: Never  # Use local image
          ports:
            - containerPort: 80
          resources:
            limits:
              memory: 256Mi
              cpu: 250m
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: ankiya-cloud
spec:
  selector:
    app: frontend
  ports:
    - port: 80
      targetPort: 80
  type: NodePort
"@

$frontendYaml | kubectl apply -f -

# Apply backend deployment
$backendYaml = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: ankiya-cloud
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: ankiya-backend:$Tag
          imagePullPolicy: Never  # Use local image
          ports:
            - containerPort: 5000
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "5000"
            - name: DATABASE_URL
              value: "postgresql://ankiya_admin:ankiya_dev_password@postgresql-service:5432/ankiya_cloud"
            - name: REDIS_URL
              value: "redis://:redis_dev_password@redis-service:6379"
            - name: KEYCLOAK_URL
              value: "http://keycloak-service:8080"
            - name: KEYCLOAK_REALM
              value: "ankiya"
            - name: KEYCLOAK_CLIENT_ID
              value: "ankiya-backend"
            - name: RAZORPAY_KEY_ID
              value: "rzp_test_RyhPA6b3xfwntf"
            - name: RAZORPAY_KEY_SECRET
              value: "eXu4Q5iotEpNQqZgqMM8dwW1"
            - name: JWT_SECRET
              value: "ankiya-jwt-secret-change-in-production"
            - name: SESSION_SECRET
              value: "ankiya-session-secret-change-in-production"
          resources:
            limits:
              memory: 512Mi
              cpu: 500m
---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: ankiya-cloud
spec:
  selector:
    app: backend
  ports:
    - port: 5000
      targetPort: 5000
  type: NodePort
"@

$backendYaml | kubectl apply -f -

Write-Host ""
Write-Host ">>> Checking deployment status..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
kubectl get pods -n ankiya-cloud

Write-Host ""
Write-Host ">>> Getting service URLs..." -ForegroundColor Yellow
kubectl get svc -n ankiya-cloud

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Build & Deploy Complete!                 " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
