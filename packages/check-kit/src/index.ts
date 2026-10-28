/**
 * @brandonverzuu/check-kit: generic, non-IP machinery for the expertise checks.
 * Parsers, JSONPath, predicates and structural signatures, as any linter has them.
 * What is checked, and how it's weighed, lives in the private rules Worker.
 */
export { CheckKitError } from "./errors.ts";
export type { CheckKitErrorCode, CheckKitIssue } from "./errors.ts";
export { LIMITS, byteLength } from "./limits.ts";
export { parseSource, detectFormat, assertPlainData } from "./yaml.ts";
export type { ParsedSource, ParseSourceOptions, SourceFormat } from "./yaml.ts";
export {
  compilePath,
  query,
  formatPath,
  appendPath,
  parsePointer,
  getAt,
} from "./jsonpath.ts";
export type {
  CompiledPath,
  Match,
  PathSegment,
  QueryOptions,
} from "./jsonpath.ts";
export { parseOpenApi } from "./openapi.ts";
export type {
  OpenApiDocument,
  OpenApiRef,
  ParseOpenApiOptions,
} from "./openapi.ts";
export { parseSkill, pathProblem } from "./skill.ts";
export type {
  ParsedSkill,
  ParseSkillOptions,
  SkillFile,
  SkillFileInfo,
  SkillFileKind,
  SkillFrontmatter,
  SkillHeading,
  SkillReference,
  SkillReferenceKind,
  SkillTreeNode,
} from "./skill.ts";
export {
  parseProcessDescription,
  validateProcessSchema,
  buildModel,
  processDescriptionSchema,
  PROCESS_DESCRIPTION_SCHEMA_ID,
} from "./process.ts";
export type * from "./process.ts";
export * as predicates from "./predicates.ts";
export {
  exists,
  absent,
  pattern,
  casing,
  casingRegExp,
  length,
  enumeration,
  schema,
  not,
  all,
  any,
  toRegExp,
} from "./predicates.ts";
export type {
  Predicate,
  PatternOptions,
  CasingOptions,
  CasingType,
  LengthOptions,
  EnumerationOptions,
  SchemaOptions,
} from "./predicates.ts";
export {
  structuralSignature,
  structuralFeatures,
  normalisedShape,
  skillSignatureInput,
  minhash,
  similarity,
  hash128,
  fnv1a32,
} from "./signature.ts";
export type { StructuralSignature, SignatureOptions } from "./signature.ts";
