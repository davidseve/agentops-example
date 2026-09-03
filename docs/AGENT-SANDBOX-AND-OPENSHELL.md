# Agent Sandbox and OpenShell — How It Works

This document explains how OpenShell and the Agent Sandbox Operator work together to run AI agents (OpenClaw in our case) inside isolated, zero-trust sandbox environments on OpenShift.  It is written for engineers who want to understand the full stack — from the Kubernetes CRDs to the Linux kernel mechanisms that enforce isolation.

| Audience | What to read |
|----------|--------------|
| "Just tell me how to deploy" | [Quick reference](#quick-reference) at the bottom |
| "I want to understand the architecture" | Sections 1 – 5 |
| "I'm building my own agent" | Sections 3 – 4 and [Using your own agent image](#using-your-own-agent-image) |

---

## Table of Contents

1. [Key Concepts](#1-key-concepts)
2. [Infrastructure Stack](#2-infrastructure-stack)
3. [End-to-End Flow: From CLI to Running Agent](#3-end-to-end-flow-from-cli-to-running-agent)
4. [Inside the Sandbox Pod](#4-inside-the-sandbox-pod)
5. [The Launch Script Explained](#5-the-launch-script-explained)
6. [Version Pinning](#6-version-pinning)
7. [Using Your Own Agent Image](#7-using-your-own-agent-image)
8. [Validation and Security Verification](#8-validation-and-security-verification)
9. [Quick Reference](#9-quick-reference)
10. [Further Reading](#10-further-reading)

---

## 1. Key Concepts

### Agent Sandbox Operator

The [Red Hat build of Agent Sandbox](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/) is an OLM-managed operator (OpenShift sandboxed containers 1.13, Technology Preview) that provides:

- A `Sandbox` CRD (`sandboxes.agents.x-k8s.io`) — the Kubernetes-native way to declare a sandbox.
- A controller that watches `Sandbox` CRs and creates/manages pods.
- A sandbox router for traffic management.
- Extension CRDs: `SandboxTemplate`, `SandboxClaim`, `SandboxWarmPool`.

The operator lives in the `agent-sandbox-system` namespace and is installed via an OLM `Subscription` from the `redhat-operators` catalog (package `agent-sandbox-operator`, channel `preview-0.9`).

### OpenShell

[NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) is the orchestration layer that manages sandboxes.  It has two components:

| Component | Role |
|-----------|------|
| **`openshell` CLI** | Creates sandboxes, applies policies, executes commands inside them |
| **OpenShell Gateway** | A long-running server (StatefulSet on K8s) that talks to compute drivers (Podman, Docker, MicroVM, **Kubernetes**) |

On OpenShift, the Kubernetes driver translates OpenShell sandbox operations into `Sandbox` CRs that the Agent Sandbox Operator reconciles.

### Network Namespace (netns)

A Linux kernel isolation mechanism.  Each network namespace has its own network stack — interfaces, routing table, `127.0.0.1`, firewall rules.

OpenShell creates a dedicated netns inside the sandbox pod.  Processes running in that netns (like OpenClaw) have a **separate loopback** — a service listening on `127.0.0.1:18789` inside the sandbox netns is unreachable from the pod's main network namespace (and therefore unreachable via plain `oc exec`).

### Landlock

A [Linux Security Module](https://docs.kernel.org/userspace-api/landlock.html) for filesystem sandboxing.  Instead of relying solely on Unix permissions, a process declares rules like "I can read `/usr` and write `/tmp`; deny everything else."  OpenShell's supervisor configures Landlock from the sandbox policy file.

In our policy (`config/openshell/default.yaml`):

```yaml
filesystem_policy:
  read_only: [/usr, /lib, /proc, /dev/urandom, /app, /etc, /var/log, /sandbox]
  read_write: [/sandbox/workspace, /tmp, /dev/null, /home]

landlock:
  compatibility: best_effort
```

`best_effort` means: if the kernel lacks Landlock support (common inside older containers), degrade gracefully with a warning instead of failing.

### Privileged SCC — The Intentional Paradox

OpenShift's default `restricted-v2` SCC blocks capabilities like `CAP_SYS_ADMIN` and `CAP_NET_ADMIN`.  However, the OpenShell supervisor **needs** those capabilities to build the restrictive environment:

| Capability | Used for |
|------------|----------|
| `CAP_NET_ADMIN` | Installing **nftables** rules (network egress allow/deny) |
| `CAP_SYS_ADMIN` | Creating **network namespaces**, configuring **Landlock** |
| `/proc`, `/sys` access | Process identity for per-binary network policy |

The `privileged` SCC is granted **only** to the `openshell-sandbox` ServiceAccount — the gateway pod continues to run under `restricted-v2`. This is declared in `deploy/helm/openshell/templates/scc-rolebinding.yaml`, gated by `openshift.scc.privilegedSandbox: true`.

**The paradox is intentional:** elevated pod-level privileges are required to *create* the restrictive sandbox that constrains agent processes.  See [ADR-0006](adr/0003-openshell-deployment-on-openshift.md) for the full rationale.

---

## 2. Infrastructure Stack

### Deployment YAML Locations

| Component | Files | Install command |
|-----------|-------|-----------------|
| Agent Sandbox Operator (OLM) | `deploy/helm/operators/templates/agent-sandbox-namespace.yaml` (Namespace + OperatorGroup), `deploy/helm/operators/templates/agent-sandbox-subscription.yaml` (Subscription), `deploy/helm/operators/values.yaml` (config) | `make -C deploy deploy-operators` |
| OpenShell Gateway | `deploy/helm/openshell/` (wrapper chart with upstream OCI subchart dependency) | `make -C deploy deploy-openshell` |
| SCC RoleBinding | `deploy/helm/openshell/templates/scc-rolebinding.yaml` | Included in `deploy-openshell` |
| OpenClaw UI Proxy | `deploy/helm/openclaw-ui-proxy/` (nginx mTLS bridge) | `make -C deploy deploy-openclaw-ui-proxy` |
| Sandbox Policy (default / CI) | `config/openshell/default.yaml` | Applied at `sandbox create` time for `cluster-lifecycle full` |
| Sandbox Policy (google egress) | `config/openshell/google-egress.yaml` | Live Change 1 via `./scripts/demo-allow-google-egress.sh` |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenShift Cluster                           │
│                                                                 │
│  ┌─────────────────────────────────────┐                        │
│  │   agent-sandbox-system namespace    │                        │
│  │   ┌─────────────────────────────┐   │                        │
│  │   │ Agent Sandbox Operator      │   │                        │
│  │   │ (OLM, preview-0.9)          │   │                        │
│  │   └────────────┬────────────────┘   │                        │
│  └────────────────│────────────────────┘                        │
│                   │ watches Sandbox CRs                         │
│                   │ creates pods                                │
│  ┌────────────────│────────────────────────────────────┐        │
│  │   openshell namespace                               │        │
│  │                │                                    │        │
│  │  ┌─────────────▼──────────────┐                     │        │
│  │  │ Pod: default--openclaw-gw  │◄────────────────┐   │        │
│  │  │ (Sandbox CR, SA: sandbox)  │                 │   │        │
│  │  │ ┌────────────────────────┐ │                 │   │        │
│  │  │ │ container: agent       │ │   gRPC/mTLS     │   │        │
│  │  │ │ ┌───────────────────┐  │ │   relay         │   │        │
│  │  │ │ │ supervisor (root) │  │ │                 │   │        │
│  │  │ │ │   ┌─── netns ──┐  │  │ │                 │   │        │
│  │  │ │ │   │ openclaw   │  │  │ │                 │   │        │
│  │  │ │ │   │ :18789     │  │  │ │                 │   │        │
│  │  │ │ │   └────────────┘  │  │ │                 │   │        │
│  │  │ │ └───────────────────┘  │ │                 │   │        │
│  │  │ └────────────────────────┘ │                 │   │        │
│  │  └────────────────────────────┘                 │   │        │
│  │                                                 │   │        │
│  │  ┌──────────────────────────────┐               │   │        │
│  │  │ StatefulSet: openshell-0     │───────────────┘   │        │
│  │  │ (Gateway, SCC: restricted)   │                   │        │
│  │  └──────────────────────────────┘                   │        │
│  │                                                     │        │
│  │  ┌──────────────────────────────┐                   │        │
│  │  │ Deployment: openclaw-ui-proxy│                   │        │
│  │  │ (nginx mTLS bridge)          │                   │        │
│  │  └──────────────────────────────┘                   │        │
│  └─────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### How `deploy-openshell` Works

The Makefile target follows this sequence:

1. **Wait for CRD** — polls until `sandboxes.agents.x-k8s.io` is available (installed by the Agent Sandbox Operator in step 0).
2. **Resolve Helm dependency** — `helm dependency build` fetches the pinned upstream OCI chart (`0.0.83` per `Chart.lock`).
3. **`helm upgrade --install`** — single release `openshell` in namespace `openshell` with chart `values.yaml` (SCC, TLS, SCC-compatible security context).
4. **Namespace label** — `opendatahub.io/dashboard: "true"` so the namespace appears in the RHOAI Dashboard.
5. **Wait for rollout** — StatefulSet + PKI secrets.
6. **MLflow RBAC** — grants the sandbox SA access to MLflow for tracing.
7. **CLI registration** — registers the gateway + syncs mTLS client certs to the local `openshell` CLI.

---

## 3. End-to-End Flow: From CLI to Running Agent

```
┌──────────────┐    ┌────────────────┐    ┌─────────────┐    ┌──────────────┐
│ openshell    │───►│ OpenShell      │───►│ K8s API     │───►│ Agent        │
│ CLI          │gRPC│ Gateway        │POST│ Server      │    │ Sandbox      │
│              │mTLS│ (StatefulSet)  │    │             │    │ Operator     │
└──────────────┘    └────────────────┘    └──────┬──────┘    └──────┬───────┘
                                                 │                  │
                                                 │ Sandbox CR       │ reconciles
                                                 │ created          │ creates Pod
                                                 │                  │
                                                 ▼                  ▼
                                          ┌──────────────────────────┐
                                          │ Pod: default--openclaw-gw│
                                          │ (container: agent)       │
                                          │ supervisor starts        │
                                          │ registers with gateway   │
                                          └──────────────────────────┘
```

### Phase 1 — Operator Installation

```bash
make -C deploy deploy-operators
```

Installs RHOAI and Agent Sandbox operators via OLM Subscriptions.  The Agent Sandbox operator is configured in `deploy/helm/operators/values.yaml`:

- `channel: preview-0.9`
- `startingCSV: agent-sandbox-operator.v0.9.0`
- `installPlanApproval: Manual` (auto-approved by the Makefile)

The Makefile waits until the CSV is `Succeeded` and the `sandboxes.agents.x-k8s.io` CRD is registered.

### Phase 2 — Gateway Deployment

```bash
APPS_DOMAIN=apps.ocp.example.com make -C deploy deploy-openshell
```

Deploys the OpenShell Gateway StatefulSet.  The wrapper chart (`deploy/helm/openshell/`) declares the upstream OCI chart as a Helm subchart dependency.  A single `helm upgrade --install` renders both OpenShift extras (SCC RoleBinding, Route) and the gateway itself.

### Phase 3 — Sandbox Creation

```bash
openshell sandbox create --from openclaw --name openclaw-gw --policy config/openshell/default.yaml
```

The CLI sends a `CreateSandbox` gRPC request to the gateway.  The gateway's Kubernetes driver:

1. **Resolves `--from openclaw`** into the container image `ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest` (see [image resolution](#how---from-resolves)).
2. **Builds a `Sandbox` CR** spec with `podTemplate`, volumes, labels.
3. **POSTs the CR** to the Kubernetes API:

```yaml
apiVersion: agents.x-k8s.io/v1beta1
kind: Sandbox
metadata:
  name: default--openclaw-gw     # {workspace}--{name}
  namespace: openshell
  labels:
    openshell.io/managed-by: openshell
    openshell.io/sandbox-id: <uuid>
    openshell.io/sandbox-name: openclaw-gw
spec:
  podTemplate:
    spec:
      serviceAccountName: openshell-sandbox
      containers:
        - name: agent
          image: ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest
          securityContext:
            runAsUser: 0           # supervisor needs root
            capabilities:
              add: [SYS_ADMIN, NET_ADMIN, SYS_PTRACE, SYSLOG]
          command: ["/opt/openshell/openshell-sandbox"]
      automountServiceAccountToken: false
  volumeClaimTemplates:
    - ...   # workspace PVC
```

The Kubernetes name follows the pattern `{workspace}--{name}`.  The default workspace is `default`, so the pod is named `default--openclaw-gw`.

### Phase 4 — Operator Reconciliation

The Agent Sandbox Operator watches `Sandbox` CRs across all namespaces. When it sees the new CR, it creates the pod according to `spec.podTemplate` and updates `status.conditions[Ready]`.

The gateway watches the CR via the Kubernetes API and transitions the sandbox to `Ready` once the operator reports success.

### Phase 5 — Supervisor Registration

The pod's `agent` container does not run OpenClaw directly.  Its entrypoint is the **OpenShell supervisor** (`openshell-sandbox` binary), which:

1. Uses a projected ServiceAccount token (`audience: openshell-gateway`) to call `IssueSandboxToken` on the gateway via mTLS.
2. Opens a persistent gRPC relay channel to the gateway.
3. Applies the sandbox **policy** (Landlock, nftables, seccomp).
4. Waits for `sandbox exec` commands relayed from the gateway.

### Phase 6 — Launch OpenClaw Inside the Sandbox

This is the imperative step performed by `scripts/launch-openclaw.sh`.  See [Section 5](#5-the-launch-script-explained) for the full breakdown.

---

## 4. Inside the Sandbox Pod

### Pod Topology

With the default `combined` supervisor topology (used in this project), there is **one pod with one main container**:

```
Pod: default--openclaw-gw
│
├── [init containers]       optional: copy supervisor binary, prepare workspace PVC
│
└── container: agent        ONE container
    │
    ├── openshell-sandbox   supervisor process, runs as root (PID ~1)
    │   │
    │   ├── creates isolated network namespace (netns)
    │   ├── installs nftables rules (egress allow/deny per policy)
    │   ├── configures Landlock (filesystem restrictions)
    │   └── forks child processes into the netns
    │
    └── [sandbox netns]     isolated network + filesystem view
        │
        ├── openclaw gateway run   child process, user "sandbox", port 18789
        └── openclaw agent / tools  additional child processes on demand
```

There are **no extra pods** for a single sandbox.  The supervisor and agent processes share the same container but operate in different Linux namespaces and under different security constraints.

### Alternative: Sidecar Topology

OpenShell also supports a `sidecar` topology (not used in this project), where network enforcement runs in a dedicated sidecar container within the same pod:

- `init`: `network-init` (installs nftables rules)
- `agent`: supervisor in `--mode=process` (low capabilities)
- `supervisor-network`: sidecar handling L7 proxy + network policy

Configure via `supervisor.topology: sidecar` in the OpenShell Helm values.

### Two Ways to Enter the Pod

| Method | What you reach | User | Network | Use case |
|--------|---------------|------|---------|----------|
| `oc exec -c agent` | Container's main PID namespace | root (container default) | Pod network | Admin setup: install packages, copy files |
| `openshell sandbox exec` | Sandbox netns (via supervisor relay) | `sandbox` (policy-defined) | Isolated netns, policy-restricted | Run agent commands, health checks |

This distinction is critical: a service listening on `127.0.0.1:18789` inside the sandbox netns is **invisible** to `oc exec -c agent`.  Health checks and validation must use `openshell sandbox exec`.

---

## 5. The Launch Script Explained

`scripts/launch-openclaw.sh` is the one imperative step that cannot be expressed as a Helm chart — it requires runtime interaction with the sandbox process namespace.

### Prerequisites

- OpenShell deployed: `make -C deploy deploy-openshell`
- Secrets: `MAAS_API_KEY` and `OPENCLAW_GATEWAY_PASSWORD` in `secrets/secrets.env`
- CLI registered: `openshell status` shows Connected

### Step-by-Step

#### Step 0 — Register CLI Gateway

```bash
openshift-openshell-register-gateway.sh
```

Ensures the local `openshell` CLI points at this cluster's gateway with valid mTLS certificates.

#### Create Sandbox (if missing)

```bash
openshell sandbox create \
  --from openclaw \
  --name openclaw-gw \
  --policy config/openshell/default.yaml \
  --upload .rendered/openclaw.json:/sandbox/.openclaw/config.json
```

Creates the `Sandbox` CR → operator creates pod → supervisor starts → gateway reports `Ready`.  Idempotent: skipped if the sandbox already exists.

#### Step 1 — Clean Stale Gateway Processes via `openshell sandbox exec` (sandbox context)

```bash
openshell sandbox exec -n openclaw-gw --no-tty --timeout 15 \
  -- bash -c 'pgrep -f "openclaw gateway" | xargs -r kill -9; ...'
```

This step **must** run via `openshell sandbox exec`, not `oc exec -c agent` — the
gateway itself is started with `openshell sandbox exec` (Step 9), which runs
in a different PID namespace than plain `oc exec`. Killing via `oc exec`
makes `pgrep -f "openclaw gateway"` find nothing there, so the kill
silently no-ops while the real gateway process keeps running untouched, on
whatever stale config/env it started with. `launch-openclaw.sh` verifies
the process list is actually empty afterward (retrying once, then failing
loudly) instead of trusting `kill`'s exit code alone.

#### Steps 2–7 — Setup via `oc exec -c agent` (admin context)

These steps run **inside the container as root** to prepare the environment. They use `oc exec -c agent` because they need root privileges and operate on the container filesystem (chown, npm install, file staging) — not process lifecycle, which is namespace-scoped (see Step 1 above).

| Step | What it does | Why |
|------|-------------|-----|
| Install OpenClaw | `npm install -g openclaw@2026.6.34` | Pin to a tested version ([ADR-0006](adr/0006-explicit-version-pinning.md)) |
| Upload config | `oc cp openclaw.json` + `chown` to sandbox UID | OpenClaw rejects config not owned by the sandbox user |
| Upload workspace bootstrap | `oc cp agent/workspace/{AGENTS,SOUL,IDENTITY}.md` → `/sandbox/workspace/` | Demo overrides default OpenClaw bootstrap that refuses sensitive probes; `skipBootstrap: true` in config |
| Install MLflow plugin | `npm install @mlflow/mlflow-openclaw@0.2.0-rc.0` | Traces with full Request/Response content to RHOAI MLflow |
| Patch plugin | `patch-mlflow-plugin.py` + `chown root:root` | SDK compatibility patches; OpenClaw requires root-owned extensions |
| Stage CA bundle | Merge OpenShell CA + OpenShift service-ca | TLS trust for MLflow's internal service-ca-signed certificate |
| Create directories | `mkdir` + `chown` for tmp/logs/sessions/state | Workspace must be writable by sandbox UID |

#### Step 8 — Expose Service via Relay

```bash
openshell service expose openclaw-gw 18789 openclaw-ui
```

Registers a route in the OpenShell gateway: requests to `openclaw-gw--openclaw-ui.<APPS_DOMAIN>` are relayed through the gateway to port `18789` inside the sandbox.

This must happen before or independently of the gateway startup — it configures the routing mapping, not the process.

#### Step 9 — Start Gateway via `openshell sandbox exec` (sandbox context)

```bash
openshell sandbox exec -n openclaw-gw --no-tty --timeout 15 \
  --env "HOME=/sandbox/workspace" \
  --env "MLFLOW_TRACKING_TOKEN=..." \
  --env "NODE_EXTRA_CA_CERTS=/sandbox/workspace/.combined-ca-bundle.pem" \
  --env "OTEL_TRACES_EXPORTER=none" \
  -- bash -c 'nohup openclaw gateway run > /sandbox/workspace/openclaw.log 2>&1 &'
```

This is the critical switch from admin (`oc exec`) to **sandbox execution**:

- The command runs inside the **isolated network namespace**.
- The process runs as user `sandbox` (policy-defined).
- Network egress is restricted by nftables rules.
- Filesystem access is restricted by Landlock.
- `nohup` + `&` keeps the process alive after the exec session ends.
- `OTEL_*_EXPORTER=none` disables generic OTEL; tracing goes through the `mlflow-openclaw` plugin instead.
- No `LITELLM_API_KEY` injection: LLM inference uses OpenShell's inference
  router (`inference.local`). The real API key lives in the gateway's
  provider record and is injected by the inference router at the gateway
  layer — the sandbox process never sees it.

#### Step 10 — Health Check + Plugin Verification

```bash
openshell sandbox exec -n openclaw-gw -- \
  bash -c 'curl -sf http://127.0.0.1:18789/health'
```

Uses `sandbox exec` (not `oc exec`) because `127.0.0.1:18789` only exists inside the sandbox netns.

### Traffic Flow: Browser to OpenClaw

```
Browser  ───HTTPS──►  Route (openclaw-gw--openclaw-ui.apps.*)
                       │
                       ▼
              openclaw-ui-proxy (nginx)
              presents mTLS client cert
                       │
                       ▼
              OpenShell Gateway (openshell-0)
              relay HTTP/WebSocket
                       │
                       ▼
              Supervisor (in sandbox pod)
              forwards to sandbox netns
                       │
                       ▼
              openclaw gateway run (:18789)
              inside isolated netns
```

The `OPENCLAW_GATEWAY_PASSWORD` (from `secrets/secrets.env`) is configured in `config/openclaw.json.tpl` as `gateway.auth.mode: password`.  Users enter it in the Control UI settings or pass it as a query parameter.

---

## 6. Version Pinning

All versions are pinned per [ADR-0006](adr/0006-explicit-version-pinning.md):

| Component | Version | Where enforced |
|-----------|---------|----------------|
| Agent Sandbox Operator | channel `preview-0.9`, CSV `v0.9.0` | `deploy/helm/operators/values.yaml` |
| OpenShell chart (gateway) | `0.0.83` | `deploy/helm/openshell/Chart.yaml` + `Chart.lock` |
| OpenClaw (npm) | `2026.6.34` | `scripts/launch-openclaw.sh` (`OPENCLAW_PIN`) |
| `@mlflow/mlflow-openclaw` | `0.2.0-rc.0` | `scripts/launch-openclaw.sh` |
| Sandbox base image | **not pinned** (`openclaw:latest`) | `--from openclaw` in `launch-openclaw.sh` |

### Pinning the Sandbox Base Image

`--from openclaw` resolves to `ghcr.io/nvidia/openshell-community/sandboxes/openclaw:latest` via OpenShell's community image resolution (`openshell-core/src/image.rs`).  Any value containing `/`, `:`, or `.` is treated as a full image reference and passed through unchanged.

To pin the base image, replace `--from openclaw` with a full reference:

```bash
# Tag pin
--from ghcr.io/nvidia/openshell-community/sandboxes/openclaw:0.0.83

# Digest pin (maximum reproducibility)
--from ghcr.io/nvidia/openshell-community/sandboxes/openclaw@sha256:abc123...

# Your own registry
--from quay.io/your-team/openclaw-sandbox:2026.6.34
```

If the sandbox already exists, it must be deleted and recreated to change the image:

```bash
openshell sandbox delete openclaw-gw
# then re-run launch-openclaw.sh with the new --from
```

---

## 7. Using Your Own Agent Image

The `--from openclaw` flag is a community preset — it simply resolves to a pre-built container image.  You can use any image or Dockerfile.

### `--from` Resolution Rules

| `--from` value | What happens |
|----------------|-------------|
| `openclaw`, `python`, `base` | Expanded to `ghcr.io/nvidia/openshell-community/sandboxes/{name}:latest` |
| `ghcr.io/myorg/myimage:v1` | Used as-is (contains `/` or `:`) |
| `./Dockerfile` or `./docker/` | OpenShell builds the image, then creates the sandbox |
| *(omitted)* | Uses the gateway default (`sandboxImage` in Helm values, typically `base:latest`) |

### Building a Custom Agent Sandbox

1. **Write a Dockerfile** based on an OpenShell community image or any image with the tools your agent needs:

```dockerfile
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest
USER root
RUN npm install -g your-agent@1.0.0
USER sandbox
```

2. **Write a policy** restricting network and filesystem access:

```yaml
version: 1

filesystem_policy:
  read_only: [/usr, /lib, /proc, /etc]
  read_write: [/sandbox/workspace, /tmp]

landlock:
  compatibility: best_effort

process:
  run_as_user: sandbox
  run_as_group: sandbox

network_policies:
  my_api:
    name: my-api-endpoint
    endpoints:
      - host: "api.example.com"
        port: 443
        protocol: rest
        enforcement: enforce
        access: read-write
    binaries:
      - { path: /usr/bin/node }
```

3. **Create and run:**

```bash
openshell sandbox create \
  --from ./Dockerfile \
  --name my-agent \
  --policy my-policy.yaml

openshell sandbox exec -n my-agent -- your-agent run
```

### Policy Anatomy

The sandbox policy controls what the agent can do at runtime:

| Section | Controls | Example |
|---------|----------|---------|
| `filesystem_policy` | Which paths are readable/writable | `read_write: [/sandbox/workspace, /tmp]` |
| `landlock` | Kernel-level filesystem enforcement | `compatibility: best_effort` |
| `process` | User/group the agent runs as | `run_as_user: sandbox` |
| `network_policies` | Allowed egress endpoints | Explicit host + port + protocol per policy |

**Default deny:** any endpoint not listed in `network_policies` is blocked. LLM inference is handled by OpenShell's inference router (`inference.local`) — no explicit network policy needed.

| Policy file | Egress posture | Used by |
|-------------|----------------|---------|
| `config/openshell/default.yaml` | MLflow only; public egress denied | CI, demo backstage (`demo-backstage-install`, `demo-reset`), C-before |
| `config/openshell/google-egress.yaml` | MLflow + `google.com:443` for Test C post–Change 1 | Live via `demo-allow-google-egress.sh` |

**Per-policy binaries** (which executable may open sockets to that endpoint):

| Policy block | Binaries | Purpose |
|--------------|----------|---------|
| `mlflow_direct` | `/usr/bin/node` | OpenClaw gateway + `mlflow-openclaw` trace export |
| `demo_egress_google` (post–Change 1 only) | `/usr/bin/curl` | Test C — agent `curl` to `google.com` |

`curl` is not listed under `mlflow_direct`; MLflow API validation from scripts uses `oc exec` outside the sandbox netns. `inference.local` needs no explicit binary allowlist.

See [`demo-narrative-v1.md`](demo-narrative-v1.md) for the live narrative and [`scripts/demo-allow-google-egress.sh`](../scripts/demo-allow-google-egress.sh) / [`scripts/demo-reset.sh`](../scripts/demo-reset.sh) for on-stage policy toggles.

---

## 8. Validation and Security Verification

### Makefile Targets

```bash
# Gateway health (uses sandbox exec, proves netns isolation)
make -C deploy validate-openclaw

# MLflow trace pipeline (ensures experiment + checks traces)
make -C deploy ensure-mlflow-experiment
make -C deploy validate-traces

# Network policy enforcement (CI hardened policy)
make -C deploy validate-security

# Demo backstage initial state (default deny egress; google blocked)
make -C deploy validate-demo-initial
```

### What `validate-security` Checks

1. **Blocked endpoint:** `curl https://github.com` from inside the sandbox returns `000` (timeout) or `403` — proving the policy blocks it.
2. **Inference router:** `curl https://inference.local/v1/models` returns `200` — proving the inference route is working.

### Infra vs Control UI validation

| Layer | Command | What it proves |
|-------|---------|----------------|
| **Infrastructure (CI)** | `make -C deploy validate-security` | nftables/network policy blocks unauthorized egress (`curl` → `000`/`403`) |
| **Demo backstage** | `make -C deploy validate-demo-initial` | `google.com` and `github.com` blocked before Change 1; `inference.local` still OK |
| **Control UI (E2E)** | `make -C deploy test-security` | User-facing agent refuses malicious prompts or shows block evidence in chat |
| **Demo narrative (E2E)** | `make -C deploy test-demo` | Full live script: Tests A–D + Change 1/2 in one Control UI session |

Use both: `validate-security` catches policy misconfiguration; Playwright catches regressions in the agent harness or Control UI path. Security and guardrails Playwright suites click **New session** before each test and stay on that session (`askAgentViaUI` must not navigate back to `/`, which reopens Main Session). The demo narrative suite (`demo-narrative.spec.ts`) keeps a **single chat session** across Tests A–D (no `resetChatSession` between steps), matching the live presenter flow. Assertions read only the latest assistant bubble, not the full chat log.

### Playwright E2E Tests

Prereqs in `secrets/secrets.env`:

| Variable | Used by |
|---|---|
| `OPENCLAW_GATEWAY_PASSWORD` | OpenClaw Control UI auth |
| `OCP_TEST_USERNAME` / `OCP_TEST_PASSWORD` | OpenShift OAuth credentials for MLflow UI (`mlflow-ui-tests`) |

Copy `secrets/secrets.template.env` to `secrets/secrets.env` and set the **username and password** for the OpenShift web login used by the MLflow UI route (`https://rh-ai.<APPS_DOMAIN>/mlflow` — the same credentials you use in a browser).

`verify.sh` warns before Playwright if either OAuth variable is missing.

```bash
make -C deploy test-e2e           # full suite (CI hardened policy)
make -C deploy test-demo          # demo-narrative.spec.ts (Tests A–D + Change 1/2)
make -C deploy test-security    # sandbox-security.spec.ts
make -C deploy test-ui          # openclaw-ui.spec.ts (browser → gateway → model → traces)
make -C deploy test-guardrails  # guardrails-ui.spec.ts (NeMo jailbreak blocked in Control UI)
make -C deploy test-mlflow      # mlflow-ui.spec.ts
```

#### Parallel execution

Playwright worker count is controlled by `PLAYWRIGHT_WORKERS` (default **1** in [`tests/playwright.config.ts`](../tests/playwright.config.ts)). The default is intentional: most E2E tests share the OpenClaw Control UI **Main Session** and the external MaaS inference quota.

| Setting | When to use |
|---|---|
| `PLAYWRIGHT_WORKERS=1` (default) | Stable runs — demo verify, CI, debugging flakes |
| `PLAYWRIGHT_WORKERS=2` | Slight speed-up when auth setups can overlap (see below) |
| `PLAYWRIGHT_WORKERS=3+` | Not recommended — session contention and MaaS rate limits |

```bash
# Default (stable)
make -C deploy test-e2e

# Optional: overlap independent auth projects
PLAYWRIGHT_WORKERS=2 make -C deploy test-e2e
```

**What can run in parallel**

Playwright projects and their dependencies:

```
auth-setup ──┬── ui-tests ──────┬── mlflow-ui-tests
             │                  │
mlflow-auth-setup ─────────────┘
             │
             ├── security-tests ── guardrails-tests
             │
             └── demo-narrative-tests   (isolated — not part of test-e2e)
```

| Project | Parallel-safe with | Why |
|---|---|---|
| `auth-setup` | `mlflow-auth-setup` | Different URLs and OAuth flows |
| `demo-narrative-tests` | — | Serial; single chat session; mutates policy + inference path |
| `ui-tests` | — | Serial within project; shares Main Session chat + MaaS |
| `security-tests` | — | Serial within project; same Main Session as UI chat tests |
| `mlflow-ui-tests` | `security-tests` (after `ui-tests`) | Different host (`rh-ai` MLflow UI vs OpenClaw gateway) |

**Serial constraints in code**

- [`tests/openclaw-ui.spec.ts`](../tests/openclaw-ui.spec.ts) — `mode: 'serial'` (chat prompts must not overlap on Main Session)
- [`tests/sandbox-security.spec.ts`](../tests/sandbox-security.spec.ts) — `mode: 'serial'` (same session; prompts go through the agent LLM)
- [`tests/demo-narrative.spec.ts`](../tests/demo-narrative.spec.ts) — `mode: 'serial'` (one session for full demo A–D; runs `demo-reset` / Change scripts)

**Expected speed-up**

Increasing workers saves roughly **30–60 seconds** (mostly overlapping OAuth setup and MLflow UI vs security). The bottleneck remains serial agent-chat tests in `security-tests` (~5–6 min). For a large reduction, each security test would need an isolated Control UI session (not implemented).

**If tests flake with `PLAYWRIGHT_WORKERS>1`**

- Drop back to `PLAYWRIGHT_WORKERS=1`
- Watch for MaaS rate-limit banners in the Control UI
- Watch for `Stop generating` instead of `Send` (another worker still using Main Session)

### Manual Inspection

```bash
# List sandbox CRs
oc get sandboxes.agents.x-k8s.io -n openshell

# Describe the sandbox
oc describe sandbox default--openclaw-gw -n openshell

# List pods with OpenShell labels
oc get pods -n openshell -l openshell.io/managed-by=openshell

# CLI sandbox list
openshell sandbox list

# Health check from inside the sandbox
openshell sandbox exec -n openclaw-gw -- curl -sf http://127.0.0.1:18789/health
```

---

## 9. Quick Reference

### Full Deployment Sequence

**One-shot (recommended):**

```bash
./scripts/cluster-lifecycle.sh preflight
./scripts/cluster-lifecycle.sh full
```

**Manual steps (troubleshooting only):**

```bash
# 1. Platform + operators (includes Agent Sandbox)
cd deploy && make deploy-all

# 2. OpenShell gateway
make deploy-openshell APPS_DOMAIN=apps.your-cluster.example.com

# 3. Browser UI proxy
APPS_DOMAIN=apps.your-cluster.example.com make deploy-openclaw-ui-proxy

# 4. Launch OpenClaw inside sandbox
./scripts/launch-openclaw.sh

# 5. Validate
./scripts/cluster-lifecycle.sh verify
```

**Demo v1 backstage** (default deny egress, direct MaaS):

```bash
POLICY_FILE=config/openshell/default.yaml INFERENCE_BACKEND=direct make -C deploy launch-openclaw
VERIFY_PROFILE=demo ./scripts/verify.sh
# Before Scenario C: ./scripts/demo-reset.sh
# Live Change 1: ./scripts/demo-allow-google-egress.sh
```

### Key Commands

| Task | Command |
|------|---------|
| Create a sandbox | `openshell sandbox create --from <image> --name <n> --policy <file>` |
| Run a command inside sandbox | `openshell sandbox exec -n <name> -- <command>` |
| Expose a service | `openshell service expose <sandbox> <port> <service-name>` |
| List sandboxes | `openshell sandbox list` |
| Delete a sandbox | `openshell sandbox delete <name>` |
| Check CLI status | `openshell status` |
| View sandbox policy | `openshell policy get <name> --full` |
| Update policy live | `openshell policy set <name> --policy <file> --wait` |
| Reset demo to initial policy | `./scripts/demo-reset.sh` |
| Ensure MLflow tracing experiment | `./scripts/ensure-mlflow-experiment.sh` or `make -C deploy ensure-mlflow-experiment` |
| Allow google.com egress (Change 1) | `./scripts/demo-allow-google-egress.sh` |
| Validate demo backstage | `VERIFY_PROFILE=demo ./scripts/verify.sh` |

---

## 10. Further Reading

| Topic | Reference |
|-------|-----------|
| Agent Sandbox Operator (Red Hat docs) | [OSC 1.13 — Deploying Red Hat build of Agent Sandbox](https://docs.redhat.com/en/documentation/openshift_sandboxed_containers/1.13/html/deploying_red_hat_build_of_agent_sandbox/) |
| OpenShell documentation | [docs.nvidia.com/openshell](https://docs.nvidia.com/openshell/latest/) |
| Landlock LSM | [kernel.org/userspace-api/landlock](https://docs.kernel.org/userspace-api/landlock.html) |
| OpenShell deployment on OpenShift (this project) | [ADR-0003](adr/0003-openshell-deployment-on-openshift.md) |
| Privileged SCC rationale | ADR-0006 (reference project: `open-claw-in-openshell/docs/adrs/ADR-0006-scc-privileged-sandbox.md`) |
| Version pinning policy | [ADR-0006](adr/0006-explicit-version-pinning.md) |
| UI authentication (mTLS + password) | [ADR-0011](adr/0011-openclaw-ui-auth-nginx-bridge-password.md) |
| MLflow tracing via plugin | [ADR-0010](adr/0010-mlflow-tracing-otel.md) |
| OpenShell CLI reference | `openshell --help` (always authoritative) |
