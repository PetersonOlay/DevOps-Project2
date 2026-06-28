# Outputs from bootstrap. After apply:
# (1) Copy state_bucket_name into the bucket field of environments/*.backend.hcl
# (2) Attach terraform_s3_backend_policy_arn to the IAM user/role used by your AWS profile

output "state_bucket_name" {
  description = "S3 bucket name — paste into environments/*.backend.hcl"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_s3_backend_policy_arn" {
  description = "Attach this IAM policy to the user/role that runs terraform apply"
  value       = aws_iam_policy.terraform_s3_backend.arn
}
