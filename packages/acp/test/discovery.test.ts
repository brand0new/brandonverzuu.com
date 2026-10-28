import { describe, expect, it } from "vitest";
import {
  ACP_API_VERSION,
  DiscoveryResponseSchema,
  discoveryDocument,
} from "../src/index.ts";

describe("discoveryDocument", () => {
  it("advertises MCP and only 2026-04-17", () => {
    const doc = discoveryDocument({ apiBaseUrl: "https://mcp.example.com" });
    expect(doc).toEqual({
      protocol: {
        name: "acp",
        version: "2026-04-17",
        supported_versions: ["2026-04-17"],
      },
      api_base_url: "https://mcp.example.com",
      transports: ["mcp"],
      capabilities: { services: ["checkout"] },
    });
    expect(ACP_API_VERSION).toBe("2026-04-17");
    expect(DiscoveryResponseSchema.safeParse(doc).success).toBe(true);
  });

  it("passes optional capabilities through", () => {
    const doc = discoveryDocument({
      apiBaseUrl: "https://mcp.example.com",
      documentationUrl: "https://example.com/docs",
      supportedCurrencies: ["eur"],
      supportedLocales: ["en-US"],
    });
    expect(doc.protocol.documentation_url).toBe("https://example.com/docs");
    expect(doc.capabilities).toEqual({
      services: ["checkout"],
      supported_currencies: ["eur"],
      supported_locales: ["en-US"],
    });
  });

  it("rejects invalid config", () => {
    expect(() => discoveryDocument({ apiBaseUrl: "not a url" })).toThrow();
    expect(() =>
      discoveryDocument({
        apiBaseUrl: "https://mcp.example.com",
        supportedCurrencies: ["EUR"],
      }),
    ).toThrow();
  });
});
