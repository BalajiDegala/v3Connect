{{- define "ankiya-cloud.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ankiya-cloud.fullname" -}}
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

{{- define "ankiya-cloud.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "ankiya-cloud.labels" -}}
helm.sh/chart: {{ include "ankiya-cloud.chart" . }}
{{ include "ankiya-cloud.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "ankiya-cloud.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ankiya-cloud.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Frontend labels */}}
{{- define "ankiya-cloud.frontend.labels" -}}
{{ include "ankiya-cloud.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "ankiya-cloud.frontend.selectorLabels" -}}
{{ include "ankiya-cloud.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/* Backend labels */}}
{{- define "ankiya-cloud.backend.labels" -}}
{{ include "ankiya-cloud.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "ankiya-cloud.backend.selectorLabels" -}}
{{ include "ankiya-cloud.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/* Database connection string */}}
{{- define "ankiya-cloud.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@{{ .Release.Name }}-postgresql:5432/$(POSTGRES_DB)?schema=public
{{- else }}
postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@{{ .Values.externalDatabase.host }}:{{ .Values.externalDatabase.port }}/{{ .Values.externalDatabase.database }}?schema=public
{{- end }}
{{- end }}

{{/* Redis connection string */}}
{{- define "ankiya-cloud.redisUrl" -}}
{{- if .Values.redis.enabled }}
redis://:$(REDIS_PASSWORD)@{{ .Release.Name }}-redis-master:6379
{{- else }}
redis://:$(REDIS_PASSWORD)@{{ .Values.externalRedis.host }}:{{ .Values.externalRedis.port }}
{{- end }}
{{- end }}

{{/* Keycloak URL */}}
{{- define "ankiya-cloud.keycloakUrl" -}}
{{- if .Values.keycloak.enabled }}
http://{{ .Release.Name }}-keycloak:8080
{{- else }}
{{ .Values.externalKeycloak.url }}
{{- end }}
{{- end }}

{{/* Image pull secrets */}}
{{- define "ankiya-cloud.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}
