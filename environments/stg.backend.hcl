# Backend configuration for the staging environment.
# Replace 395675597879 with your 12-digit AWS account ID.
# Inject at init time: terraform init -backend-config=environments/stg.backend.hcl

bucket = "previse-eks-tfstate-395675597879-dam"

# Isolated state key — stg state never touches dev or prod state
key    = "eks/stg/terraform.tfstate"
region = "us-east-1"

encrypt = true

# S3 native state locking — writes a .tflock object instead of a DynamoDB record.
# No DynamoDB table needed. Requires Terraform >= 1.10 and bucket versioning enabled.
use_lockfile = true
