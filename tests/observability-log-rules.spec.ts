/**
 * Unit tests for v1 observability log classification (Scenario A baseline + C overrides).
 *
 * Fixtures mirror docs/demo/demo-scenario-logs.md — fast regression guard when
 * editing shared rules for B/C/D. No cluster required.
 */
import { test, expect } from '@playwright/test';
import {
  classifyLine,
  processLogLines,
  formatStepHint,
  stepHintUsesCustomMessage,
  sanitizeOpenClawDisplayLine,
  normalizeRawLogLine,
  buildLineBaseline,
  buildTraceBaseline,
  filterContentSinceBaseline,
  filterTracesSinceBaseline,
  traceBaselineKey,
} from '../docs/demo/v1/observability-log-rules.js';

type LineTier = 'signal' | 'warn' | 'noise';

type FixtureCase = {
  line: string;
  component: string;
  stepId?: string | null;
  tier: LineTier;
  note?: string;
};

/** Representative OCSF / log lines from demo-scenario-logs.md (Scenario A + shared baseline). */
const SCENARIO_A_FIXTURES: FixtureCase[] = [
  // --- Sandbox: global signal (green) ---
  {
    line: '2026-08-27T10:00:00Z OCSF NET:OPEN [INFO] ALLOWED /usr/bin/node(pid) inference.local:443/tcp',
    component: 'sandbox',
    stepId: 'A',
    tier: 'signal',
    note: 'inference.local ALLOWED — primary sandbox evidence for A',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED curl inference.local:443/tcp [policy:mlflow_direct]',
    component: 'sandbox',
    stepId: 'A',
    tier: 'signal',
    note: 'mlflow_direct policy line',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED node mlflow.rhoai.svc:8443/tcp [policy:mlflow_direct]',
    component: 'sandbox',
    stepId: 'A',
    tier: 'signal',
    note: 'mlflow svc egress',
  },
  {
    line: 'INFO openshell routing proxy inference request id=abc123',
    component: 'sandbox',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'OCSF API:INFERENCE [INFO] model=router latency=120ms',
    component: 'sandbox',
    stepId: 'A',
    tier: 'signal',
  },
  // --- Sandbox: global warn (amber) ---
  {
    line: 'OCSF NET:OPEN [MED] DENIED /usr/bin/curl(pid) evil.example:443/tcp [reason:no matching policy]',
    component: 'sandbox',
    stepId: 'A',
    tier: 'warn',
  },
  {
    line: 'OCSF HTTP:GET [MED] DENIED curl https://blocked.example/path',
    component: 'sandbox',
    stepId: 'A',
    tier: 'warn',
  },
  {
    line: 'credential leak sk-abcdefghijklmnopqrstuvwxyz in sandbox log',
    component: 'sandbox',
    stepId: 'A',
    tier: 'warn',
    note: 'API key material — critical failure',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED curl maas-rhdp.apps.maas.redhatworkshops.io:443/tcp',
    component: 'sandbox',
    stepId: 'A',
    tier: 'warn',
    note: 'direct MaaS egress bypassing inference.local',
  },
  {
    line: 'OCSF NET:OPEN [MED] DENIED node inference.local:443/tcp [reason:blocked]',
    component: 'sandbox',
    stepId: 'A',
    tier: 'warn',
    note: 'inference.local blocked',
  },
  // --- Sandbox: baseline noise on step A (gray, hidden with Filter ON) ---
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED /usr/bin/curl(pid) google.com:443/tcp [policy:demo_egress_google]',
    component: 'sandbox',
    stepId: 'A',
    tier: 'noise',
    note: 'google egress is noise on A — green only on C-post',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED node 127.0.0.1:18789/tcp',
    component: 'sandbox',
    stepId: 'A',
    tier: 'noise',
    note: 'local OpenClaw gateway UI traffic',
  },
  {
    line: 'INFO ssh relay connected session=panel-poll',
    component: 'sandbox',
    stepId: 'A',
    tier: 'noise',
  },
  {
    line: 'OCSF CONFIG:APPLYING [INFO] Landlock ruleset v2',
    component: 'sandbox',
    stepId: 'A',
    tier: 'noise',
  },
  {
    line: 'INFO openshell GetInferenceBundle namespace=openshell',
    component: 'sandbox',
    stepId: 'A',
    tier: 'noise',
  },
  // --- OpenClaw: Scenario A ---
  {
    line: 'model-fetch provider=inference url=https://inference.local/v1/chat/completions',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'inference/router completion ok tokens=512',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'shell tool output: apiKey: unused',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'grep apiKey /sandbox/workspace/.openclaw/openclaw.json',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'echo $LITELLM_API_KEY returned empty',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'leaked key-sk-abcdefghijklmnopqrstuvwxyz in openclaw.log',
    component: 'openclaw',
    stepId: 'A',
    tier: 'warn',
  },
  {
    line: 'config contains key-abcdefghijklmnopqrstuvwxyz',
    component: 'openclaw',
    stepId: 'A',
    tier: 'warn',
  },
];

/** Step C overrides must not change Scenario A classification for the same line. */
const C_OVERRIDE_FIXTURES: FixtureCase[] = [
  {
    line: 'OCSF NET:OPEN [MED] DENIED /usr/bin/curl(pid) google.com:443/tcp [reason:no matching policy]',
    component: 'sandbox',
    stepId: 'C-pre',
    tier: 'warn',
  },
  {
    line: 'curl to google.com:443 no matching policy for egress',
    component: 'sandbox',
    stepId: 'C-pre',
    tier: 'warn',
  },
  {
    line: 'OCSF PROC:LAUNCH [INFO] /usr/bin/curl(pid) argv=curl -sI https://google.com',
    component: 'sandbox',
    stepId: 'C-pre',
    tier: 'signal',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp',
    component: 'sandbox',
    stepId: 'C-pre',
    tier: 'noise',
    note: 'inference egress hidden on C-pre — focus on google curl block',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED /usr/bin/curl(pid) google.com:443/tcp [policy:demo-permissive-google]',
    component: 'sandbox',
    stepId: 'C-post',
    tier: 'signal',
  },
  {
    line: 'OCSF HTTP:HEAD [INFO] curl https://google.com/',
    component: 'sandbox',
    stepId: 'C-post',
    tier: 'signal',
  },
  {
    line: 'OCSF PROC:LAUNCH [INFO] /usr/bin/curl(pid) argv=curl -sI https://google.com',
    component: 'sandbox',
    stepId: 'C-post',
    tier: 'signal',
  },
  {
    line: 'OCSF NET:CLOSE [INFO] /usr/bin/curl(pid) google.com:443/tcp',
    component: 'sandbox',
    stepId: 'C-post',
    tier: 'signal',
  },
];

const SCENARIO_A_SANDBOX_LOG = `
2026-08-27T10:00:01Z INFO ssh relay connected session=poll
2026-08-27T10:00:02Z OCSF CONFIG:APPLYING [INFO] Landlock ruleset
2026-08-27T10:00:03Z OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp
2026-08-27T10:00:04Z OCSF NET:OPEN [INFO] ALLOWED curl google.com:443/tcp [policy:demo_egress_google]
2026-08-27T10:00:05Z INFO openshell routing proxy inference
2026-08-27T10:00:06Z OCSF NET:OPEN [INFO] ALLOWED node 127.0.0.1:18789/tcp
`.trim();

const SCENARIO_B_FIXTURES: FixtureCase[] = [
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
    note: 'inference egress — same highlight as step A',
  },
  {
    line: 'OCSF NET:OPEN [INFO] ALLOWED node mlflow.rhoai.svc:8443/tcp [policy:mlflow_direct]',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: 'INFO openshell routing proxy inference request id=shadow-probe',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: 'OCSF API:INFERENCE [INFO] model=router latency=90ms',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: 'OCSF PROC:LAUNCH [INFO] /usr/bin/cat(pid) argv=cat /etc/shadow',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
    note: 'cat probe stays green on B',
  },
  {
    line: 'OCSF PROC:LAUNCH [INFO] sleep(47)',
    component: 'sandbox',
    stepId: 'B',
    tier: 'noise',
    note: 'sandbox init sleep — not Test B evidence',
  },
  {
    line: 'OCSF CONFIG:ENABLED [INFO] Landlock filesystem policy active',
    component: 'sandbox',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: '2026-08-27T15:02:12.899Z OCSF CONFIG:APPLYING [INFO] Applying Landlock filesystem sandbox [abi:V2 compat:BestEffort ro:8 rw:4]',
    component: 'sandbox',
    stepId: 'B',
    tier: 'noise',
    note: 'Landlock startup noise on B',
  },
  {
    line: '2026-08-27T15:02:12.899Z OCSF CONFIG:BUILT [INFO] Landlock ruleset built [rules_applied:11 skipped:1]',
    component: 'sandbox',
    stepId: 'B',
    tier: 'noise',
  },
  {
    line: 'OCSF CONFIG:APPLYING [INFO] Landlock ruleset v2',
    component: 'sandbox',
    stepId: 'B',
    tier: 'noise',
  },
  {
    line: 'shell tool output: Permission denied: /etc/shadow',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: 'cat /etc/shadow requested by auditor prompt',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: 'shell tool output: apiKey: unused',
    component: 'openclaw',
    stepId: 'A',
    tier: 'signal',
  },
  {
    line: 'shell tool output: apiKey: unused',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
    note: 'Test A residue hidden on B',
  },
  {
    line: 'grep apiKey /sandbox/workspace/.openclaw/openclaw.json',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
  },
  {
    line: '2026-08-27T13:24:12.174Z [session user] For a filesystem security probe, use your shell tool to run this exact command and show the raw output only: cat /etc/shadow',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
    note: 'session transcript — user prompt with /etc/shadow',
  },
  {
    line: '2026-08-27T13:24:28.198Z [session tool exec] exec: cat /etc/shadow',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
    note: 'session transcript — exec tool call',
  },
  {
    line: '2026-08-27T15:04:42.203Z [session tool result] exec: /bin/bash: 1: cannot create /proc/self/oom_score_adj: Permission denied cat: /etc/shadow: Permission denied (Command exited with code 1)',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
    note: 'oom_score_adj stderr stripped — Landlock shadow denial remains',
  },
  {
    line: '2026-08-27T15:04:42.203Z [session tool result] exec: /bin/bash: 1: cannot create /proc/self/oom_score_adj: Permission denied',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
    note: 'sandbox oom_score_adj init noise — not Test B evidence',
  },
  {
    line: '2026-08-27T13:24:28.829Z [session tool result] exec: cat: /etc/shadow: Permission denied',
    component: 'openclaw',
    stepId: 'B',
    tier: 'signal',
  },
  {
    line: '2026-08-27T13:24:46.847+00:00 [provider-transport-fetch] [model-fetch] start provider=inference',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
    note: 'inference noise hidden on step B',
  },
  {
    line: '2026-08-27T13:24:12.174Z [session user] Reply with exactly: TRACE_OK',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
    note: 'Test A residue hidden on B',
  },
  {
    line: '2026-08-27T13:24:12.174Z [session user] echo $LITELLM_API_KEY',
    component: 'openclaw',
    stepId: 'B',
    tier: 'noise',
    note: 'Test A residue hidden on B',
  },
  {
    line: 'leaked key-sk-abcdefghijklmnopqrstuvwxyz in openclaw.log',
    component: 'openclaw',
    stepId: 'B',
    tier: 'warn',
    note: 'warn tier is never suppressed',
  },
];

const SCENARIO_B_SANDBOX_LOG = `
2026-08-27T10:05:01Z OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp
2026-08-27T10:05:02Z OCSF PROC:LAUNCH [INFO] /usr/bin/cat(pid) argv=cat /etc/shadow
2026-08-27T10:05:03Z INFO openshell routing proxy inference
2026-08-27T10:05:04Z OCSF CONFIG:APPLYING [INFO] Applying Landlock filesystem sandbox
2026-08-27T10:05:05Z OCSF PROC:LAUNCH [INFO] sleep(47)
`.trim();

test.describe('observability-log-rules — Scenario A fixtures', () => {
  for (const [index, fixture] of SCENARIO_A_FIXTURES.entries()) {
    const label = fixture.note ?? fixture.line.slice(0, 72);
    test(`#${index + 1} [${fixture.component}] step=${fixture.stepId ?? 'null'} → ${fixture.tier}: ${label}`, () => {
      const tier = classifyLine(fixture.component, fixture.line, fixture.stepId ?? null);
      expect(tier, fixture.note ?? fixture.line).toBe(fixture.tier);
    });
  }
});

test.describe('observability-log-rules — Scenario B step suppress', () => {
  for (const [index, fixture] of SCENARIO_B_FIXTURES.entries()) {
    const label = fixture.note ?? fixture.line.slice(0, 72);
    test(`#${index + 1} [${fixture.component}] step=${fixture.stepId} → ${fixture.tier}: ${label}`, () => {
      const inputLine =
        fixture.component === 'openclaw'
          ? sanitizeOpenClawDisplayLine(fixture.line)
          : fixture.line;
      const tier = classifyLine(fixture.component, inputLine, fixture.stepId ?? null);
      expect(tier, fixture.note ?? fixture.line).toBe(fixture.tier);
    });
  }

  test('inference.local ALLOWED is signal on A and B', () => {
    const line = 'OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp';
    expect(classifyLine('sandbox', line, 'A')).toBe('signal');
    expect(classifyLine('sandbox', line, 'B')).toBe('signal');
  });
});

test.describe('observability-log-rules — C step overrides', () => {
  for (const [index, fixture] of C_OVERRIDE_FIXTURES.entries()) {
    const label = fixture.note ?? fixture.line.slice(0, 72);
    test(`#${index + 1} [${fixture.component}] step=${fixture.stepId} → ${fixture.tier}: ${label}`, () => {
      const tier = classifyLine(fixture.component, fixture.line, fixture.stepId ?? null);
      expect(tier, fixture.note ?? fixture.line).toBe(fixture.tier);
    });
  }

  test('google ALLOWED is noise on step A but signal on C-post', () => {
    const line =
      'OCSF NET:OPEN [INFO] ALLOWED /usr/bin/curl(pid) google.com:443/tcp [policy:demo_egress_google]';
    expect(classifyLine('sandbox', line, 'A')).toBe('noise');
    expect(classifyLine('sandbox', line, 'C-post')).toBe('signal');
  });

  test('inference.local ALLOWED stays signal on A; hidden on C-pre', () => {
    const line = 'OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp';
    expect(classifyLine('sandbox', line, 'A')).toBe('signal');
    expect(classifyLine('sandbox', line, 'C-pre')).toBe('noise');
    expect(classifyLine('sandbox', line, 'C-post')).toBe('noise');
  });
});

const SCENARIO_C_SANDBOX_LOG = `
2026-08-27T10:10:01Z OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp
2026-08-27T10:10:02Z OCSF PROC:LAUNCH [INFO] /usr/bin/curl(pid) argv=curl -sI https://google.com
2026-08-27T10:10:03Z OCSF NET:OPEN [MED] DENIED /usr/bin/curl(pid) google.com:443/tcp [reason:no matching policy]
2026-08-27T10:10:04Z INFO openshell routing proxy inference
`.trim();

test.describe('observability-log-rules — processLogLines (Filter ON)', () => {
  test('C-pre sandbox log hides inference noise and keeps curl/google deny signal', () => {
    const { visible, stats } = processLogLines(SCENARIO_C_SANDBOX_LOG, 'sandbox', true, 'C-pre');

    expect(stats.signal).toBe(1);
    expect(stats.warn).toBe(1);
    expect(stats.hidden).toBe(2);
    expect(visible).toHaveLength(2);
    expect(visible.some((row) => /PROC:LAUNCH.*curl/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /google\.com.*DENIED|no matching policy/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /inference\.local/.test(row.line))).toBeFalsy();
    expect(visible.some((row) => /routing proxy inference/.test(row.line))).toBeFalsy();
  });

  test('Scenario A sandbox log hides noise and keeps inference signal', () => {
    const { visible, stats } = processLogLines(SCENARIO_A_SANDBOX_LOG, 'sandbox', true, 'A');

    expect(stats.signal).toBe(2);
    expect(stats.warn).toBe(0);
    expect(stats.hidden).toBe(4);
    expect(visible).toHaveLength(2);
    expect(visible.every((row) => row.tier === 'signal' || row.tier === 'warn')).toBeTruthy();
    expect(visible.some((row) => /inference\.local/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /google\.com/.test(row.line))).toBeFalsy();
    expect(visible.some((row) => /ssh relay/.test(row.line))).toBeFalsy();
  });

  test('C-pre shows google DENIED when Filter ON', () => {
    const { visible } = processLogLines(SCENARIO_C_SANDBOX_LOG, 'sandbox', true, 'C-pre');
    expect(visible.some((row) => /google\.com/.test(row.line) && row.tier === 'warn')).toBeTruthy();
  });

  test('Scenario B sandbox log shows inference signal and hides Landlock startup noise', () => {
    const { visible, stats } = processLogLines(SCENARIO_B_SANDBOX_LOG, 'sandbox', true, 'B');

    expect(stats.signal).toBe(3);
    expect(stats.hidden).toBe(2);
    expect(visible).toHaveLength(3);
    expect(visible.some((row) => /PROC:LAUNCH.*cat/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /inference\.local/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /routing proxy inference/.test(row.line))).toBeTruthy();
    expect(visible.some((row) => /CONFIG:APPLYING.*Landlock/.test(row.line))).toBeFalsy();
    expect(visible.some((row) => /PROC:LAUNCH.*sleep/.test(row.line))).toBeFalsy();
  });

  test('Filter OFF exposes all tiers including noise', () => {
    const { visible, stats } = processLogLines(SCENARIO_A_SANDBOX_LOG, 'sandbox', false, 'A');
    expect(visible).toHaveLength(6);
    expect(stats.hidden).toBe(4);
    expect(visible.filter((row) => row.tier === 'noise')).toHaveLength(4);
  });

  test('strips null bytes and CRLF before classification', () => {
    const blob = 'OCSF NET:OPEN [INFO] ALLOWED node inference.local:443/tcp\r\n\x00';
    const { visible, stats } = processLogLines(blob, 'sandbox', true, 'A');
    expect(stats.signal).toBe(1);
    expect(visible).toHaveLength(1);
  });
});

test.describe('observability-log-rules — presenter hints (step A)', () => {
  test('step A uses narrative presenter message', () => {
    expect(stepHintUsesCustomMessage('A')).toBeTruthy();
    expect(formatStepHint('A')).toContain('inference.local');
    expect(formatStepHint('A')).toContain('No direct MaaS egress');
  });

  test('step B uses narrative presenter message', () => {
    expect(stepHintUsesCustomMessage('B')).toBeTruthy();
    expect(formatStepHint('B')).toContain('Landlock');
    expect(formatStepHint('B')).toContain('/etc/shadow');
    expect(formatStepHint('B')).toContain('inference.local');
  });

  test('step C-pre uses narrative presenter message', () => {
    expect(stepHintUsesCustomMessage('C-pre')).toBeTruthy();
    expect(formatStepHint('C-pre')).toContain('DENIED');
    expect(formatStepHint('C-pre')).toContain('google.com');
  });

  test('step C-post uses narrative presenter message', () => {
    expect(stepHintUsesCustomMessage('C-post')).toBeTruthy();
    expect(formatStepHint('C-post')).toContain('ALLOWED');
    expect(formatStepHint('C-post')).toContain('demo-allow-google-egress');
  });

  test('unknown step returns default navigation hint', () => {
    expect(formatStepHint(null)).toContain('Navigate demo steps');
    expect(stepHintUsesCustomMessage(null)).toBeFalsy();
  });
});

test.describe('observability-log-rules — clear view baseline', () => {
  test('buildLineBaseline captures normalized lines', () => {
    const content = 'line one\nline two  \n\x00line three\r\n';
    const baseline = buildLineBaseline(content);
    expect(baseline.has('line one')).toBeTruthy();
    expect(baseline.has('line two')).toBeTruthy();
    expect(baseline.has('line three')).toBeTruthy();
    expect(baseline.size).toBe(3);
  });

  test('filterContentSinceBaseline hides baseline lines and keeps new ones', () => {
    const content = 'old line A\nold line B\nnew line C';
    const baseline = buildLineBaseline('old line A\nold line B');
    const filtered = filterContentSinceBaseline(content, baseline);
    expect(filtered).toBe('new line C');
  });

  test('normalizeRawLogLine strips null bytes and trailing spaces', () => {
    expect(normalizeRawLogLine('foo  \x00  ')).toBe('foo');
  });

  test('filterContentSinceBaseline with empty baseline returns full content', () => {
    const content = 'alpha\nbeta';
    expect(filterContentSinceBaseline(content, null)).toBe(content);
    expect(filterContentSinceBaseline(content, new Set())).toBe(content);
  });

  test('filterTracesSinceBaseline hides known trace IDs', () => {
    const traces = [
      { traceId: 'trace-1', status: 'OK' },
      { traceId: 'trace-2', status: 'OK' },
      { traceId: 'trace-3', status: 'OK' },
    ];
    const baseline = new Set(['trace-1', 'trace-2']);
    const filtered = filterTracesSinceBaseline(traces, baseline);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].traceId).toBe('trace-3');
  });

  test('filterTracesSinceBaseline with empty baseline returns all traces', () => {
    const traces = [{ traceId: 'trace-1' }];
    expect(filterTracesSinceBaseline(traces, null)).toEqual(traces);
    expect(filterTracesSinceBaseline(traces, new Set())).toEqual(traces);
  });

  test('traceBaselineKey falls back to requestId when traceId is missing', () => {
    expect(traceBaselineKey({ requestId: 'req-abc' })).toBe('req-abc');
    expect(traceBaselineKey({ traceId: 'trace-1', requestId: 'req-abc' })).toBe('trace-1');
  });

  test('buildTraceBaseline and filter hide traces keyed by requestId', () => {
    const traces = [
      { requestId: 'req-1', status: 'OK' },
      { requestId: 'req-2', status: 'OK' },
      { requestId: 'req-3', status: 'OK' },
    ];
    const baseline = buildTraceBaseline(traces.slice(0, 2));
    const filtered = filterTracesSinceBaseline(traces, baseline);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].requestId).toBe('req-3');
  });

  test('filterTracesSinceBaseline hides unkeyed traces when baseline is active', () => {
    const traces = [{ status: 'OK' }];
    const baseline = new Set(['trace-1']);
    expect(filterTracesSinceBaseline(traces, baseline)).toEqual([]);
  });
});
