import * as path from "path";
import { describe, expect, it } from "vitest";

import { editorSeedIssue, overwriteWarning, stageForPath } from "../src/editorSeed";
import type { StageInfo } from "../src/types";

const ROOT = path.join(path.sep, "proj");
const layout = { specDir: path.join(ROOT, "spec"), specPrefix: "" };
const phase2 = { specDir: path.join(ROOT, "spec"), specPrefix: "phase2-" };

function stage(overrides: Partial<StageInfo>): StageInfo {
  return {
    stage: "requirements",
    status: "missing",
    version: null,
    validation: null,
    exists: false,
    managed: false,
    ...overrides,
  };
}

describe("stageForPath", () => {
  it("maps a stage file to its stage", () => {
    expect(stageForPath(layout, path.join(ROOT, "spec", "design.md"))).toBe("design");
  });
  it("honors the multi-phase prefix", () => {
    expect(stageForPath(phase2, path.join(ROOT, "spec", "phase2-tasks.md"))).toBe("tasks");
    expect(stageForPath(phase2, path.join(ROOT, "spec", "tasks.md"))).toBeNull();
  });
  it("returns null for any other file", () => {
    expect(stageForPath(layout, path.join(ROOT, "docs", "idea.md"))).toBeNull();
  });
});

describe("editorSeedIssue", () => {
  it("accepts an ordinary file on disk", () => {
    expect(editorSeedIssue("file", path.join(ROOT, "docs", "idea.md"), layout)).toBeNull();
  });
  it("refuses an untitled document (--from-file needs a path)", () => {
    expect(editorSeedIssue("untitled", "Untitled-1", layout)).toMatch(/save/i);
  });
  it("refuses a non-file scheme (diff, output, git)", () => {
    expect(editorSeedIssue("git", path.join(ROOT, "docs", "idea.md"), layout)).toMatch(
      /file on disk/i,
    );
  });
  it("refuses a spec stage file as its own seed", () => {
    const req = path.join(ROOT, "spec", "requirements.md");
    expect(editorSeedIssue("file", req, layout)).toMatch(/spec file/i);
  });
  it("refuses a prefixed spec stage file", () => {
    const req = path.join(ROOT, "spec", "phase2-design.md");
    expect(editorSeedIssue("file", req, phase2)).toMatch(/spec file/i);
  });
});

describe("overwriteWarning", () => {
  it("is silent when the stage does not exist yet", () => {
    expect(overwriteWarning(stage({}), false)).toBeNull();
  });
  it("warns that an approved stage is replaced and downstream may go stale", () => {
    const msg = overwriteWarning(stage({ status: "approved", exists: true, managed: true }), true);
    expect(msg).toMatch(/approved/);
    expect(msg).toMatch(/stale/);
  });
  it("warns that an existing draft is replaced", () => {
    const msg = overwriteWarning(stage({ status: "draft", exists: true, managed: true }), true);
    expect(msg).toMatch(/draft/);
    expect(msg).not.toMatch(/stale/);
  });
  it("warns when the file is on disk but unreadable — unknown is not absent", () => {
    // readStage folds any read error (EACCES) into exists: false.
    const msg = overwriteWarning(stage({}), true);
    expect(msg).toMatch(/could not be read/);
  });
  it("warns about an unmanaged file that exists on disk", () => {
    const msg = overwriteWarning(stage({ status: "missing", exists: true, managed: false }), true);
    expect(msg).toMatch(/not managed/);
  });
});
