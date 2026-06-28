# Input variables for the VPC module.

variable "name_prefix" {
  description = "Prefix for VPC and subnet names (e.g. eks-prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets — one per AZ"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets — one per AZ"
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "Share a single NAT GW across all AZs (cost saving for non-prod)"
  type        = bool
}

variable "cluster_name" {
  description = "EKS cluster name — used in subnet tags required by the AWS Load Balancer Controller"
  type        = string
}

variable "common_tags" {
  description = "Tags applied to all resources in this module"
  type        = map(string)
}
