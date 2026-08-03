# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the AgentOps demo platform.

## Process

Use the [`adr` skill](../../.cursor/skills/adr/SKILL.md) to create new ADRs. Every ADR must also be registered in this index and summarized in [stack-decisions.md](../stack-decisions.md).

Cite official Red Hat and upstream documentation per the [documentation-sources rule](../../.cursor/rules/documentation-sources.mdc).

All AI agents must follow the [adr-alignment rule](../../.cursor/rules/adr-alignment.mdc): read Accepted ADRs before changing stack, deploy, or platform behavior.

## Conventions

- **File name**: `NNNN-<kebab-case-title>.md` — 4-digit prefix, sequential, never reused.
- **Language**: English (all committed docs).
- **Status lifecycle**: Proposed → Accepted → Deprecated / Superseded.
- **Layers**: Infrastructure, Platform, Inference, Agent, Demo, Cross-cutting.

## Index

| ADR | Title | Status | Layer | Date |
|---|---|---|---|---|
| [0001](0001-adopt-adr-process.md) | Adopt ADR process | Accepted | Cross-cutting | 2026-07-13 |
| [0002](0002-ocp-with-rhoai-as-platform.md) | OCP with RHOAI as base platform | Accepted | Infrastructure | 2026-07-13 |
| [0003](0003-openshell-deployment-on-openshift.md) | OpenShell deployment on OpenShift | Accepted | Platform | 2026-07-13 |
| [0004](0004-nemo-guardrails-via-trustyai.md) | NeMo Guardrails via TrustyAI | Accepted | Platform | 2026-07-13 |
| [0006](0006-explicit-version-pinning.md) | Explicit version pinning policy | Accepted | Cross-cutting | 2026-07-13 |
