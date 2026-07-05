// Reads gated-spec governance state directly from the YAML frontmatter of
// spec/*.md. spec-runner has no `spec status --json`, and frontmatter is a
// pinned schema (spec-frontmatter.schema.json), so this is contract-safe and
// file-watch friendly. Reads are race-safe: spec-runner writes via temp-file +
// atomic os.replace, so we always see a whole old/new file.
import * as fs from "fs";
import { parse as parseYaml } from "yaml";

import { checkAgainst, validateFrontmatter } from "./schemas";
import type { StageInfo, StageName } from "./types";

export const STAGES: StageName[] = ["requirements", "design", "tasks"];

/**
 * Map a raw `spec_governance` config value to the tree's vocabulary.
 * spec-runner defaults to "off" when the key (or the whole config file) is
 * absent, so mirror that instead of reporting "unknown". null ("unknown") is
 * reserved for a present but unrecognized value.
 */
export function parseGovernance(raw: unknown): "strict" | "off" | null {
  if (raw === "strict") {
    return "strict";
  }
  return raw === "off" || raw === undefined || raw === null ? "off" : null;
}

const FM_DELIM = "---";

/** Split a leading `---\n...\n---` YAML block from a document. */
export function splitFrontmatter(text: string): Record<string, unknown> | null {
  if (!text.startsWith(FM_DELIM + "\n")) {
    return null;
  }
  const end = text.indexOf("\n" + FM_DELIM, FM_DELIM.length + 1);
  if (end === -1) {
    return null;
  }
  const raw = text.slice(FM_DELIM.length + 1, end);
  try {
    const loaded = parseYaml(raw);
    return loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** File name for a stage given the multi-phase prefix. */
export function stageFileName(stage: StageName, specPrefix: string): string {
  return `${specPrefix}${stage}.md`;
}

/** Read one stage's governance info from disk. Never throws. */
export function readStage(
  specDir: string,
  stage: StageName,
  specPrefix: string,
): StageInfo {
  const path = `${specDir}/${stageFileName(stage, specPrefix)}`;
  let text: string;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch {
    return {
      stage,
      status: "missing",
      version: null,
      validation: null,
      exists: false,
      managed: false,
    };
  }
  const fm = splitFrontmatter(text);
  // A frontmatter block that lacks spec_stage is treated as unmanaged, matching
  // spec-runner's read_spec_meta semantics.
  if (!fm || fm.spec_stage === undefined) {
    return {
      stage,
      status: "missing",
      version: null,
      validation: null,
      exists: true,
      managed: false,
    };
  }
  // Validate against the pinned schema to catch drift; even on failure we surface
  // best-effort values rather than crash the tree.
  const checked = checkAgainst<Record<string, unknown>>(validateFrontmatter, fm);
  if (!checked.ok) {
    console.warn(`[spec-runner] frontmatter drift in ${path}: ${checked.errors}`);
  }
  const status = typeof fm.status === "string" ? fm.status : "draft";
  return {
    stage,
    status: (["draft", "approved", "stale"].includes(status)
      ? status
      : "draft") as StageInfo["status"],
    version: typeof fm.version === "number" ? fm.version : null,
    validation: typeof fm.validation === "string" ? fm.validation : null,
    exists: true,
    managed: true,
  };
}

/** Read all three stages. */
export function readStages(specDir: string, specPrefix: string): StageInfo[] {
  return STAGES.map((s) => readStage(specDir, s, specPrefix));
}
