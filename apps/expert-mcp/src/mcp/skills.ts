// MCP Skills extension (io.modelcontextprotocol/skills, SEP-2640, Final), as in
// github.com/modelcontextprotocol/ext-skills specification/stable/skills.mdx.
//
// The TypeScript SDK doesn't ship the extension yet (typescript-sdk#2818 is open),
// so it's implemented here with low-level request handlers:
//
// - `skills/list` and `skills/get` return complete `Skill` entries (verbatim
//   frontmatter plus every file with its SHA-256 digest and size).
// - `resources/list` and `resources/read` serve the skill files as `skill://`
//   resources. They are the server's only resources.
// - `resources/directory/read` lists a skill directory's direct children
//   (`directoryRead: true`).
// - `prompts/list` is answered, and is always empty.
//
// The extension is written against base protocol 2026-07-28. SDK v1 negotiates
// up to 2025-11-25, so results also carry the newer `resultType`, `ttlMs` and
// `cacheScope` fields; older clients ignore them.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { sdkObjectSchema } from "./sdk-schema";

export const SKILLS_EXTENSION = "io.modelcontextprotocol/skills";

export interface BundledSkillFile {
  /** Path relative to the skill folder, "/"-separated. */
  path: string;
  mimeType: string;
  size: number;
  /** `sha256:<64 hex>` of the raw bytes. */
  digest: string;
  text?: string;
  /** Base64, for binary files. */
  blob?: string;
}

export interface BundledSkill {
  /** Skill path under products/skills, e.g. "api-governance-check". */
  path: string;
  frontmatter: { name: string; description: string; [key: string]: unknown };
  files: BundledSkillFile[];
}

export interface SkillEntry {
  uri: string;
  frontmatter: BundledSkill["frontmatter"];
  resources: { uri: string; digest: string; size: number }[];
}

const CACHE = { ttlMs: 300_000, cacheScope: "public" } as const;
const DIRECTORY_MIME = "inode/directory";

export function skillFileUri(skill: BundledSkill, filePath: string): string {
  return `skill://${skill.path}/${filePath}`;
}

export function skillEntry(skill: BundledSkill): SkillEntry {
  return {
    uri: skillFileUri(skill, "SKILL.md"),
    frontmatter: skill.frontmatter,
    resources: skill.files.map((f) => ({
      uri: skillFileUri(skill, f.path),
      digest: f.digest,
      size: f.size,
    })),
  };
}

/** Finds a skill by name or by skill path. */
export function findSkill(
  skills: BundledSkill[],
  nameOrPath: string,
): BundledSkill | undefined {
  return (
    skills.find((s) => s.path === nameOrPath) ??
    skills.find((s) => s.frontmatter.name === nameOrPath)
  );
}

interface Indexed {
  files: Map<string, BundledSkillFile & { skill: BundledSkill }>;
  directories: Map<
    string,
    Map<string, { uri: string; name: string; mimeType: string }>
  >;
  skillsByUri: Map<string, BundledSkill>;
}

function index(skills: BundledSkill[]): Indexed {
  const files: Indexed["files"] = new Map();
  const directories: Indexed["directories"] = new Map();
  const skillsByUri = new Map<string, BundledSkill>();
  for (const skill of skills) {
    skillsByUri.set(skillFileUri(skill, "SKILL.md"), skill);
    const root = `skill://${skill.path}`;
    if (!directories.has(root)) directories.set(root, new Map());
    for (const file of skill.files) {
      const uri = skillFileUri(skill, file.path);
      // A nested skill's files belong to the enclosing skill too; keep the first.
      if (!files.has(uri)) files.set(uri, { ...file, skill });
      const segments = file.path.split("/");
      let dir = root;
      for (let i = 0; i < segments.length; i++) {
        const name = segments[i]!;
        const child = `${dir}/${name}`;
        const isFile = i === segments.length - 1;
        if (!directories.has(dir)) directories.set(dir, new Map());
        directories
          .get(dir)!
          .set(child, {
            uri: child,
            name,
            mimeType: isFile ? file.mimeType : DIRECTORY_MIME,
          });
        dir = child;
      }
    }
  }
  return { files, directories, skillsByUri };
}

const metaSchema = z.record(z.string(), z.unknown()).optional();

const ListSkillsRequestSchema = z.object({
  method: z.literal("skills/list"),
  params: z
    .object({ cursor: z.string().optional(), _meta: metaSchema })
    .loose()
    .optional(),
});

const GetSkillRequestSchema = z.object({
  method: z.literal("skills/get"),
  params: z.object({ uri: z.string(), _meta: metaSchema }).loose(),
});

const ReadDirectoryRequestSchema = z.object({
  method: z.literal("resources/directory/read"),
  params: z
    .object({
      uri: z.string(),
      cursor: z.string().optional(),
      _meta: metaSchema,
    })
    .loose(),
});

/** Registers the Skills extension, the skill resources and the empty prompt list. */
export function registerSkills(mcp: McpServer, skills: BundledSkill[]): void {
  const server = mcp.server;
  const { files, directories, skillsByUri } = index(skills);

  server.registerCapabilities({
    resources: {},
    prompts: {},
    extensions: { [SKILLS_EXTENSION]: { directoryRead: true } },
  });

  server.setRequestHandler(
    sdkObjectSchema(ListSkillsRequestSchema),
    async () => ({
      resultType: "complete",
      skills: skills.map(skillEntry),
      ...CACHE,
    }),
  );

  server.setRequestHandler(
    sdkObjectSchema(GetSkillRequestSchema),
    async (request) => {
      const { uri } = (request as z.infer<typeof GetSkillRequestSchema>).params;
      const skill = skillsByUri.get(uri);
      if (!skill)
        throw new McpError(
          ErrorCode.InvalidParams,
          `No skill is served at ${uri}`,
        );
      return { resultType: "complete", skill: skillEntry(skill), ...CACHE };
    },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [...files.entries()].map(([uri, file]) => ({
      uri,
      name: file.path === "SKILL.md" ? file.skill.frontmatter.name : file.path,
      ...(file.path === "SKILL.md"
        ? { description: file.skill.frontmatter.description }
        : {}),
      mimeType: file.mimeType,
      size: file.size,
    })),
    ...CACHE,
  }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const file = files.get(request.params.uri);
    if (!file)
      throw new McpError(
        ErrorCode.InvalidParams,
        `Resource ${request.params.uri} not found`,
      );
    const body =
      file.text !== undefined ? { text: file.text } : { blob: file.blob ?? "" };
    return {
      resultType: "complete",
      contents: [{ uri: request.params.uri, mimeType: file.mimeType, ...body }],
      ...CACHE,
    };
  });

  server.setRequestHandler(
    sdkObjectSchema(ReadDirectoryRequestSchema),
    async (request) => {
      const { uri } = (request as z.infer<typeof ReadDirectoryRequestSchema>)
        .params;
      const children = directories.get(uri);
      if (!children) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `${uri} is not a directory resource`,
        );
      }
      return {
        resultType: "complete",
        resources: [...children.values()],
        ...CACHE,
      };
    },
  );

  // No prompts, ever. Answered so clients get an empty list rather than an error.
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
  }));
}
