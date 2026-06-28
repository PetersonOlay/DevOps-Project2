# Provider version constraints for the root module.
# Terraform >= 1.10 is required for the S3 native lock file (use_lockfile = true) in the backend.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    # Primary provider for all AWS resources (VPC, EKS, IAM, S3, CloudWatch, etc.)
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Used to create Kubernetes resources (service accounts, namespaces) after the cluster exists
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }

    # Used to deploy the AWS Load Balancer Controller Helm chart
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }

    # Used internally by the EKS module for OIDC certificate thumbprint verification
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}
