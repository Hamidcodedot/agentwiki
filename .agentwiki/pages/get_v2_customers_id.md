---
id: get_v2_customers_id
name: Retrieve Customer
category: api
version: 2.4.0
tags:
  - Customer
  - Billing
  - Payment & Subscription API
relations:
  requires: []
  supersedes: []
  related:
    - post_v2_checkout_sessions
summary: Fetches account status and stored payment methods for a customer.
updated_at: 2026-09-29T11:18:02.507Z
---

## Endpoint
`GET /v2/customers/{id}`

## Pre-conditions & Parameters
- `id` (path, string, **required**) - Customer identifier

## Responses & Error Guards
- `200`: Customer found
  Schema: `["id","email","delinquent"]`
- `404`: Customer not found
