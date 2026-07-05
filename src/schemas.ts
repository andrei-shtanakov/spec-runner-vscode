// Vendored-schema validation. The four schemas are the pinned contract with
// spec-runner (see the design's Prerequisites); validating here means drift in
// spec-runner's JSON/frontmatter surfaces is caught at parse time, not by a
// downstream crash.
import Ajv, { type ValidateFunction } from "ajv";
import * as fs from "fs";
import * as path from "path";

import statusSchema from "../schemas/status.schema.json";
import costsSchema from "../schemas/costs.schema.json";
import frontmatterSchema from "../schemas/spec-frontmatter.schema.json";
import jsonResultSchema from "../schemas/json-result.schema.json";

const ajv = new Ajv({ allErrors: true, strict: false });

export const validateStatus: ValidateFunction = ajv.compile(statusSchema);
export const validateCosts: ValidateFunction = ajv.compile(costsSchema);
export const validateFrontmatter: ValidateFunction = ajv.compile(frontmatterSchema);
export const validateJsonResult: ValidateFunction = ajv.compile(jsonResultSchema);

export interface ParseResult<T> {
  ok: boolean;
  value: T | null;
  errors: string;
}

/** Validate an already-parsed object against a compiled validator. */
export function checkAgainst<T>(
  validate: ValidateFunction,
  data: unknown,
): ParseResult<T> {
  if (validate(data)) {
    return { ok: true, value: data as T, errors: "" };
  }
  const errors = (validate.errors ?? [])
    .map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`.trim())
    .join("; ");
  return { ok: false, value: null, errors };
}

/**
 * The minimum spec-runner version this extension's vendored contract targets.
 * 2.8.1 is the first release where the machine-JSON surfaces are safe for this
 * extension: `--json` stdout stays log-free (pre-init structlog → stderr) and
 * `costs --json` emits a valid empty payload on a project without tasks.md.
 * Below this the extension degrades to read-only unless
 * `spec-runner.ignoreVersionPin` is set.
 */
export function minSpecRunnerVersion(): string {
  return "2.8.1";
}

/** Read a vendored schema's raw JSON (used by tests / diagnostics). */
export function loadVendoredSchema(name: string): unknown {
  const p = path.join(__dirname, "..", "schemas", name);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
