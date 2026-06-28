# VPC module — wraps terraform-aws-modules/vpc/aws.
# Creates public and private subnets across three AZs in us-east-1.
# Public subnets host NAT gateways and internet-facing load balancers.
# Private subnets host EKS nodes — no direct inbound internet access.

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway = true
  # Mutually exclusive flags: prod uses one NAT GW per AZ; dev/stg share one.
  single_nat_gateway     = var.single_nat_gateway
  one_nat_gateway_per_az = !var.single_nat_gateway

  # Both required by EKS for API server endpoint and AWS service DNS resolution.
  enable_dns_hostnames = true
  enable_dns_support   = true

  # kubernetes.io/role/elb=1 tells the AWS LBC which subnets to use
  # for internet-facing ALBs and NLBs.
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  # kubernetes.io/role/internal-elb=1 tells the AWS LBC which subnets to use
  # for internal (VPC-only) load balancers.
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }

  # VPC-level cluster tag marks this VPC as usable by the cluster for ENI placement.
  tags = merge(var.common_tags, {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  })
}
