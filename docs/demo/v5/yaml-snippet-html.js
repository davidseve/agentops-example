/**
 * v5: render YAML panel snippet bodies for the instructions dock.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function resolveYamlPanelForStep(step) {
  return step?.yamlPanelV4 ?? step?.yamlPanelV3 ?? step?.yamlPanel ?? null;
}

export function buildYamlSnippetsHtml(yamlPanel) {
  if (!yamlPanel) return "";

  if (yamlPanel.columns?.length) {
    return `<div class="nr-yaml-diff nr-yaml-columns">${yamlPanel.columns
      .map((col) => {
        const colClass = col.className ? ` nr-yaml-col--${col.className}` : "";
        return `<div class="nr-yaml-col${colClass}">
        <h4>${escapeHtml(col.label)}</h4>
        <pre class="nr-yaml-pre">${escapeHtml(col.snippet)}</pre>
      </div>`;
      })
      .join("")}</div>`;
  }

  if (yamlPanel.before && yamlPanel.after) {
    return `<div class="nr-yaml-diff">
      <div class="nr-yaml-col before">
        <h4>Before (${escapeHtml(yamlPanel.fileBefore ?? "initial")})</h4>
        <pre class="nr-yaml-pre">${escapeHtml(yamlPanel.before)}</pre>
      </div>
      <div class="nr-yaml-col after">
        <h4>After (${escapeHtml(yamlPanel.fileAfter ?? "final")})</h4>
        <pre class="nr-yaml-pre">${escapeHtml(yamlPanel.after)}</pre>
      </div>
    </div>`;
  }

  if (yamlPanel.snippet) {
    return `<pre class="nr-yaml-pre">${escapeHtml(yamlPanel.snippet)}</pre>`;
  }

  return "";
}
