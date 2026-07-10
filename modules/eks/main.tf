# EKS module — wraps terraform-aws-modules/eks/aws.
# Creates the EKS control plane and a single general-purpose managed node group.
# Add-ons (CoreDNS, kube-proxy, vpc-cni, ebs-csi) are managed at the root level
# to avoid a circular dependency with the IRSA roles in iam.tf.

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  # All cluster resources go into private subnets — no direct inbound internet access.
  vpc_id                   = var.vpc_id
  subnet_ids               = var.private_subnets
  control_plane_subnet_ids = var.private_subnets

  # API_AND_CONFIG_MAP is backward-compatible: existing aws-auth ConfigMap entries
  # still work, and new access entries can be managed via the EKS API.
  authentication_mode = "API_AND_CONFIG_MAP"
  # Grants cluster-admin to the IAM principal running terraform apply.
  enable_cluster_creator_admin_permissions = true

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # All five log types are forwarded to the CloudWatch log group pre-created in cloudwatch.tf.
  cluster_enabled_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler",
  ]

  # Required for IRSA — creates the OIDC identity provider for the cluster.
  enable_irsa = true

  eks_managed_node_groups = {
    general = {
      name            = "${var.name_prefix}-general-ng"
      use_name_prefix = false

      instance_types = var.node_instance_types
      # AL2023 is the recommended AMI for EKS 1.35+.
      ami_type = "AL2023_x86_64_STANDARD"

      min_size     = var.node_group_min_size
      max_size     = var.node_group_max_size
      desired_size = var.node_group_desired_size

      # Nodes go into private subnets — no direct inbound internet access.
      subnet_ids = var.private_subnets
      # 50 GiB minimum: container images, ephemeral storage, and logs fill up quickly.
      disk_size = 50

      labels = {
        role        = "general"
        environment = var.environment
      }

      update_config = {
        # Replace at most 1/3 of nodes at a time during version updates.
        max_unavailable_percentage = 33
      }

      iam_role_additional_policies = {
        # SSM Session Manager: shell access to nodes without SSH or a bastion host.
        AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
        # ECR: nodes must be able to pull images from private ECR repositories.
        AmazonEC2ContainerRegistryReadOnly = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
      }

      tags = {
        # Required for Cluster Autoscaler to discover and scale this node group.
        "k8s.io/cluster-autoscaler/enabled"             = "true"
        "k8s.io/cluster-autoscaler/${var.cluster_name}" = "owned"
      }
    }
  }

  tags = var.common_tags
}
