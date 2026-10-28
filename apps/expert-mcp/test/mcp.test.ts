import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sdkObjectSchema } from "../src/mcp/sdk-schema";
import { SKILLS_EXTENSION, type BundledSkill } from "../src/mcp/skills";
import { STUB_STARTING_CREDITS } from "../src/stubs";
import {
  connectMcp,
  createAccount,
  fixtureSkill,
  makeContext,
  VALID_INPUTS,
} from "./helpers";

const anyResult = sdkObjectSchema(z.object({}).loose());

async function setup(skills?: BundledSkill[]) {
  const account = await createAccount();
  const { ctx } = makeContext(account);
  const skillList = skills ?? [
    await fixtureSkill("api-governance-check", {
      "references/bundling.md": "# Bundling\n",
    }),
    await fixtureSkill("acme/billing/refunds", {}),
  ];
  const { client } = await connectMcp({
    context: async () => ctx,
    skills: skillList,
  });
  return { client, account, skills: skillList };
}

describe("MCP surface", () => {
  it("declares the Skills extension, resources and prompts", async () => {
    const { client } = await setup();
    const caps = client.getServerCapabilities();
    expect(caps?.extensions?.[SKILLS_EXTENSION]).toEqual({
      directoryRead: true,
    });
    expect(caps?.resources).toBeDefined();
    expect(caps?.tools).toBeDefined();
  });

  it("lists tools with strict input schemas that state the price and terms", async () => {
    const { client } = await setup();
    const { tools } = await client.listTools();
    const check = tools.find((t) => t.name === "check_api_governance")!;
    expect(check.description).toMatch(/Costs 1 credit per artifact/);
    expect(check.description).toMatch(/brandonverzuu\.com\/expert\/terms/);
    expect(check.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["document"],
    });
    expect(check.outputSchema).toBeDefined();
  });

  it("rejects unknown properties", async () => {
    const { client } = await setup();
    const result = await client
      .callTool({
        name: "check_api_governance",
        arguments: { ...VALID_INPUTS["api-governance"], surprise: 1 },
      })
      .catch((e: unknown) => e);
    // The SDK reports input validation as a tool error or a protocol error; either way nothing runs.
    if (result instanceof McpError)
      expect(result.code).toBe(ErrorCode.InvalidParams);
    else expect((result as { isError?: boolean }).isError).toBe(true);
  });

  it("runs a paid check and returns structured findings without telemetry", async () => {
    const { client } = await setup();
    const result = await client.callTool({
      name: "check_api_governance",
      arguments: VALID_INPUTS["api-governance"],
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as Record<string, unknown>;
    expect(structured).toMatchObject({
      rulePackVersion: "stub",
      creditsCharged: 1,
    });
    expect(structured).not.toHaveProperty("telemetry");
    const balance = await client.callTool({
      name: "get_balance",
      arguments: {},
    });
    expect(balance.structuredContent).toEqual({
      balance: STUB_STARTING_CREDITS - 1,
    });
  });

  it("reports insufficient credits as a tool error with a purchase hint", async () => {
    const account = await createAccount();
    const { ctx } = makeContext(account);
    const { StubLedger } = await import("../src/stubs");
    ctx.ledger = new StubLedger(0);
    const { client } = await connectMcp({ context: async () => ctx });
    const result = await client.callTool({
      name: "check_skill_design",
      arguments: VALID_INPUTS["skill-design"],
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toMatch(
      /insufficient_credits.*get_purchase_link/,
    );
  });

  it("returns only skill files from resources/list, and no prompts", async () => {
    const { client } = await setup();
    const { resources } = await client.listResources();
    expect(resources.length).toBe(3);
    expect(resources.every((r) => r.uri.startsWith("skill://"))).toBe(true);
    expect(
      resources.find((r) => r.uri === "skill://api-governance-check/SKILL.md"),
    ).toMatchObject({
      name: "api-governance-check",
      mimeType: "text/markdown",
    });
    expect((await client.listPrompts()).prompts).toEqual([]);
    expect((await client.listResourceTemplates()).resourceTemplates).toEqual(
      [],
    );
  });

  it("serves skills/list and skills/get with complete manifests", async () => {
    const { client, skills } = await setup();
    const list = await client.request(
      { method: "skills/list", params: {} },
      anyResult,
    );
    expect(list).toMatchObject({
      resultType: "complete",
      ttlMs: 300000,
      cacheScope: "public",
    });
    const entries = (
      list as {
        skills: { uri: string; frontmatter: unknown; resources: unknown[] }[];
      }
    ).skills;
    expect(entries.map((s) => s.uri)).toEqual([
      "skill://api-governance-check/SKILL.md",
      "skill://acme/billing/refunds/SKILL.md",
    ]);
    expect(entries[0]!.frontmatter).toEqual(skills[0]!.frontmatter);
    expect(entries[0]!.resources).toEqual(
      skills[0]!.files.map((f) => ({
        uri: `skill://api-governance-check/${f.path}`,
        digest: f.digest,
        size: f.size,
      })),
    );

    const got = await client.request(
      {
        method: "skills/get",
        params: { uri: "skill://acme/billing/refunds/SKILL.md" },
      },
      anyResult,
    );
    expect(got).toMatchObject({
      resultType: "complete",
      skill: { frontmatter: { name: "refunds" } },
    });

    const missing = await client
      .request(
        { method: "skills/get", params: { uri: "skill://nope/SKILL.md" } },
        anyResult,
      )
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(McpError);
    expect((missing as McpError).code).toBe(ErrorCode.InvalidParams);
  });

  it("reads skill files and digests match the bytes", async () => {
    const { client, skills } = await setup();
    const read = await client.readResource({
      uri: "skill://api-governance-check/SKILL.md",
    });
    const text = (read.contents[0] as { text: string }).text;
    const bytes = new TextEncoder().encode(text);
    const digest = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const file = skills[0]!.files.find((f) => f.path === "SKILL.md")!;
    expect(`sha256:${digest}`).toBe(file.digest);
    expect(bytes.byteLength).toBe(file.size);

    const missing = await client
      .readResource({ uri: "skill://api-governance-check/nope.md" })
      .catch((e: unknown) => e);
    expect((missing as McpError).code).toBe(ErrorCode.InvalidParams);
  });

  it("reads skill directories", async () => {
    const { client } = await setup();
    const root = await client.request(
      {
        method: "resources/directory/read",
        params: { uri: "skill://api-governance-check" },
      },
      anyResult,
    );
    expect((root as { resources: unknown[] }).resources).toEqual([
      {
        uri: "skill://api-governance-check/SKILL.md",
        name: "SKILL.md",
        mimeType: "text/markdown",
      },
      {
        uri: "skill://api-governance-check/references",
        name: "references",
        mimeType: "inode/directory",
      },
    ]);
    const notDir = await client
      .request(
        {
          method: "resources/directory/read",
          params: { uri: "skill://api-governance-check/SKILL.md" },
        },
        anyResult,
      )
      .catch((e: unknown) => e);
    expect((notDir as McpError).code).toBe(ErrorCode.InvalidParams);
  });

  it("serves the same skills through the get_skill fallback tool", async () => {
    const { client } = await setup();
    const list = await client.callTool({ name: "get_skill", arguments: {} });
    expect(
      (list.structuredContent as { skills: { name: string }[] }).skills.map(
        (s) => s.name,
      ),
    ).toEqual(["api-governance-check", "refunds"]);
    const one = await client.callTool({
      name: "get_skill",
      arguments: {
        name: "api-governance-check",
        file: "references/bundling.md",
      },
    });
    expect(one.structuredContent).toMatchObject({
      file: "references/bundling.md",
      content: "# Bundling\n",
    });
    const missing = await client.callTool({
      name: "get_skill",
      arguments: { name: "nope" },
    });
    expect(missing.isError).toBe(true);
  });

  it("works with no skills at all", async () => {
    const { client } = await setup([]);
    expect((await client.listResources()).resources).toEqual([]);
    const list = await client.request(
      { method: "skills/list", params: {} },
      anyResult,
    );
    expect((list as { skills: unknown[] }).skills).toEqual([]);
  });
});
