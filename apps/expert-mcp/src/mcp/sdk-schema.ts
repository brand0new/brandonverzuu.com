import type {
  AnyObjectSchema,
  AnySchema,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";

// The MCP SDK resolves the monorepo's root `zod` (3.25, which the site needs and
// which ships zod 4 as `zod/v4`), while this package and the Agents SDK use
// zod 4.x. Both are zod 4 core at runtime: the SDK detects v4 schemas by their
// `_zod` internals, parses through the schema's own implementation and renders
// JSON Schema from its definition, so the schemas work as-is. Only the declared
// types come from two copies of zod and don't line up, hence these casts.
// test/mcp.test.ts checks validation and the rendered JSON Schema end to end.

export function sdkSchema(schema: unknown): AnySchema {
  return schema as AnySchema;
}

export function sdkObjectSchema(schema: unknown): AnyObjectSchema {
  return schema as AnyObjectSchema;
}
