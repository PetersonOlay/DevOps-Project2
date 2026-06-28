# EKS managed add-ons. AWS owns the lifecycle (install, update, delete) of these components,
# keeping them compatible with the cluster's Kubernetes version.
# most_recent = true resolves to the latest default version for the cluster's K8s version at apply time.
# All add-ons depend on the managed node group because they schedule pods that require worker nodes.

# CoreDNS — cluster-internal DNS server. Resolves Kubernetes service names
# (e.g. my-service.default.svc.cluster.local) for inter-pod communication.
resource "aws_eks_addon" "coredns" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "coredns"
  most_recent                 = true
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

# kube-proxy — maintains iptables/IPVS rules on each node that implement
# Service routing (ClusterIP, NodePort). Runs as a DaemonSet on every node.
resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "kube-proxy"
  most_recent                 = true
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

# AWS VPC CNI — assigns real VPC IP addresses to pods (one ENI secondary IP per pod).
# Required for pod-to-pod networking across nodes and for the Load Balancer Controller
# to route traffic directly to pod IPs without kube-proxy NAT.
resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "vpc-cni"
  most_recent                 = true
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  depends_on = [module.eks.eks_managed_node_groups]
}

# EBS CSI driver — enables PersistentVolumeClaims backed by EBS volumes.
# service_account_role_arn wires the IRSA role (from iam.tf) so the driver can call
# ec2:CreateVolume, ec2:AttachVolume, ec2:DeleteVolume, etc. without node-level IAM permissions.
resource "aws_eks_addon" "ebs_csi" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  most_recent                 = true
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"
  service_account_role_arn    = module.ebs_csi_irsa.iam_role_arn

  depends_on = [module.eks.eks_managed_node_groups]
}
