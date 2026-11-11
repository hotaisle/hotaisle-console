# Open validation

Updated 2026-11-11 after deploying `40fb99f` as Worker version `c5ece2fd-9f9a-45bd-9e47-fdede99c6312`.
Only unresolved checks belong here. Closed implementation checks and their evidence are recorded in
[the follow-up validation log](VALIDATION-2026-11-11.md). The nine original records in `findings.json`
remain a historical baseline, not the current work queue.

| Open item | Verified response | Evidence still needed |
| --- | --- | --- |
| Cross-kind machine naming | Actions use the selected resource's explicit `metal` flag. The same-name VM/bare-metal endpoint routing regression passed. | Some presentation state is still keyed by name. Confirm the upstream cross-kind naming invariant before claiming collision-safe UI behavior. No real machine operation was performed. |
| Upstream mail limits | Deployment output and the production dashboard confirm the email rate-limit bindings. Generated configuration specifies 3 starts per address and 10 per IP per minute; local Worker tests verify 429 handling without reaching the upstream fixture. | Inspect existing upstream delivery metrics and throttling policy. Per-location counters do not prove a strict global mail budget. No email was sent for this review. |
| Cloudflare Issues metadata and access | The owner accepted diagnostic metadata. The production dashboard shows Logs, persisted logs, and Issues enabled, with invocation logs and traces disabled. The deployed package requests query-string redaction. | The dashboard does not expose query redaction in the inspected settings, so effective redaction remains unverified. Confirm actual Issues fields, retention, and authorized dashboard access from existing records and policy. Do not claim zero diagnostic user metadata while Issues is enabled. |

Use existing owner-observed records or dummy data for the remaining checks. Do not test real credentials,
mailboxes, purchases, or machines. The retained audit contains repository-relative paths and public links only.
