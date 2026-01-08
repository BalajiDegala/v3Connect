# Ankiya Cloud - Kubernetes Infrastructure

Complete production-ready Kubernetes deployment with Rancher, MetalLB, and full observability stack.

## 🏗️ Architecture Overview

```
                                    ┌─────────────────────────────────────────┐
                                    │           MetalLB (Load Balancer)       │
                                    └────────────────────┬────────────────────┘
                                                         │
                           ┌─────────────────────────────┼─────────────────────────────┐
                           │                             │                             │
                           ▼                             ▼                             ▼
                    ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
                    │  Frontend   │              │   Backend   │              │  Keycloak   │
                    │  (Nginx)    │              │  (Node.js)  │              │   (SSO)     │
                    │  2 replicas │              │  3 replicas │              │  2 replicas │
                    └──────┬──────┘              └──────┬──────┘              └──────┬──────┘
                           │                           │                             │
                           │         ┌─────────────────┼─────────────────┐           │
                           │         │                 │                 │           │
                           │         ▼                 ▼                 ▼           │
                           │   ┌───────────┐   ┌───────────┐   ┌───────────┐         │
                           │   │PostgreSQL │   │   Redis   │   │   MinIO   │         │
                           │   │(Database) │   │ (Cache)   │   │  (Logs)   │         │
                           │   │StatefulSet│   │ 3 replicas│   │           │         │
                           │   └───────────┘   └───────────┘   └───────────┘         │
                           │                                                         │
                           └─────────────────────────────────────────────────────────┘
                                                         │
                           ┌─────────────────────────────┼─────────────────────────────┐
                           │                             │                             │
                           ▼                             ▼                             ▼
                    ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
                    │ Prometheus  │              │   Grafana   │              │    Loki     │
                    │  (Metrics)  │◄────────────►│(Dashboards) │◄────────────►│   (Logs)    │
                    └─────────────┘              └─────────────┘              └─────────────┘
```

## 📁 Directory Structure

```
k8s/
├── 00-namespace/           # Namespace, RBAC, quotas
├── 01-metallb/            # MetalLB load balancer config
├── 02-storage/            # Storage classes & PVCs
├── 03-secrets/            # Secrets and ConfigMaps
├── 04-postgresql/         # PostgreSQL StatefulSet
├── 05-redis/              # Redis cluster (3 replicas)
├── 06-keycloak/           # Keycloak HA (2 replicas)
├── 07-minio/              # MinIO for logs storage
├── 08-backend/            # Backend Deployment + HPA
├── 09-frontend/           # Frontend Deployment
├── 10-ingress/            # NGINX Ingress rules
├── 11-monitoring/         # Prometheus, Grafana, Loki
├── 12-network-policies/   # Zero-trust networking
└── scripts/               # Deployment scripts
```

## 📋 Prerequisites

- **Kubernetes cluster** (1.28+) managed by Rancher
- **kubectl** configured and connected
- **Docker** (for building images)
- **MetalLB** compatible network (Layer 2 or BGP)
- **Storage provisioner** (local-path, NFS, or cloud)

## 🚀 Quick Start

### 1. Configure Secrets

Edit `k8s/03-secrets/secrets.yaml` with your credentials:

```bash
# Generate base64 encoded secrets
echo -n "your-password" | base64
```

**Required secrets:**
- PostgreSQL credentials
- Redis password
- Keycloak admin password
- Razorpay API keys
- SMTP credentials
- JWT/Session secrets

### 2. Configure MetalLB IP Range

Edit `k8s/01-metallb/metallb-config.yaml`:

```yaml
spec:
  addresses:
    - 192.168.1.240-192.168.1.250  # Update with your IP range
```

### 3. Update Domain Names

Edit `k8s/10-ingress/ingress.yaml`:

```yaml
- host: ankiya.example.com      # Your frontend domain
- host: api.ankiya.example.com  # Your API domain  
- host: auth.ankiya.example.com # Your Keycloak domain
```

### 4. Build Docker Images

```powershell
# Build and push images
cd k8s/scripts
.\build-images.ps1 -All -Push -Registry "your-registry.com/ankiya"
```

### 5. Deploy Everything

```powershell
# Windows
cd k8s/scripts
.\deploy.ps1 -Action deploy

# Linux/Mac
cd k8s/scripts
chmod +x deploy.sh
./deploy.sh deploy
```

### 6. Check Status

```powershell
.\deploy.ps1 -Action status
```

## 📊 Components

| Component | Type | Replicas | Resources | Purpose |
|-----------|------|----------|-----------|---------|
| PostgreSQL | StatefulSet | 1 | 2Gi RAM | Main database |
| Redis | StatefulSet | 3 | 1Gi RAM | Session/Cache |
| Keycloak | Deployment | 2 | 2Gi RAM | Authentication |
| MinIO | Deployment | 1 | 1Gi RAM | Log storage |
| Backend | Deployment | 3-10 | 1Gi RAM | API server |
| Frontend | Deployment | 2-6 | 256Mi RAM | Web UI |
| Prometheus | Deployment | 1 | 2Gi RAM | Metrics |
| Grafana | Deployment | 1 | 1Gi RAM | Dashboards |
| Loki | Deployment | 1 | 1Gi RAM | Log aggregation |

## 🔐 Security Features

- ✅ **Network Policies** - Zero-trust pod-to-pod communication
- ✅ **RBAC** - Role-based access control
- ✅ **Secrets Management** - Kubernetes secrets for credentials
- ✅ **Non-root containers** - All pods run as non-root
- ✅ **Resource Quotas** - Prevent resource exhaustion
- ✅ **Pod Security** - Restricted security contexts
- ✅ **TLS Ingress** - SSL/TLS termination (configure cert-manager)

## 📈 Monitoring

### Access Grafana

```bash
# Get Grafana LoadBalancer IP
kubectl get svc grafana-service -n ankiya-cloud

# Default credentials
Username: admin
Password: (from grafana-secrets)
```

### Pre-configured Dashboards

- **Ankiya Overview** - Service health, request rates
- **PostgreSQL** - Database metrics, connections
- **Redis** - Cache hit rates, memory usage
- **Node Exporter** - System metrics

### View Logs

Logs are collected by Promtail and stored in Loki:

1. Open Grafana
2. Go to Explore
3. Select "Loki" datasource
4. Query: `{namespace="ankiya-cloud"}`

## 🔄 Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend -n ankiya-cloud --replicas=5

# Scale frontend
kubectl scale deployment frontend -n ankiya-cloud --replicas=4
```

### Auto Scaling (HPA)

Backend and Frontend have HPA configured:

```yaml
# Backend: 3-10 replicas based on CPU/Memory
# Frontend: 2-6 replicas based on CPU
# Keycloak: 2-5 replicas based on CPU
```

## 🔧 Maintenance

### Database Backup

```bash
# Backup PostgreSQL
kubectl exec -n ankiya-cloud postgresql-0 -- pg_dump -U ankiya_admin ankiya_cloud > backup.sql

# Restore
kubectl exec -i -n ankiya-cloud postgresql-0 -- psql -U ankiya_admin ankiya_cloud < backup.sql
```

### Update Application

```bash
# Update backend
kubectl set image deployment/backend backend=ankiya/backend:v2.0.0 -n ankiya-cloud

# Update frontend
kubectl set image deployment/frontend frontend=ankiya/frontend:v2.0.0 -n ankiya-cloud
```

### Rolling Restart

```bash
kubectl rollout restart deployment/backend -n ankiya-cloud
kubectl rollout restart deployment/frontend -n ankiya-cloud
```

## 🗑️ Cleanup

```powershell
# Delete all resources
.\deploy.ps1 -Action delete
```

## 🆘 Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods -n ankiya-cloud

# View pod logs
kubectl logs -f <pod-name> -n ankiya-cloud

# Describe pod for events
kubectl describe pod <pod-name> -n ankiya-cloud
```

### Database connection issues

```bash
# Check PostgreSQL pod
kubectl logs postgresql-0 -n ankiya-cloud

# Test connection
kubectl exec -it postgresql-0 -n ankiya-cloud -- psql -U ankiya_admin -d ankiya_cloud
```

### MetalLB not assigning IPs

```bash
# Check MetalLB pods
kubectl get pods -n metallb-system

# Check speaker logs
kubectl logs -l app=metallb -n metallb-system
```

## 📝 Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_HOST | Redis service hostname |
| KEYCLOAK_URL | Keycloak internal URL |
| RAZORPAY_KEY_ID | Razorpay API key |
| SMTP_HOST | Email server |

### Frontend (Build-time)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Backend API URL |
| VITE_KEYCLOAK_URL | Keycloak public URL |
| VITE_RAZORPAY_KEY_ID | Razorpay public key |

## 📚 Additional Resources

- [Rancher Documentation](https://docs.ranchermanager.rancher.io/)
- [MetalLB Configuration](https://metallb.universe.tf/configuration/)
- [Keycloak Admin Guide](https://www.keycloak.org/docs/latest/server_admin/)
- [Prometheus Monitoring](https://prometheus.io/docs/)

---

**Ankiya Cloud** - Enterprise VFX Cloud Platform 🎬
