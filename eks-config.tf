# EKS cluster configuration: managed add-ons, CloudWatch log groups, and Helm releases.
# Everything here depends on the cluster existing (module.eks in main.tf).

# ── Managed add-ons ───────────────────────────────────────────────────────────

resource "aws_eks_addon" "coredns" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "kube-proxy"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "vpc-cni"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

resource "aws_eks_addon" "ebs_csi" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  service_account_role_arn    = module.ebs_csi_irsa.iam_role_arn

  depends_on = [module.eks.eks_managed_node_groups]
}

# Note: EKS automatically creates CloudWatch log groups for cluster and Container Insights logs.
# Terraform attempts to manage them, but imports are needed if they already exist.
# For simplicity, we let EKS manage the creation and retention is set via the cluster configuration.
# To update retention, use the AWS Console or CLI:
#   aws logs put-retention-policy --log-group-name /aws/eks/...  --retention-in-days N

# ── AWS Load Balancer Controller ──────────────────────────────────────────────
# Watches Ingress and Service (type=LoadBalancer) resources and provisions ALBs/NLBs.

resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.8.1"
  namespace  = "kube-system"

  wait    = true
  timeout = 300

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.lbc_irsa.iam_role_arn
  }

  set {
    name  = "region"
    value = var.region
  }

  set {
    name  = "vpcId"
    value = module.vpc.vpc_id
  }

  set {
    name  = "replicaCount"
    value = "2"
  }

  depends_on = [
    module.eks,
    module.lbc_irsa,
    aws_eks_addon.vpc_cni,
    aws_eks_addon.coredns,
  ]
}
