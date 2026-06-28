output "state_bucket_name" {
  description = "S3 bucket name — paste into environments/*.backend.hcl"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_s3_backend_policy_arn" {
  description = "Attach this IAM policy to the user/role that runs terraform apply"
  value       = aws_iam_policy.terraform_s3_backend.arn
}

output "next_steps" {
  description = "What to do after bootstrap apply completes"
  value       = <<-EOT

    ── Bootstrap complete. Follow these steps to deploy the platform. ──────────

    1. Set the state bucket in every backend config:
       Open each environments/*.backend.hcl and set:
         bucket = "${aws_s3_bucket.terraform_state.id}"

    2. Attach the backend IAM policy to your deploy role/user:
         aws iam attach-user-policy \
           --user-name <YOUR_IAM_USER> \
           --policy-arn ${aws_iam_policy.terraform_s3_backend.arn}

    3. Set the RDS password (never put this in a .tfvars file):
         export TF_VAR_db_password="<your-secure-password>"

    4. Initialise and deploy each environment from the repo root:

       # Dev
       terraform init -backend-config=environments/dev.backend.hcl
       terraform apply -var-file=environments/dev.tfvars

       # Staging
       terraform init -backend-config=environments/stg.backend.hcl -reconfigure
       terraform apply -var-file=environments/stg.tfvars

       # Production
       terraform init -backend-config=environments/prod.backend.hcl -reconfigure
       terraform apply -var-file=environments/prod.tfvars

    5. Build and push container images to ECR:
       aws ecr get-login-password --region us-east-1 | \
         docker login --username AWS --password-stdin \
         $(terraform output -raw ecr_repositories | jq -r '."dam/api"' | cut -d/ -f1)

       Then trigger the GitHub Actions workflow (dam-deploy.yml) or push to main.

    6. Deploy the Helm chart:
       helm upgrade --install dam ./helm/dam \
         -f helm/dam/values-dev.yaml \
         --namespace dam-dev --create-namespace

    ────────────────────────────────────────────────────────────────────────────
  EOT
}
