# Open validation

This is the current list. The original nine source leads remain in `findings.json` as a historical audit snapshot; its `needs_validation` verdicts describe the reviewed baseline, not the current code. The proxy and email request-body buffering leads were removed here because bounded reads are implemented and their isolated Worker cases passed before this follow-up. Deployment of those changes is a release check, not an open security hypothesis.

Current source changes are uncommitted and undeployed. Newly added fixtures have not run under the security-audit skill's required OS isolation. Use dummy data only; do not test real credentials, mailboxes, purchases, or machines.

| Open item | Current source response | Evidence still needed |
| --- | --- | --- |
| Internal upstream redirects | `worker/src/hotaisle.ts` now uses `redirect: "manual"` and rejects 3xx. | Run the dummy redirect fixture in `worker/test/upstream-redirect.test.ts` under the required sandbox. |
| Delayed team callback | `web/src/app/app.tsx` checks the initiating sign-in epoch and account identity before updating the cache or navigating. | Run the delayed two-account component case in `web/src/app/router.test.tsx` under the required sandbox. |
| Machine kind and naming | Action requests use the selected resource's explicit `metal` flag, removing the global name-only endpoint decision. | Run the same-name routing case in `web/src/lib/power-api.test.ts`. Some presentation state is still keyed by name; confirm the upstream cross-kind naming invariant before claiming collision-safe UI behavior. |
| Copied SSH metadata | Hosts, ports, usernames, and SSH config aliases have constrained grammar; malformed text is not offered for copy. | Run the dummy delimiter cases in `web/src/lib/ssh-format.test.ts` under the required sandbox. |
| Cloud-init URL migration | New links are AES-GCM ciphertext under the verified account scope. The launch route no longer accepts or writes `cloudInit`; old plaintext preferences migrate after an encrypted write. | Run `web/src/lib/cloud-init-vault.test.ts` and `web/src/app/route-state.test.ts` under the required sandbox. Existing plaintext preferences remain until successful sign-in and migration; previously saved browser history and bookmarks cannot be erased by this code. |
| Email-start throttling | Cloudflare bindings limit starts to 3 per address and 10 per IP per minute using opaque HMAC counter keys. Local isolated Worker 429 cases passed before this follow-up. | After an authorized deployment, confirm the bindings are live and inspect existing delivery metrics. Per-location counters do not prove a strict global mail budget. |
| Cloudflare Issues metadata | The owner accepted diagnostic metadata. Invocation logs and traces remain disabled; source configuration requests query-string redaction. | After an authorized configuration deployment, verify redaction, actual Issues fields, retention, and dashboard access. The live Worker previously reported redaction off; a zero-user-metadata claim is invalid while Issues is enabled. |

The repository audit files contain repository-relative source paths and public documentation links. The local checkout path and local time-zone identifier were removed from retained metadata.
