# Staging environment — closer to production topology for pre-release validation.
# Uses production-sized nodes but a single NAT gateway to balance fidelity and cost.

environment     = "stg"
cluster_name    = "eks-stg-cluster"
cluster_version = "1.35"

# Node group sizing — 2 nodes for basic HA during testing
node_instance_types     = ["m5.large"]
node_group_min_size     = 2
node_group_max_size     = 4
node_group_desired_size = 2

# single_nat_gateway = true: staging does not need per-AZ NAT HA;
# a single NAT GW saves ~$66/month vs. three.
single_nat_gateway = true

# 30-day retention balances debugging needs with storage cost
log_retention_days = 30

# DAM application — production-sized instance, no Multi-AZ for stg cost savings
db_instance_class = "db.t3.medium"
db_multi_az       = false
