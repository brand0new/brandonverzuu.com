// EUR→USD for the USDC price (spec 03: "converted from EUR at a quoted rate
// valid for 5 minutes"). The source is the ECB's daily euro reference rate,
// which is published once a working day; the 5-minute window is the quote's,
// not the rate's. When the rate can't be fetched, the 402 offers EURC only.

export interface FxRates {
  /** USD per EUR, or null when unavailable. */
  usdPerEur(): Promise<{ rate: number; asOf: string } | null>;
}

export const ECB_DAILY_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

/** Parses the USD rate out of the ECB daily XML. */
export function parseEcbUsd(
  xml: string,
): { rate: number; asOf: string } | null {
  const rate = /currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/.exec(xml)?.[1];
  const asOf = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  const value = rate ? Number(rate) : NaN;
  if (!Number.isFinite(value) || value <= 0 || !asOf) return null;
  return { rate: value, asOf };
}

export class EcbRates implements FxRates {
  private cached: { rate: number; asOf: string; at: number } | null = null;

  constructor(
    private readonly fetchFn: typeof fetch = fetch,
    private readonly ttlMs = 60 * 60 * 1000,
  ) {}

  async usdPerEur() {
    if (this.cached && Date.now() - this.cached.at < this.ttlMs)
      return { rate: this.cached.rate, asOf: this.cached.asOf };
    try {
      const response = await this.fetchFn(ECB_DAILY_URL, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return this.stale();
      const parsed = parseEcbUsd(await response.text());
      if (!parsed) return this.stale();
      this.cached = { ...parsed, at: Date.now() };
      return parsed;
    } catch {
      return this.stale();
    }
  }

  /** A rate up to a day old beats no USDC option at all. */
  private stale() {
    if (this.cached && Date.now() - this.cached.at < 24 * 60 * 60 * 1000)
      return { rate: this.cached.rate, asOf: this.cached.asOf };
    return null;
  }
}

/** A fixed rate, for tests. */
export class FixedRates implements FxRates {
  constructor(private readonly rate: number | null) {}
  async usdPerEur() {
    return this.rate === null ? null : { rate: this.rate, asOf: "fixed" };
  }
}
