# CloudWatch log groups for EKS control plane logs and Container Insights.
# Pre-creating these groups here gives Terraform ownership of the retention policy.
# If not pre-created, EKS auto-creates the control plane group with unlimited retention
# and Container Insights groups are created by the CloudWatch agent with no expiry.

# EKS writes all five enabled log types (api, audit, authenticator, controllerManager,
# scheduler) to this single group as separate log streams named per log type.
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${var.cluster_name}/cluster"
  retention_in_days = var.log_retention_days # 7 dev / 30 stg / 90 prod

  tags = local.common_tags
}

# Container Insights performance metrics — CPU, memory, disk, and network stats
# collected by the CloudWatch agent DaemonSet at the node and pod level.
resource "aws_cloudwatch_log_group" "container_insights_performance" {
  name              = "/aws/containerinsights/${var.cluster_name}/performance"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# Container Insights application logs — stdout/stderr from all containers,
# collected by Fluent Bit or the CloudWatch agent.
resource "aws_cloudwatch_log_group" "container_insights_application" {
  name              = "/aws/containerinsights/${var.cluster_name}/application"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# Container Insights dataplane logs — kubelet, kube-proxy, and containerd logs
# from the node-level components managed by the EKS data plane.
resource "aws_cloudwatch_log_group" "container_insights_dataplane" {
  name              = "/aws/containerinsights/${var.cluster_name}/dataplane"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}
