# Terms of service: scaffold

> **Scaffold, not legal text.** Headings and the points each section must cover,
> taken from the spec. Every `TODO(Brandon)` needs Brandon's wording, ideally
> reviewed by a lawyer. Spec 07 moves the approved text to
> `apps/site/content/expert/terms/<version>.md` and publishes it at `/expert/terms`.
> The gateway's `TERMS_VERSION` must match the published version.

Version: `TODO(Brandon): e.g. 2026-11-01`

## 1. Who we are

- Seller of record: `TODO(Brandon): legal entity name, KvK number, VAT number,
  address, contact email` (blocked on decision D5).

## 2. Who can use the service

- `TODO(Brandon): business customers only (B2B), or consumers too?` This choice
  changes a lot: selling to consumers in the EU brings the 14-day withdrawal right
  for digital content, and the consent and acknowledgement needed before it lapses.
  Business-only keeps the terms much simpler. Ask the lawyer.
- An account is for one organisation or person. Accounts can't be shared or
  transferred.
- The account holder is responsible for every agent, CLI install and API token
  acting on the account.

## 3. The service

- What the checks are: API governance (OpenAPI 3.0/3.1), skill design (Agent
  Skills) and process description review.
- Results are automated findings from a rule set, not personalised professional
  advice, and not a guarantee of compliance with any law or standard.
  `TODO(Brandon): wording`
- Rule sets change over time; each result carries the rule-pack version.
- Availability: no uptime commitment in v1. `TODO(Brandon): confirm`

## 4. Credits, prices and payment

- Credits are bought in packs (prices at `/expert/pricing`, decision D6).
- Each check costs a stated number of credits, charged when it runs and refunded
  automatically if the check fails on our side.
- No free trial (decision D10).
- `TODO(Brandon): do credits expire? (e.g. 12 months after purchase)`
- `TODO(Brandon): refunds for unused credits: none, or on request within N days?`
- Payment through Stripe, VAT included or added as applicable (Stripe Tax).
- Chargebacks or disputes freeze the account until resolved.

## 5. Your inputs

- You keep all rights in what you submit.
- You confirm you may submit it (no third-party secrets or personal data you
  aren't allowed to share).
- Artifacts aren't stored; only structural signatures and which rules triggered,
  for 180 days, for abuse prevention (see the privacy statement).

## 6. Outputs and licence

- You may use results for your own internal purposes, including sharing them
  within your organisation and acting on them in your own products.
- `TODO(Brandon): may customers share reports with their own clients, e.g.
  consultants?`

## 7. Prohibited use (the anti-extraction clause)

Core of the terms; every item is grounded in spec 05.

- No use of results, alone or combined, to **train, fine-tune, evaluate, distil
  or benchmark** any machine-learning model or automated system.
- No attempt to **reconstruct, reverse-engineer or replicate the rules**, scoring
  or methodology behind the checks, including by submitting artifacts made for
  that purpose.
- No submitting artifacts that aren't real work of yours or your organisation's
  (synthetic, generated or templated variants meant to probe the checks).
- No splitting usage across accounts to get around limits.
- No resale, sublicensing or offering the checks as part of another service.
- No circumventing rate limits, quotas or security measures, and no attacks on the
  service.
- `TODO(Brandon): wording for each`

## 8. Monitoring and enforcement

- Usage is monitored automatically for the patterns above.
- We can throttle, suspend or close an account that appears to breach section 7,
  with notice where possible. `TODO(Brandon): appeal / contact route`
- On a breach, unused credits may be forfeited. `TODO(Brandon): check
  enforceability with the lawyer`
- Results carry markers that let us identify the account they were issued to.

## 9. Intellectual property

- The checks, rules, scoring models, wording of findings and the service itself
  are Brandon's intellectual property. Nothing in these terms transfers it.

## 10. Liability

- `TODO(Brandon): liability cap (e.g. amount paid in the last 12 months),
  exclusions, and what can't be excluded under Dutch law`

## 11. Changes to these terms

- New versions are published with a new version id. Continued use requires
  accepting the new version at the next sign-in or OAuth consent.

## 12. Ending the agreement

- You can close your account at any time. `TODO(Brandon): what happens to unused
  credits`
- We can end the service with `TODO(Brandon): notice period` notice.

## 13. Governing law and disputes

- `TODO(Brandon): Dutch law; competent court (e.g. Rechtbank <city>)`
