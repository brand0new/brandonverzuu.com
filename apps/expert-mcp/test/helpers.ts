import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { env } from "cloudflare:workers";
import { vi } from "vitest";
import { emailHash, upsertAccountOnConsent } from "../src/accounts";
import { sha256Hex } from "../src/crypto";
import { buildMcpServer } from "../src/mcp/server";
import type { BundledSkill } from "../src/mcp/skills";
import type { ToolDeps } from "../src/mcp/tools";
import { runPaidCheck } from "../src/pipeline";
import { createDevServices, type Services } from "../src/services";
import type { Account, ToolContext } from "../src/types";

export const ORIGIN = env.PUBLIC_ORIGIN;

let counter = 0;

export async function createAccount(
  email = `user${++counter}-${crypto.randomUUID()}@example.com`,
): Promise<Account> {
  return upsertAccountOnConsent(
    env,
    email,
    await emailHash(env, email),
    env.TERMS_VERSION,
  );
}

export async function setAccountStatus(
  id: string,
  status: string,
): Promise<void> {
  await env.COMMERCE.prepare("UPDATE accounts SET status = ? WHERE id = ?")
    .bind(status, id)
    .run();
}

/** A ToolContext over fresh stub services, collecting waitUntil promises. */
export function makeContext(
  account: Account,
  services: Services = createDevServices(),
) {
  const pending: Promise<unknown>[] = [];
  const ctx: ToolContext = {
    account,
    requestId: `req_test_${++counter}`,
    payments: services.payments,
    guard: services.guard,
    rules: services.rules,
    flags: services.flags,
    env,
    waitUntil: (p) => pending.push(p),
  };
  return { ctx, services, settle: () => Promise.all(pending) };
}

export async function fixtureSkill(
  path: string,
  files: Record<string, string>,
): Promise<BundledSkill> {
  const name = path.split("/").pop()!;
  const description = `Fixture skill ${name}`;
  const all = {
    "SKILL.md": `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`,
    ...files,
  };
  return {
    path,
    frontmatter: { name, description },
    files: await Promise.all(
      Object.entries(all).map(async ([filePath, text]) => {
        const bytes = new TextEncoder().encode(text);
        return {
          path: filePath,
          mimeType: filePath.endsWith(".md") ? "text/markdown" : "text/plain",
          size: bytes.byteLength,
          digest: `sha256:${await sha256Hex(bytes)}`,
          text,
        };
      }),
    ),
  };
}

/** Connects an MCP client to the full server surface over an in-memory transport. */
export async function connectMcp(options: {
  context: () => Promise<ToolContext>;
  skills?: BundledSkill[];
  runPaidCheck?: ToolDeps["runPaidCheck"];
}) {
  const server = buildMcpServer({
    env,
    skills: options.skills ?? [],
    context: options.context,
    runPaidCheck: options.runPaidCheck ?? runPaidCheck,
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return { client, server };
}

export const SPY_PRICE = {
  kind: "skill-design",
  currency: "EUR",
  net: 0,
  vat: 0,
  total: 0,
  vatTreatment: "nl_standard",
  vatRateBp: 2100,
} as const;

export function spyRunPaidCheck() {
  return vi.fn<ToolDeps["runPaidCheck"]>(async () => ({
    result: { findings: [], scores: [], rulePackVersion: "spy" },
    price: SPY_PRICE,
    receipt: { rail: "x402", paymentId: "pay_spy" },
  }));
}

export const VALID_INPUTS = {
  "api-governance": {
    document: JSON.stringify({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {},
    }),
  },
  "skill-design": {
    files: [
      {
        path: "SKILL.md",
        content: "---\nname: demo\ndescription: Demo\n---\n# Demo\n",
      },
    ],
  },
  "process-review": {
    document: "process:\n  id: p1\n  name: Onboarding\n",
    format: "yaml",
  },
} as const;

/** A stub x402 payload paying exactly what a 402 asked for (dev stub gate only). */
export function stubPayloadFor(
  required: { accepts: { amount: string }[] },
  nonce = `0x${crypto.randomUUID().replace(/-/g, "")}`,
) {
  return {
    x402Version: 2,
    accepted: required.accepts[0],
    payload: {
      signature: "0xstub",
      authorization: {
        from: "0x000000000000000000000000000000000000dEaD",
        to: "0x0000000000000000000000000000000000000000",
        value: required.accepts[0]!.amount,
        nonce,
      },
    },
  };
}
