# Computed values derived from input variables.
# All resource names and tags reference these locals so naming stays consistent
# and changes only need to be made in one place.

locals {
  # Applied to every AWS resource via the provider default_tags block in main.tf
  # and via explicit tags = local.common_tags on modules that don't inherit provider tags.
  common_tags = {
    Project     = "eks-cluster"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Prefix for all resource names — produces e.g. "eks-prod-vpc", "eks-dev-general-ng".
  # Keeps resources from different environments clearly distinguishable in the AWS console.
  name_prefix = "eks-${var.environment}"
}
