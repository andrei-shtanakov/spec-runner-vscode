# spec-runner for VSCode

A thin VSCode extension over [spec-runner](../spec-runner)'s existing CLI/JSON
contracts. It surfaces the full lifecycle — gated-spec governance and task
execution — natively inside the IDE, without reimplementing spec-runner's logic.

Design: [`spec-runner/docs/superpowers/specs/2026-07-01-spec-runner-vscode-design.md`](../spec-runner/docs/superpowers/specs/2026-07-01-spec-runner-vscode-design.md).

## Core principle

**The extension never writes spec files or the state DB.** Every mutation goes
through the spec-runner CLI, so atomic-locked frontmatter writes, re-validation,
and governance stay authoritative in spec-runner. The extension is a
**read-model + action-dispatcher**.

## What it shows

Three TreeViews in a dedicated activity-bar container:

- **Spec** — per-stage governance (draft/approved/stale + version + validation),
  with context-sensitive Approve / Reject / Regenerate / Generate / Edit buttons.
  Root shows `governance: strict|off`.
- **Tasks** — task list from `costs --json` (status normalized from spec-runner's
  mixed vocabulary), with Run / Logs and a section-level Run all / Stop.
- **Run** — active task, advisory current stage, and authoritative
  summary/budget from `status --json`.

## Read vs action

| Surface | Source | Contract |
|---|---|---|
| Per-task list | `costs --json` | `schemas/costs.schema.json` |
| Run-level aggregate + budget | `status --json` | `schemas/status.schema.json` |
| Governance per stage | `spec/*.md` frontmatter | `schemas/spec-frontmatter.schema.json` |
| Run result | `run … --json-result` | `schemas/json-result.schema.json` |

All writes/execution go through the CLI: `spec approve/reject/check`,
`plan --gated --no-interactive`, `run`, and stop-via-SIGTERM.

## Requirements

- **spec-runner ≥ 2.8.0** installed separately (this extension does not bundle
  it). The vendored schemas + a `--version` check on activation are the pinned
  contract; below the pin the extension degrades to read-only. For local
  development against an unreleased spec-runner, set
  `spec-runner.ignoreVersionPin`.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `spec-runner.path` | *(auto-detect)* | Binary path/command (may include args, e.g. `uv run spec-runner`). Empty → `.venv/bin/spec-runner`, else `spec-runner` on PATH. |
| `spec-runner.specPrefix` | `""` | Multi-phase prefix (e.g. `phase2-`). |
| `spec-runner.confirmBeforeRun` | `true` | Modal confirm before running tasks. |
| `spec-runner.confirmBeforeGenerate` | `true` | Modal confirm before generating a stage. |
| `spec-runner.ignoreVersionPin` | `false` | Skip read-only degradation below the version pin. |

## Develop

```bash
npm install
npm run build          # esbuild bundle → dist/extension.js
npm test               # vitest unit tests (vscode-free core)
npm run check-types    # tsc --noEmit
# F5 in VSCode launches an Extension Development Host.
```

Distribution v1 is a `.vsix` (`npx @vscode/vsce package`); Marketplace later.
