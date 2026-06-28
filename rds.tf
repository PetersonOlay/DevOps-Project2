# PostgreSQL 15 RDS instance in private subnets.
# Accessible only from EKS worker nodes (port 5432 via security group rule).
# Encryption uses the shared KMS key defined in kms.tf.

# ── Subnet group ──────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "dam" {
  name       = "dam-${var.environment}"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "dam-${var.environment}"
  }
}

# ── Security group ────────────────────────────────────────────────────────────

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

# ── RDS instance ──────────────────────────────────────────────────────────────

resource "aws_db_instance" "dam" {
  identifier = "dam-${var.environment}"

  # Engine
  engine         = "postgres"
  engine_version = "15.7"
  instance_class = var.db_instance_class

  # Credentials
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.dam.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Storage
  storage_type          = "gp3"
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.dam.arn

  # High availability — one NAT GW per AZ in prod, single in dev/stg
  multi_az = var.db_multi_az

  # Backups — longer retention in prod
  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"
  copy_tags_to_snapshot   = true

  # Deletion safety — protect prod from accidental destroy
  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"

  tags = {
    Name = "dam-${var.environment}"
  }
}
