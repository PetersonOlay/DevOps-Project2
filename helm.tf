# Deploys the AWS Load Balancer Controller via the official eks-charts Helm repository.
# The controller watches Kubernetes Ingress and Service (type=LoadBalancer) resources
# and provisions ALBs and NLBs in AWS accordingly.
# Runs 2 replicas for high availability.
# depends_on vpc_cni and coredns because LBC pods need CNI networking and DNS to start.

resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.8.1"
  namespace  = "kube-system"

  # wait = true makes Terraform block until the Deployment is healthy before continuing.
  # timeout = 300 gives the controller up to 5 minutes to become ready.
  wait    = true
  timeout = 300

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  # Create the service account via Helm so the annotation below is applied at install time.
  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  # IRSA wiring: this annotation tells the EKS pod identity webhook to inject
  # temporary AWS credentials into LBC pods matching this service account.
  # The role ARN comes from module.lbc_irsa in iam.tf.
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

  # Two replicas ensure the controller survives a single node failure
  # without a gap in load balancer reconciliation.
  set {
    name  = "replicaCount"
    value = "2"
  }

  # The LBC must start after the cluster, the IRSA role, and the core networking
  # add-ons (vpc-cni for pod IPs, coredns for service name resolution).
  depends_on = [
    module.eks,
    module.lbc_irsa,
    aws_eks_addon.vpc_cni,
    aws_eks_addon.coredns,
  ]
}
