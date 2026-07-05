# Changelog

## [0.1.0] — unreleased

Initial scaffold — a thin read-model + action-dispatcher over spec-runner's CLI.

- Three TreeViews: Spec (governance), Tasks (from `costs --json`), Run (from
  `status --json` + advisory stderr stage).
- Gated-spec actions: Approve / Reject / Regenerate / Generate / Edit, mapped to
  `spec approve/reject/check` and `plan --gated --no-interactive`. Edit-save
  triggers `spec check` to refresh the cached validation verdict.
- Task execution: Run task / Run all / Stop (SIGTERM the owned child, SIGKILL
  after 5 s), streaming stderr to an OutputChannel + a status-bar item, with a
  fixed-cadence `costs`/`status` poll as the authoritative signal.
- Status-vocabulary normalization (DB + tasks.md → canonical, `unknown` fallback).
- Vendored contract schemas + a spec-runner `--version` pin (≥ 2.8.1 — first
  release with log-free `--json` stdout and a valid empty `costs --json`
  payload); read-only degradation when the binary is missing or below the pin.
- Config-resolved binary/state-DB/spec-prefix/governance (honors custom paths).
- Unit tests for the vscode-free core (cli argv/parse, frontmatter reader,
  status normalization, schema validation).
- Integration tests (`@vscode/test-electron`) driving a real extension host
  against a fake `spec-runner` (canned JSON + argv log): `activate → tree render
  → command → CLI-dispatch`, no Python/LLM.
- Regression coverage for the two 2.8.0 read-surface breaks: CLI log noise on
  stderr must not break `--json` parsing (git-subdir warning), and the empty
  `costs --json` payload (fresh gated spec, no tasks.md) renders the "No tasks"
  placeholder. The fake CLI now always logs to stderr like the real one.

Pins spec-runner's `status.schema.json`, `costs.schema.json`, and
`spec-frontmatter.schema.json` (published in the spec-runner contract PR).
