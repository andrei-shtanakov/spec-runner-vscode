#!/usr/bin/env node
// Fake spec-runner for integration tests — mirrors spec-runner's
// tests/fixtures/fake_claude.sh pattern. Emits canned JSON for the read
// commands and logs every invocation's argv so tests can assert the
// command→argv contract. No Python, no LLM.
"use strict";
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
// Strip a leading global `--spec-prefix <value>` if present.
let args = argv.slice();
if (args[0] === "--spec-prefix") {
  args = args.slice(2);
}

// Record the full invocation for action-path assertions.
try {
  fs.appendFileSync(path.join(__dirname, "calls.log"), argv.join(" ") + "\n");
} catch {
  /* ignore */
}

function print(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

const cmd = args[0];

if (argv.includes("--version")) {
  process.stdout.write("spec-runner 2.8.0\n");
  process.exit(0);
}

if (cmd === "status" && args.includes("--json")) {
  print({
    total_tasks: 2,
    completed: 1,
    failed: 0,
    running: 0,
    not_started: 1,
    total_cost: 0.5,
    input_tokens: 1000,
    output_tokens: 500,
    budget_usd: 5.0,
  });
  process.exit(0);
}

if (cmd === "costs" && args.includes("--json")) {
  print({
    tasks: [
      {
        task_id: "TASK-001",
        name: "Login page",
        status: "success",
        cost: 0.5,
        attempts: 1,
        input_tokens: 1000,
        output_tokens: 500,
      },
      {
        task_id: "TASK-002",
        name: "Dashboard",
        status: "todo",
        cost: 0.0,
        attempts: 0,
        input_tokens: 0,
        output_tokens: 0,
      },
    ],
    summary: {
      total_cost: 0.5,
      total_input_tokens: 1000,
      total_output_tokens: 500,
      avg_cost_per_completed: 0.5,
      most_expensive_task: "TASK-001",
      budget_usd: 5.0,
      budget_used_pct: 10.0,
    },
  });
  process.exit(0);
}

if (cmd === "run") {
  // Advisory stage line on stderr, end-only --json-result on stdout.
  process.stderr.write("[TASK-001] ⏳ stage: codex\n");
  const taskId = argIndexValue(args, "--task") || "TASK-002";
  print({ task_id: taskId, status: "done", attempts: 1, cost_usd: 0.1, exit_code: 0 });
  process.exit(0);
}

// Action commands (spec approve/reject/check, plan) — succeed silently.
process.exit(0);

function argIndexValue(a, flag) {
  const i = a.indexOf(flag);
  return i !== -1 && i + 1 < a.length ? a[i + 1] : null;
}
