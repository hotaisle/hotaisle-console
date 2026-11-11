# Remaining validation resolved: 2026-11-11

This follow-up resolves the three questions left by [the earlier validation pass](VALIDATION-2026-11-11.md).
It combines read-only hotManager source inspection, fixture regressions, live Cloudflare configuration,
an existing diagnostic occurrence, and administrative access inventory. It is not a new full audit.

## Machine names

Reviewed hotManager revision `ba6751a5fe5f4a6153899e149a33b83513ef3b91`, with a clean worktree.
`vm/create.go` checks existing VM names in the selected cluster and reserves names with a process lock.
Automatically generated names use the cluster's configured prefix and a numeric suffix. That code does
not reserve names against inventory devices. `api/teams/resources/vm/virtual_machine.go` returns the VM's
name; `api/teams/resources/baremetal/bare_metal.go` independently returns the device's name. There is no
source guarantee of cross-kind uniqueness on which the Console can rely.

The Console now rejects duplicate names in the combined machine response before returning it to Query,
selection, routing, or presentation state. It does not silently choose one of the ambiguous resources.
The visible error directs the user to support. Existing successful cached data can remain visible after
a failed background refresh, but the ambiguous replacement list is not installed. Actions continue to
use the selected machine's explicit kind. This deliberately blocks a colliding response rather than
claiming that the current name-based interface can represent both resources at once.

`web/src/lib/power-api.test.ts` now covers duplicate VM names and VM/bare-metal collisions. All 205 tests
across 45 files pass, including existing same-name action endpoint routing. The guard is committed as
`2743ea8` and deployed as Worker version `c153e747-f0bb-461b-aa3b-8a72d5f80d23`.

## Upstream email limits

At the same hotManager revision, `api/user/signin/signin.go` configures:

| Key | Limit | Scope |
| --- | --- | --- |
| Normalized mailbox | 10 requests per ten-minute fixed window | Sign-in router instance |
| Valid client IP | 50 requests per ten-minute fixed window | Sign-in router instance |
| Tracked keys in each limiter | 10,000 | Limiter instance |

The client-IP check runs before signature verification. The parsed mailbox is canonicalized with
`types.NewEmail` before the mailbox check, which runs before policy lookup, ticket creation, and email
delivery. The Worker does not forward the browser's IP to override the upstream client's identity.
`httputil/ratelimit.go` uses a mutex, counts attempts in a fixed window, removes expired entries when
needed, and rejects new keys at capacity without evicting unexpired entries. State is in memory: it is
neither replicated across server processes nor retained across restart. Fixed windows permit boundary
bursts; these are attempt limits, not a strict fleet-wide delivery budget.

`api/user/signin/signin_internal_test.go` contains a regression proving that a differently cased mailbox
hits the primed limiter and returns 429 before backend work. That source/test was inspected, not executed
in this follow-up. Cloudflare's separately verified 3-per-mailbox/minute and 10-per-IP/minute bindings
remain the Console's edge controls, and the Console's Worker limiter regressions pass. No real email
was sent. The previously unknown upstream policy is now documented; no global delivery guarantee is made.

## Cloudflare Issues

The authenticated dashboard's successful `script-settings` response was inspected through Chrome's
network debugger. Only non-secret configuration fields were retained here:

```json
{
  "enabled": true,
  "head_sampling_rate": 1,
  "redact_query_string": true,
  "logs": {
    "enabled": true,
    "head_sampling_rate": 1,
    "persist": true,
    "invocation_logs": false
  },
  "traces": { "enabled": false },
  "issues": { "enabled": true }
}
```

The dashboard agrees with these toggles. An existing scanner occurrence from the preceding deployment
showed method/path, timing, Worker/version, client browser/platform, country, and correlation identifiers.
Its application user/session context was empty. No raw occurrence values, member identities, token names,
or credentials were copied into this report. One sample does not establish every possible error payload.

[Cloudflare documents](https://developers.cloudflare.com/workers/observability/issues/investigate/)
that available diagnostic context depends on the captured failure, occurrence details last seven days,
and issue summaries remain listed afterward. Query redaction does not hide path segments, and it does
not remove secrets accidentally included in an application error. The source still avoids explicit
Worker logging and application tracing; the owner's acceptance of diagnostic metadata remains necessary.

Read-only membership inspection confirmed that dashboard access is held by accepted account
administrators. The dashboard's account-owned token inventory showed only Account Settings Read permission,
with no Workers observability grant. The deployment CLI could not list account-owned tokens with its
OAuth scope, so the already-authorized browser dashboard was used without broadening that credential.
Personal credentials issued by account administrators were not exhaustively inventoried. Administrative
access is trusted authority, not evidence that no delegated credential exists.
[Cloudflare's permission model](https://developers.cloudflare.com/workers/authorization/workers/)
controls observability access through Workers roles and scope. No role, token, export destination, or
Issues status was changed. The dashboard showed no diagnostic export destinations or Logpush job.

Opening Cloudflare's code viewer automatically invoked its temporary editor preview, which lacks the
asset binding and reported an error. No code was edited or deployed from that viewer; this was not a
production failure injection. The browser was returned to production settings and network observation
was disabled after inspection.

## Release and limits

Lint, type checks, the 205-test suite, the required 28-test Worker suite, production build, packaging
guard, and deployment dry-run passed. The naming fix was deployed with the existing secrets retained.
The 28-asset package excludes audit documents and local preview fixtures.

The three original questions are resolved at the stated evidence level. This does not claim exhaustive
Cloudflare credential inventory, live upstream revision attestation, strict global mail throttling,
all possible diagnostic payloads, or real machine/payment behavior. These are explicit scope limits,
not unperformed versions of the now-completed naming, upstream-policy, and Issues-settings checks.
