/** Why an artifact was rejected before any check ran. */
export type CheckKitErrorCode =
  | "too_large"
  | "too_deep"
  | "too_many_files"
  | "invalid_syntax"
  | "invalid_document"
  | "unsupported_version"
  | "external_ref"
  | "unresolved_ref"
  | "invalid_path"
  | "binary_content"
  | "duplicate_path"
  | "missing_skill_md"
  | "schema_invalid";

export interface CheckKitIssue {
  /** JSONPath, file path or element id the issue is about, when there is one. */
  at?: string;
  message: string;
}

/**
 * Thrown by every parser when an artifact can't be accepted. The gateway maps it to
 * a validation error and charges nothing. Messages describe the input, never a rule.
 */
export class CheckKitError extends Error {
  readonly code: CheckKitErrorCode;
  readonly issues: CheckKitIssue[];

  constructor(
    code: CheckKitErrorCode,
    message: string,
    issues: CheckKitIssue[] = [],
  ) {
    super(message);
    this.name = "CheckKitError";
    this.code = code;
    this.issues = issues;
  }
}
