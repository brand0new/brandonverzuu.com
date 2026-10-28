# Privacy statement: scaffold

> **Scaffold, not legal text.** Structure and the facts the system design fixes,
> from specs 02, 03, 05, 06 and 09. Every `TODO(Brandon)` needs Brandon's wording,
> ideally reviewed by a lawyer. Spec 07 publishes the approved text at
> `/expert/privacy`. Covers the expertise service only; the static site itself
> collects no personal data. `TODO(Brandon): confirm, e.g. no analytics`

Version: `TODO(Brandon)`

## 1. Controller

- `TODO(Brandon): legal entity, address, contact email for privacy questions`
  (blocked on decision D5).

## 2. What we collect, why, and on what basis

`TODO(Brandon + lawyer): confirm each legal basis (GDPR art. 6(1))`

| Data | Why | Proposed basis | Kept for |
| --- | --- | --- | --- |
| Email address (and its keyed hash) | Sign-in, receipts, account notices | Contract | Account lifetime + `TODO` |
| Terms version accepted, account status | Proving consent to terms, enforcement | Contract / legitimate interest | Account lifetime |
| Payment records: amounts, dates, VAT, the paying wallet address or Stripe payment reference, transaction hash | Accounting and tax | Legal obligation | `TODO(Brandon): Dutch tax retention period, commonly 7 years` |
| Bound payers: wallet addresses, hashed card fingerprints (from Stripe, not the card number) | Linking payments to the account, and accounts that share a payment method, against limit evasion | Legitimate interest (abuse prevention) | `TODO` |
| Artifact structural signatures, triggered rule ids, timestamps | Detecting rule reconstruction and probing | Legitimate interest (protecting the service and its IP) | 180 days |
| Result hash and marker seed | Tracing leaked results to an account | Legitimate interest | `TODO` |
| CLI install id (random) | Linking CLI installs to an account's limits | Legitimate interest | `TODO` |
| OAuth client metadata, API token metadata (not the token itself) | Security and access management | Contract | Until revoked + `TODO` |
| Technical logs (request ids, timings, sizes, no content) | Operating and securing the service | Legitimate interest | `TODO(Brandon): e.g. 30 days` |

What we **don't** keep: the artifacts you submit (OpenAPI files, skill folders,
process descriptions) or the full results. They're processed in memory and
discarded.

## 3. Automated decisions

- Accounts can be throttled or frozen automatically when usage looks like rule
  reconstruction (spec 05). Freezing is always reviewed by a person before the
  account is closed.
  `TODO(Brandon + lawyer): wording on GDPR art. 22 and how to contest a decision`

## 4. Who processes data for us

| Processor | Role | Location |
| --- | --- | --- |
| Cloudflare | Hosting, database, storage | Stored data in the EU (EU jurisdiction for D1 and Durable Objects); edge processing worldwide `TODO(Brandon): confirm wording with Cloudflare's DPA` |
| Stripe | Fiat payments (MPP), tax | `TODO: Stripe's entity for EU customers and its transfer mechanism` |
| x402 facilitator (Coinbase CDP) | Verifying and settling stablecoin payments | `TODO: entity and location` |
| Base blockchain | Settlement of x402 payments | Public and global: a payment, its amount and both addresses are visible to anyone, permanently |
| `TODO: email provider for sign-in links` (spec 02) | Sending sign-in links and receipts | `TODO` |

`TODO(Brandon): transfers outside the EEA and their safeguards (e.g. SCCs or the
EU-US Data Privacy Framework), per processor`

## 5. Your rights

- Access, correction, deletion, restriction, objection (including to processing
  based on legitimate interest) and data portability.
- How to exercise them: `TODO(Brandon): contact`
- The right to complain to the Dutch data protection authority (Autoriteit
  Persoonsgegevens) or your local authority.
- Deletion limits: order records required for tax are kept for the legal period.

## 6. Security

- Data stored in the EU, encrypted at rest and in transit by the platform.
- Email addresses also kept as keyed hashes for lookups; tokens stored only as
  hashes.
- `TODO(Brandon): breach notification wording`

## 7. Changes

- New versions published with a version id and date.
