# Ankiya Cloud Helm Chart

## Overview
This Helm chart deploys the complete Ankiya Cloud platform on Kubernetes.

## Prerequisites
- Kubernetes 1.28+
- Helm 3.12+
- PV provisioner support (for persistent storage)
- LoadBalancer support (MetalLB for bare metal)
- NGINX Ingress Controller
- cert-manager (optional, for automatic SSL)

## Installation

### Quick Start (Development)
```bash
# Add Bitnami repo for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install with default values
helm install ankiya ./ankiya-cloud -f values.yaml -f values-dev.yaml
```

### Production Deployment
```bash
# Create namespace first
kubectl create namespace ankiya-cloud

# Install dependencies
helm dependency update

# Deploy with production values
helm install ankiya ./ankiya-cloud \
  -f values.yaml \
  -f values-production.yaml \
  --namespace ankiya-cloud \
  --set secrets.razorpayKeyId=<YOUR_KEY> \
  --set secrets.razorpayKeySecret=<YOUR_SECRET> \
  --set secrets.smtpUser=<SMTP_USER> \
  --set secrets.smtpPass=<SMTP_PASSWORD>
```

### Upgrade
```bash
helm upgrade ankiya ./ankiya-cloud -f values.yaml -f values-production.yaml --namespace ankiya-cloud
```

### Uninstall
```bash
helm uninstall ankiya --namespace ankiya-cloud
```

## Configuration

### Key Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `global.domain` | Base domain for ingress | `ankiya.example.com` |
| `global.namespace` | Kubernetes namespace | `ankiya-cloud` |
| `frontend.replicaCount` | Frontend replicas | `2` |
| `backend.replicaCount` | Backend replicas | `3` |
| `postgresql.enabled` | Deploy PostgreSQL | `true` |
| `redis.enabled` | Deploy Redis | `true` |
| `keycloak.enabled` | Deploy Keycloak | `true` |
| `minio.enabled` | Deploy MinIO | `true` |
| `monitoring.enabled` | Deploy monitoring stack | `true` |
| `ingress.tls.enabled` | Enable TLS | `true` |
| `networkPolicies.enabled` | Enable network policies | `true` |

### External Services
If using external databases, set:
```yaml
postgresql:
  enabled: false
externalDatabase:
  host: your-db-host.com
  port: 5432
  database: ankiya_cloud
  username: ankiya_admin
  existingSecret: db-secret
  existingSecretPasswordKey: password
```

### Secrets
Create a separate secret or provide values:
```bash
helm install ankiya ./ankiya-cloud \
  --set secrets.razorpayKeyId=rzp_live_xxx \
  --set secrets.razorpayKeySecret=xxx \
  --set secrets.smtpHost=smtp.gmail.com \
  --set secrets.smtpUser=your@email.com \
  --set secrets.smtpPass=app_password
```

Or use existing secret:
```yaml
secrets:
  existingSecret: my-ankiya-secrets
```

## Components

### Frontend
- React SPA served via NGINX
- Horizontal Pod Autoscaling (2-6 replicas)
- Health checks configured

### Backend
- Node.js/Express API
- Horizontal Pod Autoscaling (3-10 replicas)
- Connected to all data services

### PostgreSQL
- Bitnami PostgreSQL chart
- Persistent storage
- Metrics export for Prometheus

### Redis
- Bitnami Redis chart
- Master with replicas
- Persistent storage

### Keycloak
- Bitnami Keycloak chart
- HA mode (2 replicas)
- Uses shared PostgreSQL

### MinIO
- Bitnami MinIO chart
- Object storage for logs
- Web console available

### Monitoring
- Prometheus for metrics
- Grafana for dashboards
- Loki for logs

## Troubleshooting

### Check deployment status
```bash
kubectl get pods -n ankiya-cloud
kubectl get svc -n ankiya-cloud
kubectl get ingress -n ankiya-cloud
```

### View logs
```bash
kubectl logs -f deployment/ankiya-backend -n ankiya-cloud
kubectl logs -f deployment/ankiya-frontend -n ankiya-cloud
```

### Debug certificates
```bash
kubectl get certificates -n ankiya-cloud
kubectl describe certificate ankiya-tls -n ankiya-cloud
```

## License
MIT
