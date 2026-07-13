{{- define "evalhub.namespace" -}}
{{ .Values.global.namespace | default "evaluation" }}
{{- end }}

{{- define "evalhub.labels" -}}
app.kubernetes.io/name: evalhub
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
