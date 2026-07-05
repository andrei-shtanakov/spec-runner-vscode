import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, describe, expect, it } from "vitest";

import { parseGovernance, readStage, splitFrontmatter, stageFileName } from "../src/specState";

const FIX = path.join(__dirname, "fixtures");

describe("splitFrontmatter", () => {
  it("parses a leading YAML block", () => {
    const text = fs.readFileSync(path.join(FIX, "tasks.approved.md"), "utf8");
    const fm = splitFrontmatter(text);
    expect(fm).toMatchObject({ spec_stage: "tasks", status: "approved", version: 2 });
  });
  it("returns null without frontmatter", () => {
    expect(splitFrontmatter("# just a heading\n")).toBeNull();
  });
});

describe("parseGovernance", () => {
  it("passes through the two explicit modes", () => {
    expect(parseGovernance("strict")).toBe("strict");
    expect(parseGovernance("off")).toBe("off");
  });
  it("mirrors spec-runner's default (off) when the key or config file is absent", () => {
    expect(parseGovernance(undefined)).toBe("off");
    expect(parseGovernance(null)).toBe("off");
  });
  it("keeps null (rendered as 'unknown') for an unrecognized value", () => {
    expect(parseGovernance("Strict")).toBeNull();
    expect(parseGovernance(42)).toBeNull();
  });
});

describe("stageFileName", () => {
  it("applies the phase prefix", () => {
    expect(stageFileName("tasks", "")).toBe("tasks.md");
    expect(stageFileName("design", "phase2-")).toBe("phase2-design.md");
  });
});

describe("readStage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specstate-"));
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("reads an approved managed stage", () => {
    fs.copyFileSync(path.join(FIX, "tasks.approved.md"), path.join(dir, "tasks.md"));
    const info = readStage(dir, "tasks", "");
    expect(info).toMatchObject({
      stage: "tasks",
      status: "approved",
      version: 2,
      validation: "pass",
      exists: true,
      managed: true,
    });
  });

  it("reports a missing file", () => {
    const info = readStage(dir, "requirements", "");
    expect(info).toMatchObject({ status: "missing", exists: false, managed: false });
  });

  it("treats frontmatter without spec_stage as unmanaged", () => {
    fs.writeFileSync(path.join(dir, "design.md"), "---\nfoo: bar\n---\n# body\n");
    const info = readStage(dir, "design", "");
    expect(info).toMatchObject({ status: "missing", exists: true, managed: false });
  });
});
