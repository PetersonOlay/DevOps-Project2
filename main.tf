# Root module — provider configs and local module calls.
# All VPC and EKS logic lives in modules/vpc/ and modules/eks/ respectively.
# Supporting resources (add-ons, IAM, S3, CloudWatch, Helm) stay at root level.

# AWS provider: default_tags propagates Project, Environment, ManagedBy to every resource.
provider "aws" {
  region = var.region

  default_tags {
    tags = local.common_tags
  }
}

# Kubernetes and Helm providers use exec auth so the EKS token is fetched fresh on
# every API call — avoids the 15-minute token expiry during long applies.
# These providers require the cluster to exist; on first apply use:
#   terraform apply -var-file=environments/<env>.tfvars -target=module.vpc
#   terraform apply -var-file=environments/<env>.tfvars -target=module.eks
#   terraform apply -var-file=environments/<env>.tfvars
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
    }
  }
}

# ── VPC ───────────────────────────────────────────────────────────────────────
# Three public and three private subnets across us-east-1a/b/c.
module "vpc" {
  source = "./modules/vpc"

  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  private_subnet_cidrs = var.private_subnet_cidrs
  public_subnet_cidrs  = var.public_subnet_cidrs
  single_nat_gateway   = var.single_nat_gateway
  cluster_name         = var.cluster_name
  common_tags          = local.common_tags
}

# ── EKS Cluster + Node Group ──────────────────────────────────────────────────
# Control plane + one managed node group in private subnets.
# Add-ons are applied separately in addons.tf after IAM roles are ready.
module "eks" {
  source = "./modules/eks"

  cluster_name            = var.cluster_name
  cluster_version         = var.cluster_version
  vpc_id                  = module.vpc.vpc_id
  private_subnets         = module.vpc.private_subnets
  node_instance_types     = var.node_instance_types
  node_group_min_size     = var.node_group_min_size
  node_group_max_size     = var.node_group_max_size
  node_group_desired_size = var.node_group_desired_size
  environment             = var.environment
  name_prefix             = local.name_prefix
  common_tags             = local.common_tags
}
