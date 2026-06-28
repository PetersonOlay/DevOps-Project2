# S3 bucket for DAM asset storage.
# Layout: originals/, thumbnails/, exports/, temp/
# temp/ objects are deleted after 24 h by a lifecycle rule.
# All access is TLS-only and encrypted with the shared KMS key.

resource "aws_s3_bucket" "dam_assets" {
  bucket = "dam-assets-${var.account_id}-${var.environment}"
}

resource "aws_s3_bucket_versioning" "dam_assets" {
  bucket = aws_s3_bucket.dam_assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dam_assets" {
  bucket = aws_s3_bucket.dam_assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.dam.arn
    }
    # bucket_key_enabled reduces KMS API calls by generating a per-bucket data key
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "dam_assets" {
  bucket                  = aws_s3_bucket.dam_assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "dam_assets" {
  bucket = aws_s3_bucket.dam_assets.id

  # Remove temporary upload staging objects after 24 hours
  rule {
    id     = "expire-temp"
    status = "Enabled"
    filter { prefix = "temp/" }
    expiration { days = 1 }
  }

  # Expire old non-current versions after 90 days to control storage cost
  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}

# Deny any request that does not use TLS
resource "aws_s3_bucket_policy" "dam_assets" {
  bucket = aws_s3_bucket.dam_assets.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyNonTLS"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.dam_assets.arn,
        "${aws_s3_bucket.dam_assets.arn}/*"
      ]
      Condition = { Bool = { "aws:SecureTransport" = "false" } }
    }]
  })
}
