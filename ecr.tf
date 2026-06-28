# ECR private repositories — one per service.
# Images are encrypted with the shared KMS key and scanned on push.
# Lifecycle rules cap storage cost by removing old and untagged images.

locals {
  # Four repositories — one per Kubernetes workload
  ecr_services = [
    "dam/api",
    "dam/web",
    "dam/transform-worker",
    "dam/export-worker",
  ]

  # Lifecycle policy applied to every repository:
  #   - Untagged images older than 7 days are removed immediately
  #   - Tagged images are capped at the 10 most recent (sha-* and v* prefixes)
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

  # Scan every image pushed for known CVEs
  image_scanning_configuration {
    scan_on_push = true
  }

  # KMS-encrypt the image layers at rest
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
