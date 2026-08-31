/**
 * Log noise/signal classification for the v1 observability panel.
 *
 * Three tiers: signal (green), warn (amber), noise (gray).
 * Filter ON → only signal + warn. Filter OFF → all lines (noise in gray).
 *
 * Sandbox rules: docs/demo/demo-scenario-logs.md § Sandbox panel highlight rules
 */

/** @typedef {"signal" | "warn" | "noise"} LineTier */

/**
 * @typedef {{ re: RegExp, tier: LineTier }} PatternRule
 */

/** Default focus filter per component tab (signal + warn only). */
export const DEFAULT_HIDE_NOISE = {
  sandbox: true,
  openclaw: true,
  openshell: true,
  nemo: true,
};

/** Highlight tiers when a line matches (first match wins). Everything else is noise. */
export const SIGNAL_PATTERNS = {
  sandbox: [
    { re: /OCSF NET:OPEN.*DENIED/i, tier: "warn" },
    { re: /OCSF HTTP:.*DENIED/i, tier: "warn" },
    { re: /no matching policy/i, tier: "warn" },
    { re: /sk-[a-zA-Z0-9]{8,}/i, tier: "warn" },
    {
      re: /OCSF NET:OPEN.*ALLOWED.*(maas|anthropic|openai|bedrock|redhatworkshops)/i,
      tier: "warn",
    },
    { re: /OCSF NET:OPEN.*DENIED.*inference\.local/i, tier: "warn" },
    { re: /OCSF NET:OPEN.*ALLOWED.*inference\.local/i, tier: "signal" },
    { re: /policy:mlflow_direct|mlflow\.[a-z0-9.-]+\.svc/i, tier: "signal" },
    { re: /routing proxy inference/i, tier: "signal" },
    { re: /OCSF API:INFERENCE/i, tier: "signal" },
    {
      re: /OCSF PROC:LAUNCH.*(echo|grep|cat|curl|\/bin\/sh|\/usr\/bin\/)/i,
      tier: "signal",
    },
    { re: /OCSF PROC:LAUNCH/i, tier: "signal" },
    { re: /OCSF CONFIG:ENABLED.*Landlock/i, tier: "signal" },
  ],
  openclaw: [
    { re: /sk-[a-zA-Z0-9]{8,}/i, tier: "warn" },
    { re: /key-[a-zA-Z0-9]{8,}/i, tier: "warn" },
    { re: /Permission denied|operation not permitted|cannot open/i, tier: "signal" },
    { re: /\/etc\/shadow/i, tier: "signal" },
    { re: /\[session tool exec\]/i, tier: "signal" },
    { re: /\[session tool result\]/i, tier: "signal" },
    { re: /\[session user\]/i, tier: "signal" },
    { re: /apiKey.*unused|"apiKey":\s*"unused"/i, tier: "signal" },
    { re: /LITELLM_API_KEY|apiKey|grep|echo/i, tier: "signal" },
    { re: /inference\.local|inference\/router/i, tier: "signal" },
    { re: /google\.com|curl/i, tier: "signal" },
    { re: /\bshell tool\b|tool call|exec tool/i, tier: "signal" },
    { re: /provider=inference|model-fetch/i, tier: "signal" },
    { re: /rail|guardrail|recon|refus/i, tier: "signal" },
  ],
  openshell: [
    { re: /maas-guardrailed/i, tier: "signal" },
    { re: /maas-direct/i, tier: "signal" },
    { re: /policy.*reload|inference route/i, tier: "signal" },
    { re: /routing proxy inference/i, tier: "signal" },
    { re: /DENIED|error/i, tier: "warn" },
  ],
  nemo: [
    { re: /rail|guardrail|block|refus|recon/i, tier: "signal" },
    { re: /error|fail/i, tier: "warn" },
  ],
};

/** Step-specific sandbox overrides applied after global patterns (first match wins). */
export const STEP_SANDBOX_OVERRIDES = {
  "C-pre": [
    { re: /OCSF NET:OPEN.*DENIED.*google\.com/i, tier: "warn" },
    { re: /OCSF HTTP:.*DENIED.*google\.com/i, tier: "warn" },
    { re: /google\.com.*no matching policy/i, tier: "warn" },
    { re: /OCSF PROC:LAUNCH.*\/usr\/bin\/curl/i, tier: "signal" },
  ],
  "C-post": [
    { re: /OCSF NET:OPEN.*ALLOWED.*google\.com/i, tier: "signal" },
    { re: /OCSF NET:CLOSE.*google\.com/i, tier: "signal" },
    { re: /OCSF HTTP:(GET|HEAD|POST).*google\.com/i, tier: "signal" },
    { re: /OCSF HTTP:.*google\.com.*(status|code)[=: ]\s*(200|301|302)/i, tier: "signal" },
    { re: /OCSF PROC:LAUNCH.*\/usr\/bin\/curl/i, tier: "signal" },
    { re: /demo_egress_google|demo-permissive-google/i, tier: "signal" },
  ],
};

/**
 * Per-step patterns downgraded to noise even when a global rule matched.
 * Warn tier is never suppressed (e.g. sk-… leaks stay amber).
 * @type {Record<string, Partial<Record<string, RegExp[]>>>}
 */
const SANDBOX_C_SUPPRESS = [
  /OCSF NET:OPEN.*ALLOWED.*inference\.local/i,
  /policy:mlflow_direct|mlflow\.[a-z0-9.-]+\.svc/i,
  /routing proxy inference/i,
  /OCSF API:INFERENCE/i,
  /OCSF CONFIG:(APPLYING|BUILT).*Landlock/i,
  /OCSF PROC:LAUNCH.*\bsleep\s*\(/i,
  /127\.0\.0\.1:18789/i,
  /GetInferenceBundle/i,
];

export const STEP_SUPPRESS = {
  B: {
    sandbox: [
      /OCSF CONFIG:(APPLYING|BUILT).*Landlock/i,
      /OCSF PROC:LAUNCH.*\bsleep\s*\(/i,
    ],
    openclaw: [
      /^--- /,
      /apiKey.*unused|"apiKey":\s*"unused"/i,
      /LITELLM_API_KEY|grep|echo/i,
      /TRACE_OK/i,
      /openclaw\.json.*apiKey|grep apiKey/i,
      /google\.com|curl/i,
      /rail|guardrail|recon|refus/i,
      /\[provider-transport-fetch\]|\[model-fetch\]/i,
      /\[agents\/tool-policy\]/i,
      /\[ws\]/i,
      /\[gateway\]/i,
      /inference\.local|inference\/router/i,
      /model-fetch|provider=inference/i,
      /oom_score_adj|\/proc\/self\/oom_score_adj/i,
    ],
  },
  "C-pre": {
    sandbox: SANDBOX_C_SUPPRESS,
  },
  "C-post": {
    sandbox: SANDBOX_C_SUPPRESS,
  },
};

/** Step B OpenClaw: only these patterns stay green after global classify + suppress. */
const STEP_B_OPENCLAW_ALLOW =
  /\/etc\/shadow|\[session tool exec\]|cat:\s*\/etc\/shadow:\s*Permission denied/i;

/** Shell exec stderr noise from sandbox init — not Landlock / Test B evidence. */
export const OPENCLAW_EXEC_OOM_NOISE =
  /\/bin\/bash:\s*\d+:\s*cannot create \/proc\/self\/oom_score_adj:\s*Permission denied/gi;

/**
 * Strip known sandbox exec stderr noise before classify/display.
 * @param {string} line
 */
export function sanitizeOpenClawDisplayLine(line) {
  return line.replace(OPENCLAW_EXEC_OOM_NOISE, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Presenter hints per narrative step (from narrative-data step ids).
 * @type {Record<string, { tab: string, terms: string[], note?: string }>}
 */
export const STEP_HINTS = {
  "0": {
    tab: "OpenShell",
    terms: ["maas-direct", "policy loaded", "inference route"],
  },
  A: {
    message:
      "The agent called the model via inference.local — OpenShell's router injects the API key outside the sandbox. No direct MaaS egress and no credentials in this log.",
  },
  B: {
    message:
      "Landlock blocked cat /etc/shadow at the filesystem layer — look for Permission denied in OpenClaw. Sandbox: green inference.local + mlflow_direct (model round-trip); ignore Landlock APPLYING/BUILT startup lines and PROC:LAUNCH sleep.",
  },
  "C-pre": {
    message:
      "Default deny egress — Sandbox OCSF should show amber DENIED google.com:443 and no matching policy. PROC:LAUNCH curl may still appear; the block is at the network policy layer.",
  },
  "C-post": {
    message:
      "After demo-allow-google-egress.sh, look for green ALLOWED google.com:443 and demo_egress_google policy. HTTP headers appear in OpenClaw session transcript and Control UI.",
  },
  "D-pre": {
    tab: "OpenClaw",
    terms: ["maas-direct", "inference.local", "recon"],
  },
  "D-post": {
    tab: "NeMo",
    terms: ["maas-guardrailed", "rail", "refus", "block"],
  },
  mlflow: {
    tab: "MLflow",
    terms: ["openclaw-tracing", "trace", "Request", "Response"],
  },
};

export const COMPONENT_LABELS = {
  openclaw: "OpenClaw",
  sandbox: "Sandbox",
  openshell: "OpenShell Gateway",
  nemo: "NeMo",
  mlflow: "MLflow",
};

/**
 * @param {string} componentId
 * @param {string} line
 * @param {string | null} [stepId]
 * @returns {LineTier}
 */
function isStepSuppressed(componentId, line, stepId) {
  const patterns = STEP_SUPPRESS[stepId]?.[componentId] ?? [];
  return patterns.some((re) => re.test(line));
}

export function classifyLine(componentId, line, stepId = null) {
  const signals = SIGNAL_PATTERNS[componentId] ?? [];
  let tier = null;
  for (const { re, tier: matched } of signals) {
    if (re.test(line)) {
      tier = matched;
      break;
    }
  }
  if (tier && stepId && tier !== "warn" && isStepSuppressed(componentId, line, stepId)) {
    return "noise";
  }
  if (
    componentId === "openclaw" &&
    stepId === "B" &&
    tier === "signal" &&
    !STEP_B_OPENCLAW_ALLOW.test(line)
  ) {
    return "noise";
  }
  if (componentId === "sandbox" && stepId && !tier) {
    const stepRules = STEP_SANDBOX_OVERRIDES[stepId] ?? [];
    for (const { re, tier: matched } of stepRules) {
      if (re.test(line)) return matched;
    }
  }
  return tier ?? "noise";
}

/**
 * @param {string} content
 * @param {string} componentId
 * @param {boolean} focusFilter
 * @param {string | null} [stepId]
 * @returns {{ visible: Array<{ line: string, tier: LineTier }>, stats: { signal: number, warn: number, hidden: number } }}
 */
export function processLogLines(content, componentId, focusFilter, stepId = null) {
  const lines = String(content || "")
    .replace(/\x00/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const stats = { signal: 0, warn: 0, hidden: 0 };
  const visible = [];

  for (const rawLine of lines) {
    const line =
      componentId === "openclaw" ? sanitizeOpenClawDisplayLine(rawLine) : rawLine;
    if (!line) {
      stats.hidden += 1;
      continue;
    }
    const tier = classifyLine(componentId, line, stepId);
    if (tier === "signal") stats.signal += 1;
    else if (tier === "warn") stats.warn += 1;
    else stats.hidden += 1;

    if (focusFilter && tier !== "signal" && tier !== "warn") continue;
    visible.push({ line, tier });
  }

  return { visible, stats };
}

/**
 * @param {string | null} stepId
 * @returns {string}
 */
export function formatStepHint(stepId) {
  if (!stepId || !STEP_HINTS[stepId]) {
    return "Navigate demo steps (← →) for scenario-specific search hints.";
  }
  const hint = STEP_HINTS[stepId];
  if (hint.message) return hint.message;
  const tab = COMPONENT_LABELS[hint.tab.toLowerCase()] ?? hint.tab;
  let text = `Step ${stepId} · ${tab} tab · Look for: ${hint.terms.join(", ")}`;
  if (hint.note) text += ` · ${hint.note}`;
  return text;
}

/** @param {string | null} stepId */
export function stepHintUsesCustomMessage(stepId) {
  return Boolean(stepId && STEP_HINTS[stepId]?.message);
}

/**
 * Normalize a raw log line for baseline snapshot/diff (before openclaw display sanitize).
 * @param {string} line
 * @returns {string}
 */
export function normalizeRawLogLine(line) {
  return String(line || "").replace(/\x00/g, "").trimEnd();
}

/**
 * Build a baseline Set from raw log content (lines present at Clear view activation).
 * @param {string} content
 * @returns {Set<string>}
 */
export function buildLineBaseline(content) {
  return new Set(
    String(content || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(normalizeRawLogLine)
      .filter((line) => line.length > 0)
  );
}

/**
 * Return content with baseline lines removed (clear-view filter).
 * @param {string} content
 * @param {Set<string> | null | undefined} baseline
 * @returns {string}
 */
export function filterContentSinceBaseline(content, baseline) {
  if (!baseline || baseline.size === 0) return String(content || "");
  const lines = String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const kept = [];
  for (const raw of lines) {
    const norm = normalizeRawLogLine(raw);
    if (!norm) continue;
    if (!baseline.has(norm)) kept.push(raw.trimEnd());
  }
  return kept.join("\n");
}

/**
 * Stable key for clear-view baseline (must match display identity in observability-panel).
 * @param {{ traceId?: string, requestId?: string, timestampMs?: number, status?: string, executionTimeMs?: number }} trace
 * @returns {string}
 */
export function traceBaselineKey(trace) {
  const t = trace ?? {};
  const id = t.traceId || t.requestId;
  if (id) return String(id);
  const ts = t.timestampMs;
  if (ts == null || ts === "") return "";
  const status = t.status ?? "";
  const exec = t.executionTimeMs ?? "";
  return `${ts}|${status}|${exec}`;
}

/**
 * Build a baseline Set from traces present at Clear view activation.
 * @param {Array<{ traceId?: string, requestId?: string, timestampMs?: number, status?: string, executionTimeMs?: number }>} traces
 * @returns {Set<string>}
 */
export function buildTraceBaseline(traces) {
  const baseline = new Set();
  for (const t of traces ?? []) {
    const key = traceBaselineKey(t);
    if (key) baseline.add(key);
  }
  return baseline;
}

/**
 * Return traces not present in the baseline trace-id set.
 * @param {Array<{ traceId?: string, requestId?: string, timestampMs?: number, status?: string, executionTimeMs?: number }>} traces
 * @param {Set<string> | null | undefined} baselineTraceIds
 * @returns {Array<{ traceId?: string, requestId?: string }>}
 */
export function filterTracesSinceBaseline(traces, baselineTraceIds) {
  if (!baselineTraceIds || baselineTraceIds.size === 0) return traces ?? [];
  return (traces ?? []).filter((t) => {
    const key = traceBaselineKey(t);
    if (!key) return false;
    return !baselineTraceIds.has(key);
  });
}
