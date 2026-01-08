# PostgreSQL Restore Script (PowerShell)

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [switch]$FromMinIO = $false,
    [switch]$DryRun = $false,
    [string]$Namespace = "ankiya-cloud"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL Restore Script                " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if backup file exists or needs to be downloaded from MinIO
if ($FromMinIO) {
    Write-Host ">>> Downloading backup from MinIO..." -ForegroundColor Yellow
    
    # Create restore job to download from MinIO
    $downloadJobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: download-backup-$(Get-Date -Format 'yyyyMMddHHmmss')
  namespace: $Namespace
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      containers:
        - name: download
          image: minio/mc:latest
          command:
            - /bin/sh
            - -c
            - |
              mc alias set minio http://minio-service:9000 `$MINIO_ROOT_USER `$MINIO_ROOT_PASSWORD
              mc cp minio/backups/postgresql/$BackupFile /backups/
              echo "Download completed"
          env:
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
      volumes:
        - name: backup-storage
          persistentVolumeClaim:
            claimName: backup-pvc
"@

    if ($DryRun) {
        Write-Host "DRY RUN: Would create download job" -ForegroundColor Magenta
    } else {
        $downloadJobYaml | kubectl apply -f -
        Write-Host "Waiting for download to complete..." -ForegroundColor Yellow
        Start-Sleep -Seconds 30
    }
}

# Confirmation
Write-Host ""
Write-Host "⚠️  WARNING: This will RESTORE the database!" -ForegroundColor Red
Write-Host "   - Current data will be OVERWRITTEN" -ForegroundColor Red
Write-Host "   - Backup file: $BackupFile" -ForegroundColor Yellow
Write-Host ""

if (-not $DryRun) {
    $confirm = Read-Host "Type 'RESTORE' to confirm"
    if ($confirm -ne "RESTORE") {
        Write-Host "Restore cancelled." -ForegroundColor Red
        exit 1
    }
}

# Create restore job
$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$restoreJobName = "postgresql-restore-$timestamp"

Write-Host ""
Write-Host ">>> Creating restore job: $restoreJobName" -ForegroundColor Yellow

$restoreJobYaml = @"
apiVersion: batch/v1
kind: Job
metadata:
  name: $restoreJobName
  namespace: $Namespace
  labels:
    app: postgresql-restore
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 7200
  template:
    metadata:
      labels:
        app: postgresql-restore
    spec:
      restartPolicy: Never
      containers:
        - name: restore
          image: postgres:16-alpine
          command:
            - /bin/sh
            - -c
            - |
              set -e
              echo "=== PostgreSQL Restore Started ==="
              echo "Backup file: $BackupFile"
              
              # Check if backup file exists
              if [ ! -f "/backups/$BackupFile" ]; then
                echo "ERROR: Backup file not found: /backups/$BackupFile"
                ls -la /backups/
                exit 1
              fi
              
              echo "Backup file size: `$(du -h /backups/$BackupFile | cut -f1)"
              
              # Drop and recreate database
              echo "Dropping existing database..."
              PGPASSWORD="`${POSTGRES_PASSWORD}" psql \
                -h postgresql-service \
                -U "`${POSTGRES_USER}" \
                -d postgres \
                -c "DROP DATABASE IF EXISTS `${POSTGRES_DB};"
              
              echo "Creating fresh database..."
              PGPASSWORD="`${POSTGRES_PASSWORD}" psql \
                -h postgresql-service \
                -U "`${POSTGRES_USER}" \
                -d postgres \
                -c "CREATE DATABASE `${POSTGRES_DB};"
              
              # Restore backup
              echo "Restoring from backup..."
              if echo "$BackupFile" | grep -q "\.gz`$"; then
                gunzip -c "/backups/$BackupFile" | PGPASSWORD="`${POSTGRES_PASSWORD}" psql \
                  -h postgresql-service \
                  -U "`${POSTGRES_USER}" \
                  -d "`${POSTGRES_DB}" \
                  -v ON_ERROR_STOP=1
              else
                PGPASSWORD="`${POSTGRES_PASSWORD}" psql \
                  -h postgresql-service \
                  -U "`${POSTGRES_USER}" \
                  -d "`${POSTGRES_DB}" \
                  -v ON_ERROR_STOP=1 \
                  -f "/backups/$BackupFile"
              fi
              
              echo "=== Restore Completed Successfully ==="
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
          volumeMounts:
            - name: backup-storage
              mountPath: /backups
          resources:
            limits:
              cpu: 1000m
              memory: 1Gi
            requests:
              cpu: 200m
              memory: 256Mi
      volumes:
        - name: backup-storage
          persistentVolumeClaim:
            claimName: backup-pvc
"@

if ($DryRun) {
    Write-Host "DRY RUN: Would apply the following job:" -ForegroundColor Magenta
    Write-Host $restoreJobYaml
} else {
    $restoreJobYaml | kubectl apply -f -
    
    Write-Host ""
    Write-Host ">>> Restore job created. Monitoring progress..." -ForegroundColor Yellow
    Write-Host ""
    
    # Wait for job to complete
    kubectl wait --for=condition=complete job/$restoreJobName -n $Namespace --timeout=3600s
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Green
        Write-Host "  Restore Completed Successfully!          " -ForegroundColor Green
        Write-Host "============================================" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Red
        Write-Host "  Restore Failed!                          " -ForegroundColor Red
        Write-Host "============================================" -ForegroundColor Red
        Write-Host "Check logs: kubectl logs job/$restoreJobName -n $Namespace" -ForegroundColor Yellow
    }
    
    # Show logs
    Write-Host ""
    Write-Host ">>> Job logs:" -ForegroundColor Cyan
    kubectl logs job/$restoreJobName -n $Namespace
}

Write-Host ""
Write-Host "Post-restore steps:" -ForegroundColor Cyan
Write-Host "1. Verify data integrity" -ForegroundColor White
Write-Host "2. Restart backend pods: kubectl rollout restart deployment/ankiya-backend -n $Namespace" -ForegroundColor White
Write-Host "3. Run health checks on the application" -ForegroundColor White
