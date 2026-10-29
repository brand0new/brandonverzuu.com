// x402 facilitator client (x402 v2 spec §7: POST /verify, POST /settle).
// Coinbase CDP at first (decision D13); any v2 facilitator with the same API works.

import { cdpJwt } from "./cdp";

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  payer?: string;
  transaction: string;
  network: string;
  amount?: string;
}

export interface Facilitator {
  verify(payload: unknown, requirements: unknown): Promise<VerifyResponse>;
  settle(payload: unknown, requirements: unknown): Promise<SettleResponse>;
}

export class FacilitatorError extends Error {
  override name = "FacilitatorError";
}

export const CDP_FACILITATOR_URL =
  "https://api.cdp.coinbase.com/platform/v2/x402";

export class HttpFacilitator implements Facilitator {
  constructor(
    private readonly url: string,
    private readonly auth: { keyId: string; keySecret: string } | null,
    private readonly fetchFn: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  private async post<T>(
    path: "verify" | "settle",
    payload: unknown,
    requirements: unknown,
  ): Promise<T> {
    const url = `${this.url.replace(/\/$/, "")}/${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.auth)
      headers.Authorization = `Bearer ${await cdpJwt({ ...this.auth, method: "POST", url })}`;
    const response = await this.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload: payload,
        paymentRequirements: requirements,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    // Invalid payments come back as 200 with isValid/success false, and some
    // facilitators use 400 for the same body. Anything else is an outage.
    if (!response.ok && response.status !== 400)
      throw new FacilitatorError(
        `facilitator ${path} answered ${response.status}`,
      );
    try {
      return (await response.json()) as T;
    } catch {
      throw new FacilitatorError(`facilitator ${path} answered without JSON`);
    }
  }

  verify(payload: unknown, requirements: unknown): Promise<VerifyResponse> {
    return this.post("verify", payload, requirements);
  }

  settle(payload: unknown, requirements: unknown): Promise<SettleResponse> {
    return this.post("settle", payload, requirements);
  }
}
