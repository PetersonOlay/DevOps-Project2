# Input variables for the bootstrap module.
# Kept minimal — only the region and a globally unique bucket name are needed.

variable "region" {
  description = "AWS region for the state bucket"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state (e.g. eks-tfstate-123456789012)"
  type        = string
}
