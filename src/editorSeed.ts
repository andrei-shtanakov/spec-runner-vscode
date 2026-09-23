// Pure checks behind "Generate spec from this file": which editor documents may
// seed the first stage via `plan --from-file`, and what an overwrite costs.
// vscode-free so the rules are unit-tested without a host.
import * as path from "path";

import { stageFileName } from "./specState";
import type { StageInfo, StageName } from "./types";

const STAGES: StageName[] = ["requirements", "design", "tasks"];

/** Where the stage files live — the subset of ResolvedConfig these checks need. */
export interface SpecLayout {
  specDir: string;
  specPrefix: string;
}

/** The stage a file path belongs to, or null when it is not a stage file. */
export function stageForPath(layout: SpecLayout, fsPath: string): StageName | null {
  for (const stage of STAGES) {
    if (path.join(layout.specDir, stageFileName(stage, layout.specPrefix)) === fsPath) {
      return stage;
    }
  }
  return null;
}

/**
 * Why a document cannot seed generation, or null when it can. `--from-file`
 * reads a path, so the document must be a saved file on disk and must not be
 * one of the stage files it would generate.
 */
export function editorSeedIssue(
  scheme: string,
  fsPath: string,
  layout: SpecLayout,
): string | null {
  if (scheme === "untitled") {
    return "Save the file first — spec-runner reads the seed from a path.";
  }
  if (scheme !== "file") {
    return "Only a file on disk can seed the spec.";
  }
  if (stageForPath(layout, fsPath)) {
    return "A spec file cannot seed its own spec — open the source document instead.";
  }
  return null;
}

/** Confirmation text when generating would replace an existing stage file. */
export function overwriteWarning(info: StageInfo): string | null {
  if (!info.exists) {
    return null;
  }
  const name = `${info.stage}.md`;
  if (!info.managed) {
    return `${name} exists but is not managed by spec-runner. Generating replaces it. Continue?`;
  }
  if (info.status === "approved") {
    return (
      `${info.stage} is approved. Regenerating replaces it, and downstream stages ` +
      "may become stale. Continue?"
    );
  }
  return `${info.stage} already exists (${info.status}). Regenerating replaces it. Continue?`;
}
