# Manual Backup Script (PowerShell)
# Run this to create an immediate backup

param(
    [string]$Namespace = "ankiya-cloud",
    [string]$BackupType = "manual"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL Manual Backup                 " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$jobName = "manual-backup-$timestamp"

Write-Host ""
Write-Host ">>> Creating manual backup job: $jobName" -ForegroundColor Yellow

$backupJobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: $jobName
  namespace: $Namespace
  labels:
    app: postgresql-backup
    type: manual
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 3600
  template:
    metadata:
      labels:
        app: postgresql-backup
        type: manual
    spec:
      restartPolicy: OnFailure
      containers:
        - name: backup
          image: postgres:16-alpine
          command:
            - /bin/sh
            - -c
            - |
              set -e
              
              TIMESTAMP=`$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="${BackupType}_backup_`${TIMESTAMP}.sql.gz"
              
              echo "=== Manual Backup Started ==="
              echo "File: `${BACKUP_FILE}"
              
              mkdir -p /backups
              
              PGPASSWORD="`${POSTGRES_PASSWORD}" pg_dump \
                -h postgresql-service \
                -U "`${POSTGRES_USER}" \
                -d "`${POSTGRES_DB}" \
                --format=plain \
                --no-owner \
                --verbose \
                | gzip > "/backups/`${BACKUP_FILE}"
              
              BACKUP_SIZE=`$(du -h "/backups/`${BACKUP_FILE}" | cut -f1)
              echo "Backup size: `${BACKUP_SIZE}"
              
              # Upload to MinIO
              apk add --no-cache curl
              
              # Use MinIO client
              wget -q https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
              chmod +x /usr/local/bin/mc
              
              mc alias set minio http://minio-service:9000 "`${MINIO_ROOT_USER}" "`${MINIO_ROOT_PASSWORD}"
              mc cp "/backups/`${BACKUP_FILE}" minio/backups/postgresql/manual/
              
              echo "=== Backup Complete and Uploaded ==="
          env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: ankiya-secrets
                  key: POSTGRES_USER
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ankiya-secrets
                  key: POSTGRES_PASSWORD
            - name: POSTGRES_DB
              valueFrom:
                secretKeyRef:
                  name: ankiya-secrets
                  key: POSTGRES_DB
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: ankiya-secrets
                  key: MINIO_ROOT_USER
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ankiya-secrets
                  key: MINIO_ROOT_PASSWORD
          volumeMounts:
            - name: backup-storage
              mountPath: /backups
          resources:
            limits:
              cpu: 500m
              memory: 512Mi
      volumes:
        - name: backup-storage
          persistentVolumeClaim:
            claimName: backup-pvc
"@

$backupJobYaml | kubectl apply -f -

Write-Host ""
Write-Host ">>> Waiting for backup to complete..." -ForegroundColor Yellow
kubectl wait --for=condition=complete job/$jobName -n $Namespace --timeout=3600s

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Backup Completed Successfully!           " -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    
    Write-Host ""
    Write-Host ">>> Backup logs:" -ForegroundColor Cyan
    kubectl logs job/$jobName -n $Namespace
} else {
    Write-Host ""
    Write-Host "Backup may have failed. Check logs:" -ForegroundColor Red
    Write-Host "kubectl logs job/$jobName -n $Namespace" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "List available backups:" -ForegroundColor Cyan
Write-Host "kubectl exec -n $Namespace deploy/minio -- mc ls local/backups/postgresql/" -ForegroundColor White
