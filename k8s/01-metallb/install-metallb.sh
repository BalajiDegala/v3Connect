# Install MetalLB using kubectl
# Run this before applying the config

# MetalLB native manifests (v0.14.x)
# kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.5/config/manifests/metallb-native.yaml

# Or install using Helm:
# helm repo add metallb https://metallb.github.io/metallb
# helm install metallb metallb/metallb -n metallb-system --create-namespace

# Wait for MetalLB pods to be ready
# kubectl wait --namespace metallb-system --for=condition=ready pod --selector=app=metallb --timeout=120s

# Then apply the IP pool configuration
# kubectl apply -f metallb-config.yaml
