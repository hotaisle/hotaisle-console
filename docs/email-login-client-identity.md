# Verified Console email-login identity

Implemented and locally validated on 2026-11-11. The owner confirmed that the upstream public-key
registration and service restart are complete. Worker activation is a separate deployment step;
hotManager configuration changes and service commands require owner review before execution.
This is a public implementation summary under the [publication policy](SECURITY-PUBLICATION.md).
It contains no deployment key material, production hostnames, registry contents, or service commands.

## Protocol and key handling

The Worker uses Cloudflare's `http-message-sig` 0.3.0 implementation of RFC 9421 and WebCrypto Ed25519.
Only email-login issuance is signed. The covered components are `@method`, `@target-uri`, and
`content-digest`; the SHA-256 digest covers the exact JSON string sent upstream. The signature label is
`client`, key ID is `hotaisle-console`, algorithm is `ed25519`, and tag is `hotmanager-email-login`.
Each attempt has a new 32-byte random nonce in unpadded base64url, an integer creation time, and an
expiry 60 seconds later. The signing URL must be HTTPS with path `/api/user/email/login/` and no
credentials, query, or fragment. The URL comes from the Worker's upstream configuration, never browser
Host/Forwarded headers. Signed redirects are rejected without retry or unsigned fallback.

`EMAIL_LOGIN_SIGNING_KEY` contains a dedicated base64 PKCS#8 DER private key, imported as a
non-extractable signing key. Its public half is registered in hotManager's `EMAIL_AUTH_CLIENTS` as an
OpenSSH Ed25519 key. No session/history secret is reused. The private key never enters browser responses,
frontend assets, source control, application logs, or hotManager's registry. Missing/invalid signing
configuration returns a generic 503 before contacting the API. Wait, completion, authenticated account
requests, and the browser API proxy do not acquire client signatures.

`bun run identity:email-login` generates the pair once in the ignored
`.cloudflare/email-login-identity/` directory (mode 0700); the secret JSON and public registration JSON
files use mode 0600. A repeated invocation refuses to overwrite either file. Back up the key securely.
Rotation requires coordinating the Worker's private key with hotManager's registered public key.

## Verification performed

- Lint and TypeScript checks passed.
- All 251 tests in 51 files passed, including 44 tests in the isolated Cloudflare Worker runtime.
- The isolated email-login fixture requires a valid signature. Its independent WebCrypto verification
  checks the profile, freshness, digest, and signature using a public RFC 8032 test-vector key.
- Focused tests reject body/method/URL changes, invalid signing targets, missing or malformed keys,
  and signed redirects; successive requests have different nonces/signatures. Unrelated endpoints
  have no signing headers.
- An offline temporary harness passed a freshly signed Worker request to hotManager's actual
  `emailauth.Manager.VerifyClientRequest`, using only the RFC 8032 fixture key and a dummy email.
  hotManager returned client ID `hotaisle-console`, resolved the display name `Hot Aisle Console`,
  and rejected a modified body and replay. No HTTP server or external request was used, and no
  hotManager source/configuration was modified.
- The production build and Cloudflare deployment dry-run passed with 28 assets. Identity credentials,
  tests, documentation, and development preview assets are outside the published frontend assets.
- The generated identity files are ignored by Git and have the expected owner-only permissions.
  A second key-generation invocation failed without replacing them.

## Activation sequence

1. The owner confirmed that the Console public key is registered upstream and the service restarted.
   No hotManager configuration or service command was executed by this implementation task.
2. Deploy the signed Worker with its dedicated secret while retaining the existing session/history
   secrets. Do not deploy this change before the public key is trusted upstream.
3. Start a new owner-initiated sign-in and verify that the approval page names **Hot Aisle Console**.
   Previously issued unsigned links remain unverified. No real sign-in was attempted during tests.

hotManager already supports this registry and signing profile; no hotManager source change is needed.
The registry display name identifies the requesting application, not the person signing in.
