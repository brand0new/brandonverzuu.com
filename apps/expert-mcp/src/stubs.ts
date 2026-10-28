// In-memory stand-ins for the services other specs build, used only in local
// development (`ENVIRONMENT=development`) and in tests. They are never wired up
// in staging or production: src/services.ts fails closed there instead.
//
// - StubLedger:   spec 03 replaces it with the D1 ledger.
// - StubGuard:    spec 05 replaces it with AccountGuard.
// - StubRules:    spec 04 replaces it with the private rules Worker. It returns
//                 one fixed, obviously fake finding and knows nothing about any rule.

import { InsufficientCredits } from "./errors";
import type {
  Admission,
  Artifact,
  CheckKind,
  CheckRequest,
  CheckResult,
  Guard,
  IdempotencyStore,
  Ledger,
  PublicResult,
  PurchaseLinks,
  Reservation,
  RulesService,
  UsageEntry,
  UsageLog,
} from "./types";

/** Credits every account starts with in development, so checks can be tried. */
export const STUB_STARTING_CREDITS = 100;

export class StubLedger implements Ledger, UsageLog {
  private readonly rows = new Map<
    string,
    { at: string; delta: number; kind: string; ref: string }[]
  >();
  private readonly open = new Map<string, Reservation>();
  private nextId = 1;

  constructor(private readonly startingCredits = STUB_STARTING_CREDITS) {}

  private ledger(accountId: string) {
    let rows = this.rows.get(accountId);
    if (!rows) {
      rows = [
        {
          at: new Date().toISOString(),
          delta: this.startingCredits,
          kind: "stub_grant",
          ref: "stub",
        },
      ];
      this.rows.set(accountId, rows);
    }
    return rows;
  }

  async balance(accountId: string): Promise<number> {
    const settled = this.ledger(accountId).reduce(
      (sum, row) => sum + row.delta,
      0,
    );
    let reserved = 0;
    for (const r of this.open.values())
      if (r.accountId === accountId) reserved += r.credits;
    return settled - reserved;
  }

  async reserve(
    accountId: string,
    credits: number,
    ref: string,
  ): Promise<Reservation> {
    const balance = await this.balance(accountId);
    if (balance < credits) throw new InsufficientCredits(balance, credits);
    const r: Reservation = {
      id: `res_stub_${this.nextId++}`,
      accountId,
      credits,
      ref,
    };
    this.open.set(r.id, r);
    return r;
  }

  async commit(r: Reservation): Promise<void> {
    if (!this.open.delete(r.id)) throw new Error("reservation is not open");
    this.ledger(r.accountId).push({
      at: new Date().toISOString(),
      delta: -r.credits,
      kind: "check",
      ref: r.ref,
    });
  }

  async refund(r: Reservation, _reason: string): Promise<void> {
    this.open.delete(r.id);
  }

  async grant(
    accountId: string,
    credits: number,
    orderId: string,
  ): Promise<void> {
    this.ledger(accountId).push({
      at: new Date().toISOString(),
      delta: credits,
      kind: "purchase",
      ref: orderId,
    });
  }

  async recent(accountId: string, limit: number): Promise<UsageEntry[]> {
    return this.ledger(accountId)
      .slice(-limit)
      .reverse()
      .map(({ at, delta, kind }) => ({ at, delta, kind }));
  }

  /** Test helper: reservations not yet committed or refunded. */
  openReservations(): Reservation[] {
    return [...this.open.values()];
  }
}

export class StubGuard implements Guard {
  readonly recorded: {
    accountId: string;
    kind: CheckKind;
    artifactSignature: string;
    triggered: string[];
  }[] = [];

  async admit(_ctx: {
    accountId: string;
    kind: CheckKind;
    artifact: Artifact;
  }): Promise<Admission> {
    return { admitted: true };
  }

  async shape({
    result,
  }: {
    accountId: string;
    result: CheckResult;
  }): Promise<PublicResult> {
    // The real guard also randomises ids and caps findings when throttled.
    return {
      findings: result.findings,
      scores: result.scores,
      rulePackVersion: result.rulePackVersion,
    };
  }

  async record(ctx: {
    accountId: string;
    kind: CheckKind;
    artifactSignature: string;
    triggered: string[];
  }): Promise<void> {
    this.recorded.push(ctx);
  }
}

export class StubRules implements RulesService {
  async run(req: CheckRequest): Promise<CheckResult> {
    return {
      findings: [
        {
          id: crypto.randomUUID(),
          severity: "info",
          location: req.artifact.kind === "skill-design" ? "SKILL.md:1" : "$",
          message:
            "STUB FINDING: the rules Worker isn't connected, so no real check ran.",
          fix: "Nothing to fix. This finding comes from the development stub (apps/expert-mcp/src/stubs.ts).",
          dimension: "stub",
        },
      ],
      scores: [{ dimension: "stub", band: "C" }],
      rulePackVersion: "stub",
      telemetry: { triggered: ["stub"] },
    };
  }
}

export class StubPurchaseLinks implements PurchaseLinks {
  async create(_accountId: string, productId: string, quantity: number) {
    return {
      url: `https://example.invalid/stub-checkout?product=${encodeURIComponent(productId)}&quantity=${quantity}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<
    string,
    { requestHash: string; response: string }
  >();

  async get(accountId: string, scope: string, key: string) {
    return this.entries.get(`${accountId}\u0000${scope}\u0000${key}`) ?? null;
  }

  async put(
    accountId: string,
    scope: string,
    key: string,
    requestHash: string,
    response: string,
  ) {
    this.entries.set(`${accountId}\u0000${scope}\u0000${key}`, {
      requestHash,
      response,
    });
  }
}
