{{- define "agentops-openshell.fullname" -}}
{{ .Release.Name }}
{{- end }}

{{- define "agentops-openshell.sandboxSA" -}}
{{ .Values.openshift.scc.serviceAccount | default (printf "%s-sandbox" .Release.Name) }}
{{- end }}

{{- define "agentops-openshell.labels" -}}
app.kubernetes.io/name: openshell
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: agentops-demo
app.kubernetes.io/component: openshell
{{- end }}
