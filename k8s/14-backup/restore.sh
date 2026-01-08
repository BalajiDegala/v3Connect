#!/bin/bash
# PostgreSQL Restore Script (Bash)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parameters
BACKUP_FILE=""
FROM_MINIO=false
DRY_RUN=false
NAMESPACE="ankiya-cloud"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        --from-minio)
            FROM_MINIO=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 -f <backup_file> [--from-minio] [--dry-run] [-n namespace]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}ERROR: Backup file required. Use -f <filename>${NC}"
    exit 1
fi

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  PostgreSQL Restore Script                ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Download from MinIO if requested
if [ "$FROM_MINIO" = true ]; then
    echo -e "${YELLOW}>>> Downloading backup from MinIO...${NC}"
    
    DOWNLOAD_JOB_NAME="download-backup-$(date +%Y%m%d%H%M%S)"
    
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $DOWNLOAD_JOB_NAME
  namespace: $NAMESPACE
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
              mc alias set minio http://minio-service:9000 \$MINIO_ROOT_USER \$MINIO_ROOT_PASSWORD
              mc cp minio/backups/postgresql/$BACKUP_FILE /backups/
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
EOF
    
    echo "Waiting for download..."
    kubectl wait --for=condition=complete job/$DOWNLOAD_JOB_NAME -n $NAMESPACE --timeout=600s
fi

# Confirmation
echo ""
echo -e "${RED}⚠️  WARNING: This will RESTORE the database!${NC}"
echo -e "${RED}   - Current data will be OVERWRITTEN${NC}"
echo -e "${YELLOW}   - Backup file: $BACKUP_FILE${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
    read -p "Type 'RESTORE' to confirm: " confirm
    if [ "$confirm" != "RESTORE" ]; then
        echo -e "${RED}Restore cancelled.${NC}"
        exit 1
    fi
fi

# Create restore job
TIMESTAMP=$(date +%Y%m%d%H%M%S)
RESTORE_JOB_NAME="postgresql-restore-$TIMESTAMP"

echo ""
echo -e "${YELLOW}>>> Creating restore job: $RESTORE_JOB_NAME${NC}"

cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: $RESTORE_JOB_NAME
  namespace: $NAMESPACE
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
              echo "Backup file: $BACKUP_FILE"
              
              if [ ! -f "/backups/$BACKUP_FILE" ]; then
                echo "ERROR: Backup file not found"
                ls -la /backups/
                exit 1
              fi
              
              echo "Dropping existing database..."
              PGPASSWORD="\${POSTGRES_PASSWORD}" psql \
                -h postgresql-service \
                -U "\${POSTGRES_USER}" \
                -d postgres \
                -c "DROP DATABASE IF EXISTS \${POSTGRES_DB};"
              
              echo "Creating fresh database..."
              PGPASSWORD="\${POSTGRES_PASSWORD}" psql \
                -h postgresql-service \
                -U "\${POSTGRES_USER}" \
                -d postgres \
                -c "CREATE DATABASE \${POSTGRES_DB};"
              
              echo "Restoring from backup..."
              if echo "$BACKUP_FILE" | grep -q "\.gz\$"; then
                gunzip -c "/backups/$BACKUP_FILE" | PGPASSWORD="\${POSTGRES_PASSWORD}" psql \
                  -h postgresql-service \
                  -U "\${POSTGRES_USER}" \
                  -d "\${POSTGRES_DB}"
              else
                PGPASSWORD="\${POSTGRES_PASSWORD}" psql \
                  -h postgresql-service \
                  -U "\${POSTGRES_USER}" \
                  -d "\${POSTGRES_DB}" \
                  -f "/backups/$BACKUP_FILE"
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
      volumes:
        - name: backup-storage
          persistentVolumeClaim:
            claimName: backup-pvc
EOF

echo ""
echo -e "${YELLOW}>>> Monitoring restore progress...${NC}"
kubectl wait --for=condition=complete job/$RESTORE_JOB_NAME -n $NAMESPACE --timeout=3600s

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  Restore Completed Successfully!          ${NC}"
    echo -e "${GREEN}============================================${NC}"
else
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}  Restore Failed!                          ${NC}"
    echo -e "${RED}============================================${NC}"
    echo -e "${YELLOW}Check logs: kubectl logs job/$RESTORE_JOB_NAME -n $NAMESPACE${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}>>> Job logs:${NC}"
kubectl logs job/$RESTORE_JOB_NAME -n $NAMESPACE

echo ""
echo -e "${CYAN}Post-restore steps:${NC}"
echo "1. Verify data integrity"
echo "2. Restart backend pods: kubectl rollout restart deployment/ankiya-backend -n $NAMESPACE"
echo "3. Run health checks on the application"
