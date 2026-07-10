# Cluster + application monitoring: kube-prometheus-stack (Prometheus, Grafana,
# Alertmanager, node-exporter, kube-state-metrics) plus a ServiceMonitor and
# dashboards for the DAM API. No IRSA role is needed here — none of these
# components call AWS APIs; PVC storage rides on the EBS CSI driver already
# installed in eks-config.tf.

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
  }

  depends_on = [module.eks]
}

# ── Grafana admin credentials ───────────────────────────────────────────────
# Generated, never hand-set. Stored in Secrets Manager for out-of-band retrieval
# (same dam-<env>-* naming family as the app secret), and mirrored into a
# Kubernetes Secret because the Helm chart consumes admin creds via
# grafana.admin.existingSecret, not from Secrets Manager directly.

resource "random_password" "grafana_admin" {
  length  = 24
  special = true
}

resource "aws_secretsmanager_secret" "grafana" {
  name = "dam-${var.environment}-grafana"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "grafana" {
  secret_id = aws_secretsmanager_secret.grafana.id
  secret_string = jsonencode({
    admin_user     = "admin"
    admin_password = random_password.grafana_admin.result
  })
}

resource "kubernetes_secret" "grafana_admin" {
  metadata {
    name      = "grafana-admin-credentials"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "admin-user"     = "admin"
    "admin-password" = random_password.grafana_admin.result
  }

  type = "Opaque"
}

# ── kube-prometheus-stack ───────────────────────────────────────────────────

resource "helm_release" "kube_prometheus_stack" {
  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "62.7.0"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name

  wait    = true
  timeout = 600

  values = [
    templatefile("${path.module}/monitoring/values.yaml.tpl", {
      grafana_existing_secret   = kubernetes_secret.grafana_admin.metadata[0].name
      grafana_replicas          = var.grafana_replicas
      grafana_storage_size      = var.grafana_storage_size
      alertmanager_enabled      = var.alertmanager_enabled
      prometheus_retention_days = var.prometheus_retention_days
      prometheus_storage_size   = var.prometheus_storage_size
    })
  ]

  depends_on = [
    module.eks,
    aws_eks_addon.ebs_csi,
    kubernetes_secret.grafana_admin,
  ]
}

# ── DAM API scrape target ───────────────────────────────────────────────────
# Requires the dam-<env> namespace (and dam-api Service) to already exist —
# that namespace is created by dam-deploy.yml, not Terraform. Apply this after
# the DAM app has been deployed at least once in this environment.

resource "kubernetes_manifest" "dam_api_servicemonitor" {
  manifest = {
    apiVersion = "monitoring.coreos.com/v1"
    kind       = "ServiceMonitor"
    metadata = {
      name      = "dam-api"
      namespace = "dam-${var.environment}"
      labels = {
        release = "kube-prometheus-stack"
      }
    }
    spec = {
      selector = {
        matchLabels = {
          app = "dam-api"
        }
      }
      namespaceSelector = {
        matchNames = ["dam-${var.environment}"]
      }
      endpoints = [
        {
          port     = "http"
          path     = "/metrics"
          interval = "30s"
        }
      ]
    }
  }

  depends_on = [helm_release.kube_prometheus_stack]
}

# ── Dashboards ───────────────────────────────────────────────────────────────
# Grafana's dashboard sidecar auto-imports any ConfigMap in this namespace
# labeled grafana_dashboard=1 — no manual import step required.

resource "kubernetes_config_map" "dashboard_platform" {
  metadata {
    name      = "grafana-dashboard-platform"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "platform.json" = file("${path.module}/monitoring/dashboards/platform.json")
  }
}

resource "kubernetes_config_map" "dashboard_dam_api" {
  metadata {
    name      = "grafana-dashboard-dam-api"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      grafana_dashboard = "1"
    }
  }

  data = {
    "dam-api.json" = file("${path.module}/monitoring/dashboards/dam-api.json")
  }
}
