# Remote state backend configuration.
# The empty s3 block is intentional — all values are injected at init time:
#   terraform init -backend-config=environments/<env>.backend.hcl
#
# This pattern allows the same Terraform code to manage dev, stg, and prod
# environments with fully isolated state files under different S3 keys.
#
# Each .backend.hcl file sets use_lockfile = true, which enables Terraform's
# native S3 state locking (no DynamoDB table required). Requires Terraform >= 1.10
# and S3 versioning enabled on the state bucket.

terraform {
  backend "s3" {}
}
