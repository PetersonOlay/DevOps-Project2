# Outputs consumed by root-level resources (addons.tf, iam.tf, helm.tf, outputs.tf).

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded cluster CA certificate"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN — used by iam.tf to create IRSA roles"
  value       = module.eks.oidc_provider_arn
}

output "eks_managed_node_groups" {
  description = "Managed node group map — used by addons.tf for depends_on"
  value       = module.eks.eks_managed_node_groups
}

output "node_security_group_id" {
  description = "Security group ID attached to EKS managed node group instances"
  value       = module.eks.node_security_group_id
}
