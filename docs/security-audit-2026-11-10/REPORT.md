# Hot Aisle Console security review

**Date:** 2026-11-10  
**Profile:** standard, full in-repository source scope  
**Baseline:** `4e72d26ab835c2f678c31442116968d21a3a84ea` on `chore/adopt-hotaisle-console`; see [run metadata](run-metadata.json) for the in-review changes  
**Method:** [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit) and independent source analysis  
**Budget:** none set  
**Execution:** source-only under the skill's sandboxed source-and-local-only policy; no target tests, builds, browser traffic, or deployed probes were run  
**Prior runs:** no compatible Console audit ledger was available

## Result

**No vulnerability met the audit's confirmed-evidence bar.** The original source pass recorded nine leads. The 2026-11-11 follow-ups resolved all items on the [current validation list](NEEDS-VALIDATION.md), using source changes, ordinary regression evidence, hotManager source inspection, and live Cloudflare configuration/access review. The original ledger remains a record of the baseline audit, not a claim that every external behavior has been tested. This was a complete source pass for the 24 recorded coverage units, not a certification of all Cloudflare, upstream, browser, payment, or machine behavior.

The baseline's strongest source controls were encrypted HttpOnly email sessions, per-request API-key forwarding, a fixed proxy destination with manual redirects, encrypted browser-local API keys and history, scoped team queries, explicit success/failure handling for purchases and machine actions, isolated preview assets, and pinned read-only CI. Subsequent source changes added bounded request reads, manual redirects for internal credential-bearing fetches, account-switch guards, explicit machine-kind routing, copied SSH metadata validation, and encrypted cloud-init URL storage. The regression suite now passes for these changes. This ordinary engineering verification is distinct from the original source-only audit; see [the follow-up log](VALIDATION-2026-11-11.md).

## Confirmed findings

| Severity | Finding | Affected boundary | Observed result |
| --- | --- | --- | --- |
| — | None | — | No cross-boundary security result was independently demonstrated. |

## Needs validation

The [current validation list](NEEDS-VALIDATION.md) has no remaining items. The last three questions were resolved in [RESOLUTION-2026-11-11.md](RESOLUTION-2026-11-11.md): ambiguous machine lists are rejected before entering name-based UI state, hotManager's email attempt limits are documented, and effective Issues redaction/settings and dashboard access were inspected. These were not severity-ranked vulnerabilities. The original nine records in [findings.json](findings.json) retain their baseline verdicts and traces; do not use them as the current work queue.

## Post-audit resource limits

After the source audit, the Worker was configured with 1000 ms of CPU time and 10 subrequests per invocation. These caps cover its current path of one asset or API request, and up to three internal requests when completing email sign-in. Cloudflare [enforces runtime limits only on its network](https://developers.cloudflare.com/workers/wrangler/configuration/#limits); CPU time excludes time waiting on the upstream API. The Worker now reads request bodies incrementally and returns 413 above 1024 bytes for email start or 1 MiB for proxied API calls. The 1 MiB ceiling covers the console's current JSON requests, including custom cloud-init URLs.

The subsequent rate-limit change added five separate Cloudflare bindings: 3 email starts per address per minute, 10 email starts per client IP per minute, 60 upstream credential checks per IP per minute, 120 proxied reads per credential and path per minute, and 30 proxied writes per credential per minute. HMAC-SHA256 with the Worker session secret and a purpose label yields opaque counter keys; the binding does not receive raw addresses, IPs, or credentials. The counters are temporary Cloudflare-managed rate state, not account or machine history. The Worker returns 429 with `Retry-After: 60` when a check fails and 503 if the binding cannot be checked. The limits leave room for normal availability and per-machine polling. [Cloudflare says binding limits are approximate and local to a Cloudflare location](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/#accuracy), so they cannot prove a strict global mail or API budget. The original email-abuse finding remains a baseline observation; live upstream behavior still needs validation.

The 2026-11-11 verification passed Ultracite, TypeScript, all 203 tests across 45 files, the production build, and a deployment dry-run. The Worker suite's five files and 28 tests also passed before each commit. The generated config contains `cpuMs: 1000`, `subrequests: 10`, and all five rate-limit bindings with their intended thresholds. Local tests confirm oversized request bodies are rejected and blocked email requests and API calls return 429 without reaching the upstream fixture; redirect, account-switch, machine-routing, SSH, and cloud-init regressions also pass. Deployment completed for source `40fb99f`, and the production dashboard confirms the five limiter bindings. These checks do not establish Cloudflare's live distributed accuracy or upstream mail policy.

The final follow-up verified hotManager's policy at `ba6751a5fe5f4a6153899e149a33b83513ef3b91`: ten
attempts per normalized mailbox and fifty per valid client IP per ten-minute fixed window, held in
bounded process-local counters. These limits precede delivery and do not promise a fleet-wide budget.
The naming guard added two fixture cases, bringing the passing total to 205 tests, and was deployed as
source `2743ea8`, Worker version `c153e747-f0bb-461b-aa3b-8a72d5f80d23`.

## Deployment and privacy

The owner requested Workers Logs and Issues and explicitly accepted diagnostic metadata. [The Worker configuration](../../worker/cloudflare.config.ts) enables both, persists diagnostic logs, disables automatic invocation logs and traces, and requests query-string redaction. The initial dashboard-only change left redaction off; the successful live `script-settings` response now confirms `redact_query_string: true`. Dashboard inspection also confirms Logs and Issues **on**, invocation logs and traces **off**, and log persistence **on**. An existing scanner occurrence showed request path/method and platform/correlation metadata with no application user/session context attached. Accepted dashboard members are account administrators; the inspected account-owned token inventory has no Workers observability permission. [Cloudflare documents seven-day occurrence detail retention](https://developers.cloudflare.com/workers/observability/issues/investigate/), with issue summaries remaining afterward. Paths can contain team handles, and one observed record does not establish all possible payloads. Do not claim zero diagnostic user metadata or exhaustive credential inventory. See [the resolution evidence](RESOLUTION-2026-11-11.md).

Root [`docs/`](../) is outside the Worker asset root `web/dist`. The standard build and deployment scripts run an asset guard that rejects a `docs/` directory, Markdown files, and named audit records if copied into `web/dist`. The post-audit production build and deployment dry-run passed that guard and packaged 28 assets. A direct deployment of an arbitrary stale prebuilt artifact is outside this guarantee. This report is in a public Git repository and will be visible on GitHub if pushed, even though it is excluded from the deployed site.

## Coverage and limits

The [coverage ledger](coverage-ledger.json) has **24 units**: 12 covered from source, 8 with one or more candidates, 4 blocked on deployed upstream behavior, 0 deferred, and 0 out of scope within the declared repository scope. Four hunting waves and a separate final-clean critic ended with no accepted missing units or reassignments. Nine candidate records were independently checked and retained as `needs_validation`; none was elevated to confirmed. No prior confirmed finding was carried forward. A tracked-file scan found no credential file or obvious private-key/token pattern, but dependency advisories and historical Git secrets were not checked against external feeds.

The original audit used source-only evidence because its full execution sandbox contract was not established. The later owner-authorized operational verification ran ordinary fixture tests and read-only deployment checks; it is not an independent sandboxed audit reproduction. Closed regression checks and deployment evidence are documented in [VALIDATION-2026-11-11.md](VALIDATION-2026-11-11.md) and [RESOLUTION-2026-11-11.md](RESOLUTION-2026-11-11.md). The current validation queue is empty within those stated evidence limits.
