# ADR-0001: Adopt ADR Process

## Status

Accepted

## Date

2026-07-13

## Layer

Cross-cutting

## Context

The AgentOps demo involves multiple architecture layers (infrastructure, platform, inference, agent) with decisions that affect each other. Early decisions about NeMo Guardrails, OGX, and OpenShell were recorded informally in `AGENTS.md` and `ROADMAP.md`, making rationale difficult to trace over time.

A lightweight, file-per-decision record keeps the "why" alongside the "what" without requiring external tooling.

## Options Considered

### Option 1: Inline decisions in AGENTS.md

- **Pros:** Single file, low ceremony.
- **Cons:** Grows unmanageable as decisions accumulate; hard to link individual decisions from other docs.

### Option 2: ADR files in docs/adr/ with dual index

- **Pros:** Each decision is self-contained and linkable; index in `docs/adr/README.md` for agents, executive summary in `docs/stack-decisions.md` for humans.
- **Cons:** Extra files to maintain; requires discipline to update both indexes.

## Decision

Adopt option 2. Each architectural decision gets its own file in `docs/adr/NNNN-<slug>.md`. The `adr` Cursor skill automates creation and index updates.

## Consequences

### Positive

- Decisions are individually addressable and linkable from architecture docs, ROADMAP, and AGENTS.md.
- AI agents can discover decisions by reading the index table.

### Negative

- Every new decision requires updating two index files (README.md and stack-decisions.md).

## References

- [Michael Nygard — Documenting Architecture Decisions](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
