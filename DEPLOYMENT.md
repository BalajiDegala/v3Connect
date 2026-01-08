# Ankiya Cloud Platform - Deployment Guide

> Complete end-to-end deployment documentation for the Ankiya Cloud multi-tenant VFX studio management platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start (Local Development)](#quick-start-local-development)
4. [Architecture](#architecture)
5. [Component Setup](#component-setup)
6. [Configuration](#configuration)
7. [Production Deployment](#production-deployment)
8. [Monitoring & Observability](#monitoring--observability)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Ankiya Cloud is a B2B SaaS platform for VFX studios to:
- Register organizations and manage users
- Purchase cloud-based rendering machines
- Access machines via DCV (Desktop Cloud Visualization)
- Manage invoices and subscriptions

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Keycloak 24 (Multi-tenant SSO) |
| Payments | Razorpay |
| Storage | NFS (data), MinIO (logs) |
| Container | Docker, Kubernetes |
| Orchestration | Rancher / K3s |

---

## Prerequisites

### Development Machine

```
✅ Windows 10/11 or Linux
✅ Docker Desktop or Rancher Desktop
✅ Node.js 20+ LTS
✅ Git
✅ kubectl CLI
✅ Helm 3.12+
```

### Kubernetes Cluster

```
✅ Kubernetes 1.28+
✅ Ingress Controller (NGINX)
✅ Storage provisioner (local-path or Longhorn)
✅ LoadBalancer (MetalLB for bare-metal)
```

---

## Quick Start (Local Development)

### Step 1: Clone and Install

```powershell
# Clone repository
git clone https://github.com/your-org/ankiya-cloud.git
cd ankiya-cloud

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Deploy Infrastructure

```powershell
# Deploy core services (PostgreSQL, Redis, Keycloak, MinIO)
kubectl apply -f k8s/quick-start.yaml

# Wait for pods to be ready
kubectl get pods -n ankiya-cloud -w
```

### Step 3: Configure Environment

```powershell
# Copy environment template
cp backend/.env.example backend/.env

# Edit .env with your settings
# Key values:
# - DATABASE_URL: postgresql://ankiya_admin:ankiya_dev_password@localhost:5432/ankiya_cloud
# - KEYCLOAK_URL: http://localhost:32645
# - RAZORPAY_KEY_ID: Your test key (or leave empty for mock mode)
```

### Step 4: Configure Keycloak

```powershell
# Run configuration helper
.\k8s\scripts\configure-keycloak.ps1

# Or manually:
# 1. Open http://localhost:32645
# 2. Login: admin / admin_dev_password
# 3. Create realm "ankiya"
# 4. Create clients: ankiya-backend, ankiya-frontend
# 5. Create roles: admin, studio_owner, studio_user
# 6. Create test user
```

### Step 5: Run Development Server

```powershell
# Terminal 1: Port-forward PostgreSQL
kubectl port-forward svc/postgresql-service 5432:5432 -n ankiya-cloud

# Terminal 2: Run Prisma migrations
cd backend
npx prisma migrate dev
npx prisma generate

# Terminal 3: Start backend
cd backend
npm run dev

# Terminal 4: Start frontend
npm run dev
```

### Step 6: Access Application

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | Via Keycloak |
| Backend API | http://localhost:5000/api | - |
| Keycloak | http://localhost:32645 | admin / admin_dev_password |
| MinIO | http://localhost:31024 | minioadmin / minio_dev_password |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INGRESS (NGINX)                               │
│  ankiya.com → Frontend    api.ankiya.com → Backend               │
│  auth.ankiya.com → Keycloak                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   FRONTEND    │    │   BACKEND     │    │   KEYCLOAK    │
│   (React)     │───▶│   (Node.js)   │◀──▶│   (SSO)       │
│   Port: 80    │    │   Port: 5000  │    │   Port: 8080  │
└───────────────┘    └───────┬───────┘    └───────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  POSTGRESQL   │    │    REDIS      │    │    MINIO      │
│  Port: 5432   │    │  Port: 6379   │    │  Port: 9000   │
│  (Database)   │    │  (Cache)      │    │  (Logs)       │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Multi-Tenant Flow

```
Studio Registration → Keycloak Org → Users → Machine Purchase → 
Razorpay Payment → Admin Ticket → Machine Provisioning → 
DCV Credentials Email → User Access
```

---

## Component Setup

### PostgreSQL

```yaml
# Connection Details (Local Dev)
Host: localhost (port-forwarded) or postgresql-service (in-cluster)
Port: 5432
Database: ankiya_cloud
User: ankiya_admin
Password: ankiya_dev_password
```

**Run Migrations:**
```powershell
cd backend
npx prisma migrate dev --name init
```

---

## Migrating existing data to PostgreSQL (Prisma-based) 🔁
This section explains recommended approaches to migrate existing application data to a PostgreSQL database using Prisma. Choose the approach that fits your source database and data size.

### Overview
- Always take a full backup of source databases before migrating (pg_dump for Postgres; copy SQLite file, etc.).
- Test migration in a staging environment first.
- Use Prisma migrations to create the target schema and a scripted process to move row data where necessary.

---

### 1) Postgres → Postgres (recommended when possible)
If source is also PostgreSQL, prefer logical dump/restore:

```bash
# From source DB
pg_dump -Fc -h <OLD_HOST> -U <OLD_USER> -d <OLD_DB> -f dump_file.dump

# On target DB
pg_restore -h <NEW_HOST> -U <NEW_USER> -d <NEW_DB> dump_file.dump
```

After restore:
- Run Prisma migrations / generate client in target repo:
```bash
cd backend
export DATABASE_URL=postgresql://user:pass@new-host:5432/newdb
npx prisma migrate deploy
npx prisma generate
```
- Verify row counts and sequences (use SELECT setval if needed).

---

### 2) SQLite (or other engines) → Postgres using Prisma clients
When the source is SQLite (or a DB Prisma supports but not DB-to-DB compatible), use two Prisma clients and a script to copy data while handling type conversions and enums.

Steps:
1. Create a temporary Prisma schema for the legacy DB, e.g. `prisma/legacy.prisma` with a datasource pointing to the old DB and a generator with `output = "./generated/legacy"`.
2. Run `npx prisma generate --schema=prisma/legacy.prisma` to generate a LegacyClient.
3. Ensure your main `prisma/schema.prisma` is set up for Postgres and run migrations on the target:
```bash
export DATABASE_URL=postgresql://user:pass@new-host:5432/newdb
npx prisma migrate deploy
npx prisma generate
```
4. Create a migration script, e.g. `scripts/migrate-from-sqlite.ts` that imports both generated clients and copies data in batches.

Example (TypeScript, simplified):
```ts
// scripts/migrate-from-sqlite.ts
import { PrismaClient as NewClient } from '@prisma/client';
import { PrismaClient as LegacyClient } from '../prisma/generated/legacy';

const legacy = new LegacyClient();
const db = new NewClient();

async function migrate() {
  try {
    // Example: users
    const users = await legacy.user.findMany();
    for (const u of users) {
      await db.user.create({ data: {
        id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role as any
      }});
    }

    // Add other tables in dependency order (organizations -> shows -> machines -> orders -> invoices)

    console.log('Migration complete');
  } finally {
    await legacy.$disconnect();
    await db.$disconnect();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
```

Notes:
- Migrate in small batches (limit/offset) for large tables.
- Pay attention to foreign keys: migrate parent tables first.
- Convert types (e.g. decimals, enums, dates) explicitly.
- After data load, verify counts and run queries to ensure integrity.

---

### 3) CSV export/import (small/simple datasets)
You can export rows to CSV and use `psql` COPY to import:
```bash
# Export (sqlite or other)
sqlite3 old.db "SELECT * FROM users;" > users.csv

# Import
psql -h new-host -U new-user -d newdb -c "\copy users FROM 'users.csv' CSV HEADER;"
```
Verify constraints and update sequences.

---

### Post-migration checklist
- Run `npx prisma generate` to ensure clients match schema.
- Verify row counts and key constraints.
- Reset Postgres sequences where required, for each sequence:
```sql
SELECT setval(pg_get_serial_sequence('"table_name"','id'), MAX(id)) FROM "table_name";
```
- Rebuild indexes if necessary: `REINDEX TABLE table_name;`
- Run integration tests and smoke tests.

---

### Rollback & Backup
- Always create backups: `pg_dump` (Postgres) or file copy (SQLite).
- Test restore plan before migrating production.

---

If you'd like, I can create a starter migration script under `scripts/` for your current database (I can scaffold a `scripts/migrate-from-sqlite.ts` or a Postgres-to-Postgres restore checklist) and add it to `package.json` scripts for convenience.



### Redis

```yaml
# Connection Details
Host: redis-service
Port: 6379
Password: redis_dev_password
```

### Keycloak

**Realm Configuration:**
1. Create realm: `ankiya`
2. Create client `ankiya-backend`:
   - Client authentication: ON
   - Authorization: ON
   - Get client secret from Credentials tab
3. Create client `ankiya-frontend`:
   - Client authentication: OFF
   - Valid redirect URIs: `http://localhost:5173/*`
   - Web origins: `http://localhost:5173`
4. Create roles: `admin`, `studio_owner`, `studio_user`
5. Enable Organizations feature

### MinIO

```yaml
# Connection Details
API: http://minio-service:9000
Console: http://localhost:31024
User: minioadmin
Password: minio_dev_password
```

**Create Buckets:**
- `logs` - Application logs
- `backups` - Database backups

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://ankiya_admin:ankiya_dev_password@postgresql-service:5432/ankiya_cloud

# Keycloak
KEYCLOAK_URL=http://keycloak-service:8080
KEYCLOAK_REALM=ankiya
KEYCLOAK_CLIENT_ID=ankiya-backend
KEYCLOAK_CLIENT_SECRET=<from-keycloak>

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_MOCK_MODE=false  # Set true if no Razorpay account

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Security
JWT_SECRET=<32-char-random-string>
SESSION_SECRET=<32-char-random-string>
```

### Secrets Generation

```powershell
# Generate secure secrets
.\k8s\scripts\generate-secrets.ps1

# Apply to cluster
kubectl apply -f k8s/03-secrets/secrets-generated.yaml
```

---

## Production Deployment

### Step 1: Prepare Cluster

```powershell
# Install ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.0/cert-manager.yaml

# Install MetalLB (bare-metal only)
kubectl apply -f k8s/01-metallb/
```

### Step 2: Configure DNS

Point your domains to the cluster IP:
```
ankiya.example.com     → <CLUSTER-IP>
api.ankiya.example.com → <CLUSTER-IP>
auth.ankiya.example.com → <CLUSTER-IP>
```

### Step 3: Deploy with Helm

```powershell
cd k8s/helm/ankiya-cloud

# Update dependencies
helm dependency update

# Deploy
helm install ankiya . \
  -f values.yaml \
  -f values-production.yaml \
  -n ankiya-cloud \
  --create-namespace \
  --set global.domain=example.com \
  --set secrets.razorpayKeyId=rzp_live_xxx \
  --set secrets.razorpayKeySecret=xxx
```

### Step 4: Build and Push Images

```powershell
# Build images
docker build -t your-registry/ankiya-frontend:v1.0.0 -f Dockerfile .
docker build -t your-registry/ankiya-backend:v1.0.0 -f backend/Dockerfile ./backend

# Push to registry
docker push your-registry/ankiya-frontend:v1.0.0
docker push your-registry/ankiya-backend:v1.0.0
```

### Step 5: Configure SSL

```powershell
# Update domains in cert-manager.yaml
# Apply certificates
kubectl apply -f k8s/13-cert-manager/

# Verify
kubectl get certificates -n ankiya-cloud
```

---

## Monitoring & Observability

### Prometheus + Grafana

```powershell
# Deploy monitoring stack
kubectl apply -f k8s/11-monitoring/

# Access Grafana
kubectl port-forward svc/grafana-service 3000:3000 -n ankiya-cloud
# URL: http://localhost:3000
# Credentials: admin / <from-secret>
```

### Loki (Logs)

```powershell
# Logs are collected automatically by Promtail
# View in Grafana → Explore → Loki
```

### Key Metrics

- `http_request_duration_seconds` - API latency
- `nodejs_heap_used_bytes` - Memory usage
- `pg_stat_activity_count` - Database connections
- `redis_connected_clients` - Redis connections

---

## Backup & Recovery

### Automated Backups

```powershell
# Deploy backup CronJobs
kubectl apply -f k8s/14-backup/backup-cronjob.yaml

# Schedule:
# - Daily: 2:00 AM (30-day retention)
# - Weekly: Sunday 3:00 AM (90-day retention)
```

### Manual Backup

```powershell
.\k8s\14-backup\backup-manual.ps1
```

### Restore

```powershell
# List available backups
kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/

# Restore specific backup
.\k8s\14-backup\restore.ps1 -BackupFile "backup_20260101_020000.sql.gz" -FromMinIO
```

---

## Troubleshooting

### Common Issues

#### Pods stuck in ImagePullBackOff
```powershell
# Check image name and registry
kubectl describe pod <pod-name> -n ankiya-cloud

# For local images, ensure imagePullPolicy: Never
```

#### Database connection failed
```powershell
# Check PostgreSQL is running
kubectl get pods -n ankiya-cloud -l app=postgresql

# Check service
kubectl get svc postgresql-service -n ankiya-cloud

# Test connection
kubectl exec -it postgresql-0 -n ankiya-cloud -- psql -U ankiya_admin -d ankiya_cloud
```

#### Keycloak not accessible
```powershell
# Check pod status
kubectl logs keycloak-xxx -n ankiya-cloud

# Port-forward manually
kubectl port-forward svc/keycloak-service 8080:8080 -n ankiya-cloud
```

#### Redis connection refused
```powershell
# Check Redis is running
kubectl exec -it redis-0 -n ankiya-cloud -- redis-cli -a redis_dev_password ping
```

### Useful Commands

```powershell
# View all resources
kubectl get all -n ankiya-cloud

# View logs
kubectl logs -f deployment/backend -n ankiya-cloud

# Exec into pod
kubectl exec -it <pod-name> -n ankiya-cloud -- /bin/sh

# Restart deployment
kubectl rollout restart deployment/backend -n ankiya-cloud

# Check events
kubectl get events -n ankiya-cloud --sort-by='.lastTimestamp'
```

---

## Directory Structure

```
ConnectAnk/
├── src/                    # Frontend source
│   ├── app/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   └── pages/          # Page components
│   └── styles/             # CSS/Tailwind
├── backend/                # Backend source
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   └── services/       # Business logic
│   └── prisma/             # Database schema
├── k8s/                    # Kubernetes manifests
│   ├── 00-namespace/       # Namespace & RBAC
│   ├── 01-metallb/         # Load balancer
│   ├── 02-storage/         # PVCs
│   ├── 03-secrets/         # Secrets
│   ├── 04-postgresql/      # Database
│   ├── 05-redis/           # Cache
│   ├── 06-keycloak/        # Auth
│   ├── 07-minio/           # Object storage
│   ├── 08-backend/         # API deployment
│   ├── 09-frontend/        # Web deployment
│   ├── 10-ingress/         # Ingress rules
│   ├── 11-monitoring/      # Prometheus/Grafana
│   ├── 12-network-policies/# Security
│   ├── 13-cert-manager/    # SSL certificates
│   ├── 14-backup/          # Backup scripts
│   ├── helm/               # Helm charts
│   └── scripts/            # Deployment scripts
├── Dockerfile              # Frontend container
└── docker-compose.yml      # Local development
```

---

## Support

- **Documentation**: This file
- **Issues**: GitHub Issues
- **Email**: support@ankiyacloud.com

---

*Last Updated: January 2026*
