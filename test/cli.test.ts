import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  SpecRunnerCli,
  buildArgs,
  parseJsonResult,
} from "../src/cli";
import { validateCosts, validateStatus } from "../src/schemas";

const FIX = path.join(__dirname, "fixtures");

describe("buildArgs", () => {
  it("omits --spec-prefix when empty", () => {
    expect(buildArgs([], "", ["status", "--json"])).toEqual(["status", "--json"]);
  });
  it("prepends --spec-prefix (global) before the subcommand", () => {
    expect(buildArgs([], "phase2-", ["status", "--json"])).toEqual([
      "--spec-prefix",
      "phase2-",
      "status",
      "--json",
    ]);
  });
  it("keeps leading base args (e.g. `uv run spec-runner`)", () => {
    expect(buildArgs(["run", "spec-runner"], "", ["costs", "--json"])).toEqual([
      "run",
      "spec-runner",
      "costs",
      "--json",
    ]);
  });
});

describe("ACTIONS argv mapping", () => {
  it("maps each action to the documented CLI", () => {
    expect(ACTIONS.statusJson()).toEqual(["status", "--json"]);
    expect(ACTIONS.costsJson()).toEqual(["costs", "--json"]);
    expect(ACTIONS.approve("tasks")).toEqual(["spec", "approve", "tasks"]);
    expect(ACTIONS.reject("design")).toEqual(["spec", "reject", "design"]);
    expect(ACTIONS.check("tasks")).toEqual(["spec", "check", "tasks"]);
    expect(ACTIONS.runTask("TASK-001")).toEqual(["run", "--task", "TASK-001", "--json-result"]);
    expect(ACTIONS.runAll()).toEqual(["run", "--all", "--json-result"]);
    expect(ACTIONS.generate("design")).toEqual([
      "plan",
      "--gated",
      "--stage",
      "design",
      "--no-interactive",
    ]);
    expect(ACTIONS.generate("design", "make it good")).toEqual([
      "plan",
      "--gated",
      "--stage",
      "design",
      "--no-interactive",
      "make it good",
    ]);
  });
});

describe("parseJsonResult against vendored schemas", () => {
  it("accepts a valid status sample", () => {
    const raw = fs.readFileSync(path.join(FIX, "status.sample.json"), "utf8");
    const r = parseJsonResult(raw, validateStatus);
    expect(r.ok).toBe(true);
  });
  it("accepts a valid costs sample", () => {
    const raw = fs.readFileSync(path.join(FIX, "costs.sample.json"), "utf8");
    const r = parseJsonResult(raw, validateCosts);
    expect(r.ok).toBe(true);
  });
  it("rejects malformed JSON", () => {
    const r = parseJsonResult("{not json", validateStatus);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("invalid JSON");
  });
  it("rejects a status blob missing required fields", () => {
    const r = parseJsonResult(JSON.stringify({ total_tasks: 1 }), validateStatus);
    expect(r.ok).toBe(false);
  });
});

describe("SpecRunnerCli spawn plumbing", () => {
  const inv = { command: "node", baseArgs: [] as string[], cwd: process.cwd(), specPrefix: "" };

  it("run() buffers stdout and exit code", async () => {
    const cli = new SpecRunnerCli(inv);
    const r = await cli.run(["-e", "process.stdout.write('ok')"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("ok");
  });

  it("runStreaming() splits stderr into lines", async () => {
    const cli = new SpecRunnerCli(inv);
    const lines: string[] = [];
    const { done } = cli.runStreaming(
      ["-e", "process.stderr.write('a\\nb\\n')"],
      (l) => lines.push(l),
    );
    await done;
    expect(lines).toEqual(["a", "b"]);
  });
});
