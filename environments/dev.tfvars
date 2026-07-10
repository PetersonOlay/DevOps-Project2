# Development environment — cost-optimized for low traffic and experimentation.
# Single NAT gateway, minimum node count, and short log retention to keep AWS costs low.

environment     = "dev"
cluster_name    = "eks-dev-cluster"
cluster_version = "1.35"

# Node group sizing — bumped from desired=1/max=3 to make room for
# kube-prometheus-stack (Prometheus, Grafana, Alertmanager, kube-state-metrics,
# node-exporter) alongside the existing DAM app pods.
node_instance_types     = ["t3.medium"]
node_group_min_size     = 1
node_group_max_size     = 4
node_group_desired_size = 2

# single_nat_gateway = true shares one NAT GW across all AZs, saving ~$100/month
# compared to the prod setting of one NAT GW per AZ.
single_nat_gateway = true

# 7-day retention keeps costs minimal; dev logs are rarely needed long-term
log_retention_days = 7

# DAM application — cost-optimised for dev
db_instance_class = "db.t3.micro"
db_multi_az       = false

# Monitoring stack — minimal footprint for dev
prometheus_retention_days = 3
prometheus_storage_size   = "5Gi"
grafana_storage_size      = "1Gi"
grafana_replicas          = 1
alertmanager_enabled      = false
