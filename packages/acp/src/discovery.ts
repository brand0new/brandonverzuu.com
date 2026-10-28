import {
  DiscoveryResponseSchema,
  type DiscoveryCapabilities,
  type DiscoveryResponse,
} from "./generated/checkout.ts";
import { ACP_API_VERSION } from "./meta.ts";

export interface DiscoveryConfig {
  /** Base URL for the ACP REST API. Required by the schema, even for MCP-only sellers. */
  apiBaseUrl: string;
  /** Defaults to `["checkout"]`. */
  services?: DiscoveryCapabilities["services"];
  documentationUrl?: string;
  extensions?: DiscoveryCapabilities["extensions"];
  interventionTypes?: DiscoveryCapabilities["intervention_types"];
  supportedCurrencies?: DiscoveryCapabilities["supported_currencies"];
  supportedLocales?: DiscoveryCapabilities["supported_locales"];
}

/** The body of `/.well-known/acp.json` for an MCP-only seller on ACP 2026-04-17. */
export function discoveryDocument(config: DiscoveryConfig): DiscoveryResponse {
  const capabilities: DiscoveryCapabilities = {
    services: config.services ?? ["checkout"],
  };
  if (config.extensions) capabilities.extensions = config.extensions;
  if (config.interventionTypes)
    capabilities.intervention_types = config.interventionTypes;
  if (config.supportedCurrencies)
    capabilities.supported_currencies = config.supportedCurrencies;
  if (config.supportedLocales)
    capabilities.supported_locales = config.supportedLocales;

  const doc: DiscoveryResponse = {
    protocol: {
      name: "acp",
      version: ACP_API_VERSION,
      supported_versions: [ACP_API_VERSION],
      ...(config.documentationUrl && {
        documentation_url: config.documentationUrl,
      }),
    },
    api_base_url: config.apiBaseUrl,
    transports: ["mcp"],
    capabilities,
  };
  return DiscoveryResponseSchema.parse(doc);
}
