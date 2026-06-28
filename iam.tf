# IAM Roles for Service Accounts (IRSA).
# Each module below creates an IAM role with an OIDC trust policy that is scoped to
# a specific Kubernetes namespace:service-account pair. Pods running under that service
# account automatically receive temporary AWS credentials via a projected service account
# token — no instance-level IAM permissions or secret management needed.

# ── EBS CSI Driver ────────────────────────────────────────────────────────────
# attach_ebs_csi_policy attaches the AWS-managed AmazonEBSCSIDriverPolicy.
# Scoped to kube-system:ebs-csi-controller-sa — the service account the EBS CSI
# controller deployment runs as (created automatically by the EKS managed add-on).
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${var.cluster_name}-ebs-csi-driver"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.common_tags
}

# ── AWS Load Balancer Controller ──────────────────────────────────────────────
# attach_load_balancer_controller_policy attaches the AWSLoadBalancerControllerIAMPolicy
# which grants permissions to create/delete ALBs, NLBs, target groups, listeners, etc.
# Scoped to kube-system:aws-load-balancer-controller — the service account created
# by the Helm chart in helm.tf.
module "lbc_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name                              = "${var.cluster_name}-load-balancer-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.common_tags
}

# ── CloudWatch Agent ──────────────────────────────────────────────────────────
# CloudWatchAgentServerPolicy allows the CloudWatch agent DaemonSet to publish
# custom metrics and log events to the log groups created in cloudwatch.tf.
# Scoped to amazon-cloudwatch:cloudwatch-agent — the default SA for the CW agent.
module "cloudwatch_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${var.cluster_name}-cloudwatch-agent"

  role_policy_arns = {
    cloudwatch = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["amazon-cloudwatch:cloudwatch-agent"]
    }
  }

  tags = local.common_tags
}

# ── DAM application IRSA roles ────────────────────────────────────────────────
# Two roles for the DAM platform pods. Both use raw aws_iam_policy_document so
# the sub conditions can list multiple service accounts explicitly.

locals {
  # Extract the OIDC hostname from the provider ARN — no data source needed.
  # ARN format: arn:aws:iam::<acct>:oidc-provider/<host>
  dam_oidc_host = split("oidc-provider/", module.eks.oidc_provider_arn)[1]
}

# ── API role (dam-api pod) ────────────────────────────────────────────────────

data "aws_iam_policy_document" "dam_api_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.dam_oidc_host}:sub"
      values   = ["system:serviceaccount:dam:dam-api"]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.dam_oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dam_api" {
  name               = "dam-api-irsa-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.dam_api_assume.json
}

resource "aws_iam_policy" "dam_api_s3" {
  name        = "dam-api-s3-${var.environment}"
  description = "Allows the DAM API pod to read, write, and delete objects in the assets bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "BucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = aws_s3_bucket.dam_assets.arn
      },
      {
        Sid    = "ObjectReadWriteDelete"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.dam_assets.arn}/*"
      },
      {
        Sid      = "KMS"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = aws_kms_key.dam.arn
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = "arn:aws:secretsmanager:us-east-1:${var.account_id}:secret:dam-${var.environment}-*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "dam_api_s3" {
  role       = aws_iam_role.dam_api.name
  policy_arn = aws_iam_policy.dam_api_s3.arn
}

# ── Worker role (transform-worker + export-worker pods) ───────────────────────

data "aws_iam_policy_document" "dam_worker_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }

    # Both workers share one role — list both service accounts in the sub condition
    condition {
      test     = "StringEquals"
      variable = "${local.dam_oidc_host}:sub"
      values = [
        "system:serviceaccount:dam:dam-transform-worker",
        "system:serviceaccount:dam:dam-export-worker",
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.dam_oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "dam_worker" {
  name               = "dam-worker-irsa-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.dam_worker_assume.json
}

resource "aws_iam_policy" "dam_worker_s3" {
  name        = "dam-worker-s3-${var.environment}"
  description = "Allows worker pods to read and write objects in the assets bucket (no delete)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "BucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetBucketLocation"]
        Resource = aws_s3_bucket.dam_assets.arn
      },
      {
        Sid      = "ObjectReadWrite"
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.dam_assets.arn}/*"
      },
      {
        Sid      = "KMS"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = aws_kms_key.dam.arn
      },
      {
        Sid    = "SecretsManager"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
        Resource = "arn:aws:secretsmanager:us-east-1:${var.account_id}:secret:dam-${var.environment}-*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "dam_worker_s3" {
  role       = aws_iam_role.dam_worker.name
  policy_arn = aws_iam_policy.dam_worker_s3.arn
}

# ── RDS S3 role (s3Export feature) ───────────────────────────────────────────
# Allows PostgreSQL's aws_s3 extension to export query results directly to the
# DAM assets bucket via aws_s3.query_export_to_s3().

data "aws_iam_policy_document" "rds_s3_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_s3" {
  name               = "dam-rds-s3-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.rds_s3_assume.json
}

resource "aws_iam_policy" "rds_s3" {
  name = "dam-rds-s3-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:GetBucketLocation"]
        Resource = [
          aws_s3_bucket.dam_assets.arn,
          "${aws_s3_bucket.dam_assets.arn}/*"
        ]
      },
      {
        Sid      = "KMS"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt"]
        Resource = aws_kms_key.dam.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_s3" {
  role       = aws_iam_role.rds_s3.name
  policy_arn = aws_iam_policy.rds_s3.arn
}
