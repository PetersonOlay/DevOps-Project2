# kube-prometheus-stack values, rendered via templatefile() from monitoring.tf.

grafana:
  service:
    type: LoadBalancer
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
      service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
      # Explicit — the AWS LBC defaults NLBs to "internal" otherwise.
      service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
  admin:
    existingSecret: "${grafana_existing_secret}"
    userKey: admin-user
    passwordKey: admin-password
  replicas: ${grafana_replicas}
  persistence:
    enabled: true
    storageClassName: gp2
    size: "${grafana_storage_size}"
  sidecar:
    dashboards:
      enabled: true
      label: grafana_dashboard
      labelValue: "1"
      searchNamespace: ALL
    datasources:
      enabled: true

alertmanager:
  enabled: ${alertmanager_enabled}

prometheus:
  prometheusSpec:
    retention: "${prometheus_retention_days}d"
    # Without these, the Prometheus Operator only selects ServiceMonitors/PodMonitors
    # carrying this release's own labels, silently ignoring the dam-api ServiceMonitor.
    serviceMonitorSelectorNilUsesHelmValues: false
    podMonitorSelectorNilUsesHelmValues: false
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp2
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: "${prometheus_storage_size}"
