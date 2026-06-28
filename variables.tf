# All input variables for the root module.
# Override defaults by passing an environment-specific file:
#   terraform apply -var-file=environments/<env>.tfvars

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# Validated to prevent typos. Controls resource naming via local.name_prefix
# and drives per-env differences (NAT GW count, log retention).
variable "environment" {
  description = "Deployment environment: dev, stg, or prod"
  type        = string

  validation {
    condition     = contains(["dev", "stg", "prod"], var.environment)
    error_message = "environment must be one of: dev, stg, prod"
  }
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.35"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# /19 gives 8190 usable IPs per subnet — sized for dense pod scheduling.
# The AWS VPC CNI plugin assigns a real VPC IP to every pod, so large subnets matter.
variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets — one per AZ (us-east-1a/b/c). EKS nodes live here."
  type        = list(string)
  default     = ["10.0.0.0/19", "10.0.32.0/19", "10.0.64.0/19"]
}

# /24 is sufficient — only NAT GW ENIs and load balancer ENIs land in public subnets.
variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets — one per AZ. NAT gateways and internet-facing load balancers land here."
  type        = list(string)
  default     = ["10.0.96.0/24", "10.0.97.0/24", "10.0.98.0/24"]
}

# Set to true in dev/stg.tfvars to reduce cost by ~$100/month (3 NAT GWs → 1).
# Prod keeps one NAT GW per AZ so that an AZ failure does not cut off outbound traffic.
variable "single_nat_gateway" {
  description = "Use a single shared NAT GW instead of one per AZ. Reduces cost for non-prod."
  type        = bool
  default     = false
}

variable "node_instance_types" {
  description = "EC2 instance types for the EKS managed node group"
  type        = list(string)
  default     = ["m5.large"]
}

# Exposed per environment — dev runs a single node, prod runs 2–5.
variable "node_group_min_size" {
  description = "Minimum node count in the managed node group"
  type        = number
  default     = 2
}

variable "node_group_max_size" {
  description = "Maximum node count in the managed node group"
  type        = number
  default     = 5
}

variable "node_group_desired_size" {
  description = "Desired node count in the managed node group"
  type        = number
  default     = 3
}

variable "log_retention_days" {
  description = "CloudWatch log group retention period in days (7 for dev, 30 for stg, 90 for prod)"
  type        = number
  default     = 30
}

# ── DAM application variables ─────────────────────────────────────────────────

variable "account_id" {
  description = "AWS account ID — used in globally unique resource names (S3 bucket, ECR)"
  type        = string
  default     = "395675597879"
}

variable "db_instance_class" {
  description = "RDS instance class (db.t3.micro for dev, db.t3.medium for stg/prod)"
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "dam"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "damadmin"
}

variable "db_password" {
  description = "PostgreSQL master password — supply via TF_VAR_db_password, never in tfvars"
  type        = string
  sensitive   = true
}

variable "db_multi_az" {
  description = "Enable RDS Multi-AZ standby (true for prod only)"
  type        = bool
  default     = false
}
