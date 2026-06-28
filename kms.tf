# Single KMS key shared by RDS, S3, and ECR in this environment.
# Key rotation is enabled so AWS automatically generates new key material annually.

resource "aws_kms_key" "dam" {
  description             = "DAM platform encryption key — ${var.environment}"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

resource "aws_kms_alias" "dam" {
  name          = "alias/dam-${var.environment}"
  target_key_id = aws_kms_key.dam.key_id
}
