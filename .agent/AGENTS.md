# AGENTS.md

This repository is designed to be worked on by coding agents (and humans) using ExecPlans.

## ExecPlans

When writing complex features, introducing new external dependencies, changing the data model, or doing any significant refactor, you MUST first create or update an ExecPlan and follow it through implementation.

An “ExecPlan” is a self-contained, living design document that a complete novice can execute end-to-end using only the current working tree and the ExecPlan file. ExecPlans are defined in:

    .agent/PLANS.md

If you do not have the content of `.agent/PLANS.md` in your current context, read the entire file before writing or implementing an ExecPlan. Keep the ExecPlan updated as work progresses (progress, discoveries, decisions, outcomes).

## Repository goals

This repo implements:
1) A web scraper (the “collector”) that fetches and normalizes data from one or more sources.
2) An API (the “server”) that exposes the normalized data to clients.

Both parts must be demonstrably working: the scraper must produce stored artifacts, and the API must serve them.

## Working style rules (how to change this repo)

- Prefer small, safe, testable increments. Commit frequently.
- Keep changes idempotent: rerunning the scraper should not corrupt data or create duplicates without an explicit reason.
- Add or update tests for new behavior. If tests do not exist, add minimal tests for the touched area.
- Do not introduce new dependencies unless the ExecPlan justifies them and explains how they are used.
- Do not leave the repository in a partially broken state between commits.

## Data contract between scraper and API

The scraper and API must agree on a stable “normalized record” format.

- If you introduce or change the normalized schema, update:
  - the schema definition (type/interface)
  - any migration/backfill steps (if needed)
  - API responses and docs
  - tests and fixtures

Schema changes are “significant changes” and require an ExecPlan.

## Operational requirements

- The scraper must have a dry-run or sample mode suitable for local development.
- The API must have a health endpoint (or equivalent simple endpoint) to prove it is running.
- Logging must be readable and actionable. Prefer structured logs if the repo already uses them; otherwise, keep logs concise and consistent.

## Quality bar for “done”

A change is only considered complete when a novice can:

1) Run the scraper locally and observe stored output (files or DB records).
2) Start the API locally and fetch data via an HTTP request.
3) Run the repository’s test command (or at minimum a minimal smoke test) and see it pass.
4) Understand how to repeat the above from the ExecPlan alone.

## When you are unsure

Do not ask the user for “next steps” mid-implementation. Resolve ambiguity by:
- inspecting the current repository structure,
- reading existing code patterns,
- choosing the most consistent approach,
- and documenting the decision in the ExecPlan “Decision Log”.

If a key choice is genuinely underdetermined, choose a sensible default, implement it, and record the rationale.

## Required outputs for any ExecPlan-driven change

At minimum, the ExecPlan must include:
- exact commands to run (with working directory),
- expected observable outputs,
- acceptance criteria phrased as human-verifiable behavior,
- idempotence and recovery steps,
- and a progress checklist with timestamps that reflects reality.
