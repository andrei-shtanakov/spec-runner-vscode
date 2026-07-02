// Integration tests: run inside a real VS Code extension host (@vscode/test-cli
// + @vscode/test-electron). A fake `spec-runner` (node script, set via
// spec-runner.path) emits canned JSON and logs its argv, so we exercise the
// full activate → tree render → command → CLI-dispatch path without Python/LLM.
import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import type { ExtensionApi } from "../src/extension";

const EXT_ID = "andrei-shtanakov.spec-runner-vscode";

function workspaceRoot(): string {
  const f = vscode.workspace.workspaceFolders?.[0];
  assert.ok(f, "a workspace folder must be open");
  return f.uri.fsPath;
}

function callsLogPath(): string {
  return path.join(workspaceRoot(), "bin", "calls.log");
}

function clearCalls(): void {
  fs.writeFileSync(callsLogPath(), "");
}

function readCalls(): string {
  try {
    return fs.readFileSync(callsLogPath(), "utf8");
  } catch {
    return "";
  }
}

function labelsOf(items: vscode.TreeItem[]): string[] {
  return items.map((i) => String(i.label));
}

describe("spec-runner extension (integration)", () => {
  let api: ExtensionApi;

  before(async function () {
    this.timeout(60000);
    const ext = vscode.extensions.getExtension<ExtensionApi>(EXT_ID);
    assert.ok(ext, `extension ${EXT_ID} not found`);
    const activated = await ext.activate();
    assert.ok(activated, "activate() returned no API");
    api = activated;
  });

  it("activates against a compatible fake spec-runner (not read-only)", () => {
    assert.strictEqual(api.isReadOnly(), false);
  });

  it("renders tasks from `costs --json`, normalizing the mixed status vocabulary", () => {
    const items = api.trees.tasks.getChildren();
    const labels = labelsOf(items);
    assert.ok(labels.some((l) => l.includes("TASK-001")), labels.join(", "));
    assert.ok(labels.some((l) => l.includes("TASK-002")), labels.join(", "));

    const t1 = api.controller.state.tasks.find((t) => t.id === "TASK-001");
    assert.strictEqual(t1?.status, "done", "success → done");
    assert.strictEqual(t1?.rawStatus, "success");

    const t2Item = items.find((i) => String(i.label).includes("TASK-002"));
    assert.ok(String(t2Item?.contextValue).includes("canRun"), "todo task is runnable");
  });

  it("renders governance + stages in the SPEC tree", () => {
    const items = api.trees.spec.getChildren();
    const labels = labelsOf(items);
    assert.ok(labels[0].includes("governance: strict"), labels.join(", "));
    const tasksStage = api.controller.state.stages.find((s) => s.stage === "tasks");
    assert.strictEqual(tasksStage?.status, "approved");
    const designStage = api.controller.state.stages.find((s) => s.stage === "design");
    assert.strictEqual(designStage?.status, "draft");
  });

  it("renders run summary/budget from `status --json`", () => {
    const items = api.trees.run.getChildren();
    const budget = items.find((i) => String(i.label) === "Budget");
    assert.ok(budget, "a Budget row is present");
    assert.strictEqual(String(budget?.description), "$0.50 / $5.00");
  });

  it("dispatches `run --task <id> --json-result` on Run task", async () => {
    clearCalls();
    await vscode.commands.executeCommand("specRunner.runTask", { task: { id: "TASK-001" } });
    assert.ok(
      readCalls().includes("run --task TASK-001 --json-result"),
      `calls.log:\n${readCalls()}`,
    );
  });

  it("dispatches `spec approve <stage>` on Approve", async () => {
    clearCalls();
    await vscode.commands.executeCommand("specRunner.approve", { stage: "design" });
    assert.ok(readCalls().includes("spec approve design"), `calls.log:\n${readCalls()}`);
  });
});
