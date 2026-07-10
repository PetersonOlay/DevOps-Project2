# Production environment — full high availability, larger nodes, strict log retention.
# One NAT gateway per AZ so that an AZ failure does not cut off outbound traffic
# from nodes in the surviving AZs.

environment     = "prod"
cluster_name    = "eks-prod-cluster"
cluster_version = "1.35"

# Node group sizing — 2 minimum ensures at least one node survives an AZ failure;
# scales up to 5 under load via Cluster Autoscaler.
node_instance_types     = ["m5.large"]
node_group_min_size     = 2
node_group_max_size     = 5
node_group_desired_size = 3

# single_nat_gateway = false: prod uses one NAT GW per AZ (us-east-1a/b/c).
# This costs ~$100/month more than a single NAT GW but prevents an AZ outage
# from blocking outbound traffic (ECR pulls, API calls, etc.) for all nodes.
single_nat_gateway = false

# 90-day retention satisfies common compliance requirements (SOC2, PCI-DSS)
log_retention_days = 90

# DAM application — production RDS with Multi-AZ standby for HA
db_instance_class = "db.t3.medium"
db_multi_az       = true

# Monitoring stack — longer retention for compliance, HA Grafana
prometheus_retention_days = 30
prometheus_storage_size   = "50Gi"
grafana_storage_size      = "5Gi"
grafana_replicas          = 2
alertmanager_enabled      = true
