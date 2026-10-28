import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSkills, type BundledSkill } from "./skills";
import { registerTools, type ToolDeps } from "./tools";

export const SERVER_INFO = {
  name: "brandonverzuu-expert",
  version: "0.1.0",
} as const;

function instructions(env: Env, skills: BundledSkill[]): string {
  const skillList = skills.map((s) => `skill://${s.path}/SKILL.md`).join(", ");
  return [
    "Paid, deterministic checks by Brandon Verzuu: API governance (OpenAPI), skill design (Agent Skills) and process description review.",
    "Each check costs credits per artifact. Always ask the user before spending credits or buying more.",
    skills.length > 0
      ? `Before running a check, load the matching skill (${skillList}), or call get_skill if this client can't load skills.`
      : "Call get_skill to see how to prepare input for a check.",
    `Terms: ${env.TERMS_URL}`,
  ].join(" ");
}

/** Builds the complete MCP surface. Shared by the Durable Object session and tests. */
export function buildMcpServer(deps: ToolDeps): McpServer {
  const mcp = new McpServer(SERVER_INFO, {
    instructions: instructions(deps.env, deps.skills),
  });
  registerSkills(mcp, deps.skills);
  registerTools(mcp, deps);
  return mcp;
}
