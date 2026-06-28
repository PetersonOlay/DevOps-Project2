# Root module outputs. After terraform apply:
# - Run the configure_kubectl command to update your local kubeconfig.
# - Use the IRSA role ARNs to annotate Kubernetes service accounts that need AWS access.
# - Use the cluster endpoint and CA data in CI/CD pipelines that call kubectl directly.

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint — used by kubectl and CI/CD pipelines"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded cluster CA certificate — used to verify the API server TLS cert"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN — reference this when creating additional IRSA roles outside this module"
  value       = module.eks.oidc_provider_arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs — EKS nodes and internal load balancers live here"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs — internet-facing load balancers and NAT gateways live here"
  value       = module.vpc.public_subnets
}

output "lbc_irsa_role_arn" {
  description = "IRSA role ARN for the AWS Load Balancer Controller"
  value       = module.lbc_irsa.iam_role_arn
}

output "configure_kubectl" {
  description = "Run this command to configure kubectl to connect to the cluster"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

# ── DAM application outputs ───────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS instance hostname — use to build DATABASE_URL for Helm install"
  value       = aws_db_instance.dam.endpoint
}

output "rds_database_name" {
  description = "PostgreSQL database name"
  value       = aws_db_instance.dam.db_name
}

output "s3_bucket_name" {
  description = "DAM assets S3 bucket name"
  value       = aws_s3_bucket.dam_assets.bucket
}

output "ecr_repositories" {
  description = "ECR repository URIs keyed by service name"
  value       = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "dam_api_irsa_role_arn" {
  description = "IRSA role ARN — annotate the dam-api Kubernetes service account with this"
  value       = aws_iam_role.dam_api.arn
}

output "dam_worker_irsa_role_arn" {
  description = "IRSA role ARN — annotate the dam-transform-worker and dam-export-worker service accounts"
  value       = aws_iam_role.dam_worker.arn
}
