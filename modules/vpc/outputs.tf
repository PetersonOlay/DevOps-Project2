# Outputs consumed by the root module and the EKS module.

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "Private subnet IDs — EKS nodes live here"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs — internet-facing load balancers and NAT GWs live here"
  value       = module.vpc.public_subnets
}
