---
id: secret_key_authentication
name: Secret Key Authentication
category: guide
tags:
  - sample_doc
  - secret
  - authentication
relations:
  requires: []
  supersedes: []
  related:
    - authentication_guide
    - webhook_signature_verification
summary: When integrating our SDK on your backend server, you should always
  treat your Secret Key like a bank password. Never share it with untrusted
  parties or commit i
updated_at: 2026-09-29T11:18:02.491Z
---

When integrating our SDK on your backend server, you should always treat your Secret Key like a bank password. Never share it with untrusted parties or commit it to GitHub public repositories.

To authenticate requests, simply attach your secret key in the standard `Authorization` header:

```bash
curl https://api.example.com/v2/charges \
  -H "Authorization: Bearer sk_live_9988776655" \
  -H "Content-Type: application/json"
```

### Constraints & Edge Cases
- Secret keys always begin with the prefix `sk_live_` or `sk_test_`.
- Test keys can never be used to process real financial transactions.
- If your key is compromised, immediately rotate it via our dashboard.
