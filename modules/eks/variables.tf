# Input variables for the EKS module.

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the cluster is deployed"
  type        = string
}

variable "private_subnets" {
  description = "Private subnet IDs for the control plane and node group"
  type        = list(string)
}

variable "node_instance_types" {
  description = "EC2 instance types for the managed node group"
  type        = list(string)
}

variable "node_group_min_size" {
  description = "Minimum node count"
  type        = number
}

variable "node_group_max_size" {
  description = "Maximum node count"
  type        = number
}

variable "node_group_desired_size" {
  description = "Desired node count"
  type        = number
}

variable "environment" {
  description = "Deployment environment (dev, stg, prod)"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for node group names (e.g. eks-prod)"
  type        = string
}

variable "common_tags" {
  description = "Tags applied to all resources in this module"
  type        = map(string)
}
