# DAM platform resources: encryption key, ECR repos, S3 asset bucket, and RDS database.

# ── KMS key ───────────────────────────────────────────────────────────────────
# Single key shared by RDS, S3, and ECR. AWS rotates the key material annually.

resource "aws_kms_key" "dam" {
  description             = "DAM platform encryption key — ${var.environment}"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

resource "aws_kms_alias" "dam" {
  name          = "alias/dam-${var.environment}"
  target_key_id = aws_kms_key.dam.key_id
}

# ── ECR repositories ──────────────────────────────────────────────────────────
# One private repo per service. Images are scanned on push and lifecycle rules
# cap storage by removing untagged images after 7 days and keeping the 10 most
# recent tagged images.

locals {
  ecr_services = [
    "dam/api",
    "dam/web",
    "dam/transform-worker",
    "dam/export-worker",
  ]

  ecr_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Remove untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep only the 10 most recent tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      }
    ]
  })
}

resource "aws_ecr_repository" "services" {
  for_each = toset(local.ecr_services)

  name                 = each.key
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.dam.arn
  }
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name
  policy     = local.ecr_lifecycle_policy
}

# ── S3 asset bucket ───────────────────────────────────────────────────────────
# Layout: originals/, thumbnails/, exports/, temp/
# temp/ objects expire after 24 h. All access is TLS-only.

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

  rule {
    id     = "expire-temp"
    status = "Enabled"
    filter { prefix = "temp/" }
    expiration { days = 1 }
  }

  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 90 }
  }
}

resource "aws_s3_bucket_cors_configuration" "dam_assets" {
  bucket = aws_s3_bucket.dam_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD", "DELETE"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

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

# ── RDS (PostgreSQL 15) ───────────────────────────────────────────────────────
# Private, encrypted PostgreSQL instance accessible only from EKS worker nodes.

resource "aws_db_subnet_group" "dam" {
  name       = "dam-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "dam-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "dam-rds-${var.environment}"
  description = "Allow PostgreSQL inbound from EKS node security group only"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "dam" {
  identifier = "dam-${var.environment}"

  engine         = "postgres"
  engine_version = "15.18"
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.dam.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  storage_type          = "gp3"
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.dam.arn

  multi_az = var.db_multi_az

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  copy_tags_to_snapshot   = true

  deletion_protection       = var.environment == "prod"
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "dam-prod-final" : null

  tags = {
    Name = "dam-${var.environment}"
  }
}

# Links the rds_s3 IAM role so aws_s3.query_export_to_s3() is available in PostgreSQL.
resource "aws_db_instance_role_association" "s3" {
  db_instance_identifier = aws_db_instance.dam.identifier
  feature_name           = "s3Export"
  role_arn               = aws_iam_role.rds_s3.arn
}
