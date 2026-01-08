# Backup/Restore Documentation

## Overview

This directory contains Kubernetes resources and scripts for PostgreSQL backup and restore operations.

## Backup Strategy

### Automated Backups

| Type | Schedule | Retention | Storage |
|------|----------|-----------|---------|
| Daily | 2:00 AM daily | 30 days | MinIO: `backups/postgresql/` |
| Weekly | 3:00 AM Sundays | 90 days | MinIO: `backups/postgresql/weekly/` |

### Manual Backups

Run anytime before major changes:
```powershell
.\backup-manual.ps1
```

## File Structure

```
14-backup/
├── backup-cronjob.yaml    # Automated daily/weekly backup jobs
├── backup-manual.ps1      # Manual backup script (Windows)
├── restore.ps1            # Restore script (Windows)
├── restore.sh             # Restore script (Linux/Mac)
└── README.md              # This file
```

## Installation

```bash
# Deploy backup CronJobs
kubectl apply -f backup-cronjob.yaml

# Verify CronJobs are created
kubectl get cronjobs -n ankiya-cloud
```

## Usage

### Create Manual Backup

```powershell
# PowerShell
cd k8s/14-backup
.\backup-manual.ps1

# Or with custom type
.\backup-manual.ps1 -BackupType "pre-migration"
```

### List Available Backups

```bash
# From MinIO pod
kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/
kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/weekly/
kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/manual/
```

### Restore from Backup

```powershell
# From local backup storage
.\restore.ps1 -BackupFile "backup_20240115_020000.sql.gz"

# From MinIO
.\restore.ps1 -BackupFile "backup_20240115_020000.sql.gz" -FromMinIO

# Dry run (preview only)
.\restore.ps1 -BackupFile "backup_20240115_020000.sql.gz" -DryRun
```

```bash
# Bash (Linux/Mac)
./restore.sh -f backup_20240115_020000.sql.gz
./restore.sh -f backup_20240115_020000.sql.gz --from-minio
./restore.sh -f backup_20240115_020000.sql.gz --dry-run
```

## Monitoring

### Check Backup Status

```bash
# List CronJobs
kubectl get cronjobs -n ankiya-cloud

# View recent backup jobs
kubectl get jobs -n ankiya-cloud -l app=postgresql-backup

# Check last backup logs
kubectl logs -n ankiya-cloud -l app=postgresql-backup --tail=100
```

### Verify Backup Integrity

```bash
# Check backup file sizes in MinIO
kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/ --summarize

# Test restore on staging
.\restore.ps1 -BackupFile "latest.sql.gz" -Namespace "ankiya-staging" -DryRun
```

## Disaster Recovery Procedures

### Full Database Recovery

1. **Stop backend services**
   ```bash
   kubectl scale deployment ankiya-backend --replicas=0 -n ankiya-cloud
   ```

2. **Identify the backup to restore**
   ```bash
   kubectl exec -n ankiya-cloud deploy/minio -- mc ls local/backups/postgresql/
   ```

3. **Run restore**
   ```powershell
   .\restore.ps1 -BackupFile "backup_YYYYMMDD_HHMMSS.sql.gz" -FromMinIO
   ```

4. **Verify database**
   ```bash
   kubectl exec -n ankiya-cloud deploy/postgresql -- psql -U ankiya_admin -d ankiya_cloud -c "SELECT count(*) FROM organizations;"
   ```

5. **Restart backend**
   ```bash
   kubectl scale deployment ankiya-backend --replicas=3 -n ankiya-cloud
   ```

6. **Verify application**
   - Check health endpoints
   - Verify login works
   - Check recent data

### Point-in-Time Recovery

For point-in-time recovery, you'll need:
1. Latest backup before the target time
2. PostgreSQL WAL archives (if configured)

Contact infrastructure team for WAL-based recovery.

## Configuration

### Change Backup Schedule

Edit `backup-cronjob.yaml`:
```yaml
spec:
  schedule: "0 2 * * *"  # Cron expression
```

### Change Retention

In the backup script, modify:
```bash
mc rm --older-than 30d minio/backups/postgresql/
```

### Increase Backup Storage

Edit backup PVC size:
```yaml
spec:
  resources:
    requests:
      storage: 20Gi  # Increase as needed
```

## Troubleshooting

### Backup Job Failing

```bash
# Check job status
kubectl describe job postgresql-backup-xxxxx -n ankiya-cloud

# Check pod logs
kubectl logs -n ankiya-cloud -l job-name=postgresql-backup-xxxxx
```

### Common Issues

1. **Database connection failed**
   - Check PostgreSQL service is running
   - Verify secrets are correct

2. **MinIO upload failed**
   - Check MinIO service is running
   - Verify bucket exists

3. **Disk space issues**
   - Increase backup PVC size
   - Run cleanup manually

### Manual Cleanup

```bash
# Remove old backups from MinIO
kubectl exec -n ankiya-cloud deploy/minio -- mc rm --older-than 7d local/backups/postgresql/

# Clean local backup storage
kubectl exec -n ankiya-cloud -it deploy/postgresql -- rm /backups/*.sql.gz
```
