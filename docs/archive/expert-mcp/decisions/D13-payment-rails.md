# D13: Payment rails

Status: **decided 2026-10-28.**

## Decision

The expertise service accepts only micropayment rails, paid per request:

- **x402**, in EURC (preferred) or USDC on Base, through an x402 facilitator
  (Coinbase CDP at first).
- **MPP** (Machine Payments Protocol, Stripe with Tempo), for buyers paying in
  fiat without a crypto wallet.

No ACP checkout, no credit packs, no prepaid balance, no annual invoiced plan.
The ACP package (spec 01, PR #128) is closed without merging.

Prices stay as D6 sets them, now charged per check instead of in credits: skill
design EUR 5, API governance EUR 10 (+EUR 5 per 50 operations over 50), process
review EUR 15, excluding VAT.

## Why

- **Different kinds of protocol.**
  - ACP is a checkout protocol: cart, checkout session, a card payment token
    through a payment provider. It suits buying a product and is too heavy per
    call.
  - x402 and MPP pay per HTTP request. That matches how agents call the checks,
    and how a future data set would be sold (D6).
- **No card fee floor.** Card payments carry a fixed fee per charge, which is why
  packs existed. x402 settlement costs fractions of a cent.
- **Simpler system.** No checkout state machine, credit ledger or reservations.
  The verify-then-settle flow also means a failed check is never paid, instead
  of being refunded.

## What it costs, and how the design answers it

| Concern | Answer (spec) |
| --- | --- |
| Wallets are free to create, which weakens anti-extraction | Every payer is bound to an OAuth account. Wallets bind by signed message, a limited number per account, and shared wallets or cards link accounts (03, 05) |
| Many business buyers hold no stablecoins | MPP covers fiat through Stripe (03) |
| VAT and invoices per micro-payment | Prices exclude VAT; reverse charge for EU businesses; a monthly statement per account works as the invoice (03). The accountant confirms (D5) |
| Receiving crypto in the EU | Settled EURC/USDC lands at Brandon's address; conversion and booking are his process. The accountant confirms the MiCA and Dutch tax treatment (D5) |
| Payments on a public blockchain are visible | Said plainly in the privacy statement (07) |
| Young protocols, conflicting sources | Spec 03 starts by checking the official specs and SDKs, and records any differences |

## Look again when

- an agent client ecosystem settles on one rail (drop the other),
- x402 facilitators offer EU-regulated fiat settlement (fewer moving parts),
- the D6 triggers fire.
