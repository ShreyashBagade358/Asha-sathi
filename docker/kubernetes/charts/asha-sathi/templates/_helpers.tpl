{{/*
Expand the name of the chart.
*/}}
{{- define "asha-sathi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this
(by the DNS naming spec).
*/}}
{{- define "asha-sathi.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "asha-sathi.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "asha-sathi.labels" -}}
helm.sh/chart: {{ include "asha-sathi.chart" . }}
{{ include "asha-sathi.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.global.labels }}
{{- toYaml .Values.global.labels }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "asha-sathi.selectorLabels" -}}
app.kubernetes.io/name: {{ include "asha-sathi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Component selector labels (for per-deployment selectors, e.g. backend/web/ml)
Usage: {{ include "asha-sathi.componentSelectorLabels" (dict "context" . "component" "backend") }}
*/}}
{{- define "asha-sathi.componentSelectorLabels" -}}
app.kubernetes.io/name: {{ include "asha-sathi.name" .context }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Component labels (same as componentSelectorLabels plus standard managed-by)
*/}}
{{- define "asha-sathi.componentLabels" -}}
{{ include "asha-sathi.labels" .context }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Image repository helper honoring global.imageRegistry and per-component overrides.
Usage: {{ include "asha-sathi.image" (dict "context" . "image" .Values.backend.image) }}
*/}}
{{- define "asha-sathi.image" -}}
{{- $registry := .image.registry | default .context.Values.global.imageRegistry -}}
{{- $repository := .image.repository -}}
{{- $tag := .image.tag | default .context.Values.global.imageTag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}
{{- end }}

{{/*
Create the name of the configmap.
*/}}
{{- define "asha-sathi.configMapName" -}}
{{- printf "%s-config" (include "asha-sathi.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create the name of the secret.
*/}}
{{- define "asha-sathi.secretName" -}}
{{- printf "%s-secrets" (include "asha-sathi.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Return the proper image pull secrets
*/}}
{{- define "asha-sathi.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
  {{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Default env block sourced from the shared ConfigMap + Secret (backend uses it)
*/}}
{{- define "asha-sathi.backendEnv" -}}
{{- range .Values.backend.env }}
- name: {{ .name }}
  {{- if .value }}
  value: {{ .value | quote }}
  {{- else }}
  {{- with .valueFrom }}
  valueFrom:
    {{- if .configMapKeyRef }}
    configMapKeyRef:
      name: {{ .configMapKeyRef.name }}
      key: {{ .configMapKeyRef.key }}
    {{- end }}
    {{- if .secretKeyRef }}
    secretKeyRef:
      name: {{ .secretKeyRef.name }}
      key: {{ .secretKeyRef.key }}
    {{- end }}
  {{- end }}
  {{- end }}
{{- end }}
{{- end }}
