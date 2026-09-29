---
id: post_v2_checkout_sessions
name: Create Checkout Session
category: api
version: 2.4.0
tags:
  - Checkout
  - Billing
  - Payment & Subscription API
relations:
  requires: []
  supersedes: []
  related:
    - get_v2_customers_id
summary: Initializes an interactive checkout session for processing customer payments.
updated_at: 2026-09-29T11:18:02.507Z
---

## Endpoint
`POST /v2/checkout/sessions`

## Pre-conditions & Parameters
- `Idempotency-Key` (header, string, **required**) - Unique UUID to prevent double-charging on network retries.

## Request Schema
```json
{
  "_required": [
    "customer_id",
    "currency",
    "line_items"
  ],
  "properties": {
    "customer_id": "string",
    "currency": "string [usd|eur|gbp]",
    "line_items": "array"
  }
}
```

## Responses & Error Guards
- `200`: Session created successfully.
  Schema: `["id","url","status"]`
- `400`: Invalid parameters or currency mismatch.
- `409`: Idempotency conflict detected. A request with this key is currently in-flight.
- `429`: Too many requests. Rate limit exceeded.
