{{/*
Expand the chart name.
*/}}
{{- define "dam.name" -}}
{{- .Chart.Name }}
{{- end }}

{{/*
Common labels applied to every resource.
*/}}
{{- define "dam.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: dam-platform
{{- end }}

{{/*
Selector labels for a given component (pass component name as $.component).
*/}}
{{- define "dam.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .release }}
{{- end }}

{{/*
Image reference helper — combines registry, image name, and tag.
Usage: {{ include "dam.image" (dict "root" . "name" "dam/api") }}
*/}}
{{- define "dam.image" -}}
{{ .root.Values.image.registry }}/{{ .name }}:{{ .root.Values.image.tag }}
{{- end }}

{{/*
Namespace shorthand.
*/}}
{{- define "dam.namespace" -}}
{{ .Values.global.namespace }}
{{- end }}
