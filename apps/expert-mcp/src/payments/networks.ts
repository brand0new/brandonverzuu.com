// x402 networks and assets (spec 03 "x402").
//
// USDC addresses and EIP-712 domains match the defaults in @x402/evm 2.29.0
// (DEFAULT_ASSETS). EURC addresses and domains are Circle's published
// deployments as far as could be checked offline: confirm both on chain
// (`name()`, `version()`) before going live. See the spec 03 PR.

export type X402NetworkName = "base" | "base-sepolia";

export interface X402Asset {
  symbol: "EURC" | "USDC";
  address: string;
  /** EIP-712 domain of the token contract, for `transferWithAuthorization`. */
  name: string;
  version: string;
  decimals: number;
  /** The currency the token tracks. */
  pegged: "EUR" | "USD";
}

export interface X402Network {
  name: X402NetworkName;
  /** CAIP-2 identifier, as x402 v2 uses on the wire. */
  caip2: string;
  /** EURC first: it's preferred (decision D13). */
  assets: X402Asset[];
}

export const X402_NETWORKS: Record<X402NetworkName, X402Network> = {
  base: {
    name: "base",
    caip2: "eip155:8453",
    assets: [
      {
        symbol: "EURC",
        address: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
        name: "EURC",
        version: "2",
        decimals: 6,
        pegged: "EUR",
      },
      {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        name: "USD Coin",
        version: "2",
        decimals: 6,
        pegged: "USD",
      },
    ],
  },
  "base-sepolia": {
    name: "base-sepolia",
    caip2: "eip155:84532",
    assets: [
      {
        symbol: "EURC",
        address: "0x808456652fdb597867f38412077A9182bf77359F",
        name: "EURC",
        version: "2",
        decimals: 6,
        pegged: "EUR",
      },
      {
        symbol: "USDC",
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        name: "USDC",
        version: "2",
        decimals: 6,
        pegged: "USD",
      },
    ],
  },
};

export function x402Network(name: string | undefined): X402Network | null {
  return name === "base" || name === "base-sepolia"
    ? X402_NETWORKS[name]
    : null;
}

/** EUR minor units (cents) to atomic units of a 6-decimal EUR token. */
export function eurCentsToAtomic(cents: number, decimals: number): bigint {
  return BigInt(cents) * 10n ** BigInt(decimals - 2);
}

/**
 * EUR minor units to atomic units of a USD token at `usdPerEur`, rounded up
 * so the conversion never undercharges.
 */
export function eurCentsToUsdAtomic(
  cents: number,
  usdPerEur: number,
  decimals: number,
): bigint {
  // Work in millionths of the rate to stay in integers.
  const rateMicro = BigInt(Math.round(usdPerEur * 1_000_000));
  const numerator = BigInt(cents) * rateMicro * 10n ** BigInt(decimals - 2);
  const denominator = 1_000_000n;
  return (numerator + denominator - 1n) / denominator;
}

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
