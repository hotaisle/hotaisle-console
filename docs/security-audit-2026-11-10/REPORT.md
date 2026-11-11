# Hot Aisle Console security review

**Date:** 2026-11-10  
**Profile:** standard, full in-repository source scope  
**Baseline:** `4e72d26ab835c2f678c31442116968d21a3a84ea` on `chore/adopt-hotaisle-console`; see [run metadata](run-metadata.json) for the in-review changes  
**Method:** [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit) and independent source analysis  
**Budget:** none set  
**Execution:** source-only under the skill's sandboxed source-and-local-only policy; no target tests, builds, browser traffic, or deployed probes were run  
**Prior runs:** no compatible Console audit ledger was available

## Result

**No vulnerability met the audit's confirmed-evidence bar.** The original source pass recorded nine leads. The 2026-11-11 operational follow-up closed six implementation checks using source changes and ordinary regression evidence; three external questions remain on the [current validation list](NEEDS-VALIDATION.md). The original ledger's upstream behavior gaps remain outside that regression evidence. This was a complete source pass for the 24 recorded coverage units, not a certification of live Cloudflare, upstream, browser, payment, or machine behavior.

The baseline's strongest source controls were encrypted HttpOnly email sessions, per-request API-key forwarding, a fixed proxy destination with manual redirects, encrypted browser-local API keys and history, scoped team queries, explicit success/failure handling for purchases and machine actions, isolated preview assets, and pinned read-only CI. Subsequent source changes added bounded request reads, manual redirects for internal credential-bearing fetches, account-switch guards, explicit machine-kind routing, copied SSH metadata validation, and encrypted cloud-init URL storage. The regression suite now passes for these changes. This ordinary engineering verification is distinct from the original source-only audit; see [the follow-up log](VALIDATION-2026-11-11.md).

## Confirmed findings

| Severity | Finding | Affected boundary | Observed result |
| --- | --- | --- | --- |
| — | None | — | No cross-boundary security result was independently demonstrated. |

## Needs validation

The [current validation list](NEEDS-VALIDATION.md) contains three remaining owner-side questions: cross-kind machine naming, upstream mail limits, and Issues metadata/access. They are not severity-ranked vulnerabilities. Completed fixture checks were removed from that list. The original nine records in [findings.json](findings.json) are a historical source snapshot and retain their original verdicts and traces; do not use them as the current work queue.

## Post-audit resource limits

After the source audit, the Worker was configured with 1000 ms of CPU time and 10 subrequests per invocation. These caps cover its current path of one asset or API request, and up to three internal requests when completing email sign-in. Cloudflare [enforces runtime limits only on its network](https://developers.cloudflare.com/workers/wrangler/configuration/#limits); CPU time excludes time waiting on the upstream API. The Worker now reads request bodies incrementally and returns 413 above 1024 bytes for email start or 1 MiB for proxied API calls. The 1 MiB ceiling covers the console's current JSON requests, including custom cloud-init URLs.

The subsequent rate-limit change added five separate Cloudflare bindings: 3 email starts per address per minute, 10 email starts per client IP per minute, 60 upstream credential checks per IP per minute, 120 proxied reads per credential and path per minute, and 30 proxied writes per credential per minute. HMAC-SHA256 with the Worker session secret and a purpose label yields opaque counter keys; the binding does not receive raw addresses, IPs, or credentials. The counters are temporary Cloudflare-managed rate state, not account or machine history. The Worker returns 429 with `Retry-After: 60` when a check fails and 503 if the binding cannot be checked. The limits leave room for normal availability and per-machine polling. [Cloudflare says binding limits are approximate and local to a Cloudflare location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/#accuracy), so they cannot prove a strict global mail or API budget. The original email-abuse finding remains a baseline observation; live upstream behavior still needs validation.

The 2026-11-11 verification passed Ultracite, TypeScript, all 203 tests across 45 files, the production build, and a deployment dry-run. The Worker suite's five files and 28 tests also passed before each commit. The generated config contains `cpuMs: 1000`, `subrequests: 10`, and all five rate-limit bindings with their intended thresholds. Local tests confirm oversized request bodies are rejected and blocked email requests and API calls return 429 without reaching the upstream fixture; redirect, account-switch, machine-routing, SSH, and cloud-init regressions also pass. Deployment completed for source `40fb99f`, and the production dashboard confirms the five limiter bindings. These checks do not establish Cloudflare's live distributed accuracy or upstream mail policy.

## Deployment and privacy

The owner requested Workers Logs and Issues and explicitly accepted diagnostic metadata. [The Worker configuration](../../worker/cloudflare.config.ts) enables both, persists diagnostic logs, disables automatic invocation logs and traces, and requests query-string redaction. The initial dashboard-only change left redaction off; the 2026-11-11 code deployment now includes the requested redaction setting. Post-deploy dashboard inspection confirms Logs and Issues **on**, invocation logs and traces **off**, and log persistence **on**. The inspected controls do not expose effective query redaction, so that fact remains unverified. There are no explicit `console.*` calls in `worker/src`. [Cloudflare says Issues occurrences can include request details](https://developers.cloudflare.com/workers/observability/issues/investigate/) and are retained for seven days; actual fields, retention, and authorized access remain owner-side checks. Team handles can appear in API paths. Do not claim zero diagnostic user metadata while Issues is enabled.

Root [`docs/`](../) is outside the Worker asset root `web/dist`. The standard build and deployment scripts run an asset guard that rejects a `docs/` directory, Markdown files, and named audit records if copied into `web/dist`. The post-audit production build and deployment dry-run passed that guard and packaged 28 assets. A direct deployment of an arbitrary stale prebuilt artifact is outside this guarantee. This report is in a public Git repository and will be visible on GitHub if pushed, even though it is excluded from the deployed site.

## Coverage and limits

The [coverage ledger](coverage-ledger.json) has **24 units**: 12 covered from source, 8 with one or more candidates, 4 blocked on deployed upstream behavior, 0 deferred, and 0 out of scope within the declared repository scope. Four hunting waves and a separate final-clean critic ended with no accepted missing units or reassignments. Nine candidate records were independently checked and retained as `needs_validation`; none was elevated to confirmed. No prior confirmed finding was carried forward. A tracked-file scan found no credential file or obvious private-key/token pattern, but dependency advisories and historical Git secrets were not checked against external feeds.

The original audit used source-only evidence because its full execution sandbox contract was not established. The later owner-authorized operational verification ran ordinary fixture tests and read-only deployment checks; it is not an independent sandboxed audit reproduction. Closed regression checks and deployment evidence are documented in [VALIDATION-2026-11-11.md](VALIDATION-2026-11-11.md); only the remaining external questions appear in [NEEDS-VALIDATION.md](NEEDS-VALIDATION.md).
