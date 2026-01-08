#!/bin/bash

# Ankiya Cloud - Full Deployment Script for Linux/Mac

set -e

NAMESPACE="ankiya-cloud"
ACTION="${1:-deploy}"
SKIP_METALLB="${SKIP_METALLB:-false}"
SKIP_MONITORING="${SKIP_MONITORING:-false}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}    Ankiya Cloud Kubernetes Deployment     ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}ERROR: kubectl not found. Please install kubectl.${NC}"
    exit 1
fi

# Check cluster connectivity
echo -e "${YELLOW}Checking cluster connectivity...${NC}"
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}ERROR: Cannot connect to Kubernetes cluster.${NC}"
    exit 1
fi
echo -e "${GREEN}Connected to cluster!${NC}"

deploy_component() {
    local name="$1"
    local path="$2"
    
    echo -e "\n${YELLOW}>>> Deploying $name...${NC}"
    
    if [ -d "$path" ] || [ -f "$path" ]; then
        kubectl apply -f "$path"
        echo -e "${GREEN}    $name deployed successfully!${NC}"
    else
        echo -e "${YELLOW}    WARNING: Path not found: $path${NC}"
    fi
}

wait_for_pod() {
    local label_selector="$1"
    local timeout="${2:-300}"
    
    echo -e "${YELLOW}Waiting for pods with label: $label_selector...${NC}"
    kubectl wait --for=condition=ready pod -l "$label_selector" -n "$NAMESPACE" --timeout="${timeout}s" || true
}

deploy_all() {
    echo -e "\n${CYAN}Starting full deployment...${NC}"
    
    # 1. Namespace
    deploy_component "Namespace" "00-namespace/"
    sleep 2
    
    # 2. MetalLB
    if [ "$SKIP_METALLB" != "true" ]; then
        echo -e "\n${YELLOW}>>> Installing MetalLB...${NC}"
        kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml
        echo -e "${YELLOW}Waiting for MetalLB to be ready...${NC}"
        sleep 30
        kubectl wait --namespace metallb-system --for=condition=ready pod --selector=app=metallb --timeout=120s || true
        deploy_component "MetalLB Config" "01-metallb/"
    fi
    
    # 3. Storage
    deploy_component "Storage Classes & PVCs" "02-storage/"
    
    # 4. Secrets & ConfigMaps
    deploy_component "Secrets & ConfigMaps" "03-secrets/"
    
    # 5. PostgreSQL
    deploy_component "PostgreSQL" "04-postgresql/postgresql.yaml"
    wait_for_pod "app=postgresql" 180
    
    # 6. Redis
    deploy_component "Redis" "05-redis/"
    wait_for_pod "app=redis" 120
    
    # 7. Keycloak
    deploy_component "Keycloak" "06-keycloak/"
    wait_for_pod "app=keycloak" 300
    
    # 8. MinIO
    deploy_component "MinIO" "07-minio/"
    wait_for_pod "app=minio" 120
    
    # Run MinIO init job
    sleep 30
    kubectl apply -f 07-minio/minio.yaml
    
    # 9. Backend
    echo -e "\n${YELLOW}>>> Running database migrations...${NC}"
    kubectl apply -f 08-backend/backend-migrate.yaml
    sleep 30
    
    deploy_component "Backend" "08-backend/backend.yaml"
    wait_for_pod "app=backend" 180
    
    # 10. Frontend
    deploy_component "Frontend" "09-frontend/"
    wait_for_pod "app=frontend" 120
    
    # 11. Ingress
    deploy_component "Ingress" "10-ingress/"
    
    # 12. Monitoring
    if [ "$SKIP_MONITORING" != "true" ]; then
        deploy_component "Prometheus" "11-monitoring/prometheus.yaml"
        deploy_component "Grafana" "11-monitoring/grafana.yaml"
        deploy_component "Loki" "11-monitoring/loki.yaml"
    fi
    
    # 13. Network Policies
    deploy_component "Network Policies" "12-network-policies/"
    
    echo -e "\n${GREEN}============================================${NC}"
    echo -e "${GREEN}    Deployment Complete!                   ${NC}"
    echo -e "${GREEN}============================================${NC}"
}

show_status() {
    echo -e "\n${CYAN}>>> Cluster Status${NC}"
    
    echo -e "\n${YELLOW}--- Pods ---${NC}"
    kubectl get pods -n "$NAMESPACE" -o wide
    
    echo -e "\n${YELLOW}--- Services ---${NC}"
    kubectl get svc -n "$NAMESPACE"
    
    echo -e "\n${YELLOW}--- Ingress ---${NC}"
    kubectl get ingress -n "$NAMESPACE"
    
    echo -e "\n${YELLOW}--- PVCs ---${NC}"
    kubectl get pvc -n "$NAMESPACE"
}

delete_all() {
    echo -e "${RED}WARNING: This will delete all Ankiya Cloud resources!${NC}"
    read -p "Type 'yes' to confirm: " confirm
    
    if [ "$confirm" = "yes" ]; then
        echo -e "${YELLOW}Deleting resources...${NC}"
        
        kubectl delete -f 12-network-policies/ --ignore-not-found || true
        kubectl delete -f 11-monitoring/ --ignore-not-found || true
        kubectl delete -f 10-ingress/ --ignore-not-found || true
        kubectl delete -f 09-frontend/ --ignore-not-found || true
        kubectl delete -f 08-backend/ --ignore-not-found || true
        kubectl delete -f 07-minio/ --ignore-not-found || true
        kubectl delete -f 06-keycloak/ --ignore-not-found || true
        kubectl delete -f 05-redis/ --ignore-not-found || true
        kubectl delete -f 04-postgresql/ --ignore-not-found || true
        kubectl delete -f 03-secrets/ --ignore-not-found || true
        kubectl delete -f 02-storage/ --ignore-not-found || true
        kubectl delete namespace "$NAMESPACE" --ignore-not-found || true
        
        echo -e "${GREEN}All resources deleted!${NC}"
    else
        echo -e "${YELLOW}Cancelled.${NC}"
    fi
}

# Main
case "$ACTION" in
    deploy)
        deploy_all
        ;;
    status)
        show_status
        ;;
    delete)
        delete_all
        ;;
    *)
        echo "Usage: ./deploy.sh [deploy|status|delete]"
        echo "Environment variables:"
        echo "  SKIP_METALLB=true     - Skip MetalLB installation"
        echo "  SKIP_MONITORING=true  - Skip monitoring stack"
        ;;
esac
