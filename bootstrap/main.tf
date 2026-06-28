# Bootstrap — run once before the main module.
# Creates the S3 state bucket and a least-privilege IAM policy for backend access.
# Uses a local backend intentionally — never migrate this state to the bucket it creates.

terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# State bucket. Versioning is required for S3 native lock file support (use_lockfile = true).
resource "aws_s3_bucket" "terraform_state" {
  bucket = var.state_bucket_name

  tags = {
    Name      = var.state_bucket_name
    ManagedBy = "Terraform"
    Purpose   = "Terraform State Backend"
  }
}

# Versioning must be enabled; Terraform's S3 lock file mechanism depends on S3 object
# versioning to detect concurrent writes and prevent state corruption.
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

# KMS encryption at rest for the state file.
# bucket_key_enabled = true reduces KMS API calls by ~99% by caching the data key at the bucket level.
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Block all public access — state files contain sensitive infrastructure data (IP ranges,
# ARNs, resource IDs) and must never be publicly readable.
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Least-privilege policy scoped to exactly the actions Terraform needs:
# list the bucket, and read/write/delete state objects and .tflock files.
# After bootstrap apply, attach the output ARN to the IAM user/role running Terraform.
resource "aws_iam_policy" "terraform_s3_backend" {
  name        = "TerraformS3BackendPolicy"
  description = "Least-privilege access for Terraform S3 state backend with native S3 locking"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StateBucketList"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketVersioning",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.terraform_state.arn
      },
      {
        Sid    = "StateObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        # Covers both *.tfstate and *.tflock objects
        Resource = "${aws_s3_bucket.terraform_state.arn}/*"
      }
    ]
  })
}
