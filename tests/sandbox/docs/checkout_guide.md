# The Complete Guide to Global Payment Integrations

<div class="hero-banner">
  <img src="https://example.com/assets/banner.png" alt="Payment Hero" />
  <h1>Welcome to Developer Hub v2026</h1>
  <p>Empowering millions of digital businesses worldwide!</p>
</div>

Welcome, engineer! We are beyond excited to welcome you into our payments ecosystem. In this comprehensive, multi-chapter reference guide, we will explore the philosophical foundations of financial ledgering, payment state machines, double-entry bookkeeping, and global currency compliance.

---

## Setting Up Customer Accounts

Before any transaction can take place in our system, you must create a verified customer object. A customer holds the billing records, payment credentials, and transaction ledger.

```typescript
// Sample client setup
const client = new PaymentClient({ apiKey: 'sk_live_123456789' });
```

### Critical Invariants:
- Never collect plain credit card numbers on your client server.
- All requests must include the `Idempotency-Key` header (UUIDv4).
- The `country_code` must strictly follow ISO-3166-1 alpha-2 format.

---

## Hosted Checkout Session Architecture

The hosted checkout flow allows you to redirect your customers to a localized payment page that automatically handles 3D Secure 2, Apple Pay, Google Pay, and localized fraud screening.

### Handling Idempotency & Concurrency:
When an agent or user double-submits a payment, our servers will return HTTP 409 Conflict. You must catch this status code, wait for the original transaction to resolve, and not trigger a secondary checkout session.

```bash
curl -X POST https://api.payments-corp.com/v3/checkout/sessions \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "cus_123", "currency": "usd", "line_items": [{"price_id": "pr_1", "quantity": 1}], "success_url": "https://example.com/success", "cancel_url": "https://example.com/cancel"}'
```
