/** A plain JSON Schema object (draft 2020-12), with no `$ref`. */
export type JsonSchema = { [key: string]: unknown };

/** An MCP tool definition as served in `tools/list`. */
export interface McpToolDefinition {
  name: string;
  title?: string;
  description: string;
  inputSchema: JsonSchema & { type: "object" };
}
