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

The initial mitigation rejected duplicate names in the combined response (commit `2743ea8`, Worker
version `c153e747-f0bb-461b-aa3b-8a72d5f80d23`). That restriction is superseded by composite identity
handling: `shared/machine-identity.ts` uses **team handle, API collection, deployment ID**. The API’s
`getVirtualMachineByName` and
`getServerByName` also accept deployment UUIDs: their assignment lookup checks active state, object type
and the selected tenant before resolving the resource. The collections are `virtual_machines` and
`bare_metal`; names remain display labels and need not be globally unique. Deployment IDs distinguish
successive rentals that reuse a name, as well as same-kind resources with the same display name.

The combined response now accepts a same-name VM and bare-metal server. Query status keys, UI selection,
React keys, launch metadata, optimistic launch/release updates, receipt deduplication, stage tags and
animation identities all retain the tuple. Actions continue to use the selected resource's explicit kind.
Canonical machine and history URLs include the API collection and deployment ID. A unique legacy
name-only link upgrades in place; an ambiguous link shows a choice/error instead of silently selecting either kind. Unknown
collections and missing resources cannot resolve to an unrelated machine. Page routing distinguishes
route segments from resource names such as “settings” or “history”.

The encrypted journal schema, account scope, cryptographic keys and storage prefix are unchanged.
New entries also retain the API deployment ID. Existing entries carry team/name and an optional metal
flag (omitted means VM) and remain readable. Name-only launch metadata is associated with an active
resource only when its kind/name match is unambiguous; an exact deployment record takes precedence.
Older receipts without IDs retain their legacy name-based identity; missing IDs cannot be reconstructed.
Replay builds the indexes in memory; unlocking performs no ciphertext rewrite or deletion. Ending one kind
preserves the other kind's launch metadata and receipts. No history migration or Cloudflare storage is
introduced.

Focused regressions cover same-name and repeated-rental IDs, API listing/action endpoints; independent
polls; typed deep links, reload and back; ambiguous and unique legacy machine/history links; optimistic release/relaunch;
separate stage status/host/focus; record pruning and encrypted journal replay. The local-only “Same-name
VM + bare metal” scenario exercises the real components with simulated transport. Production packaging
continues to reject preview assets and audit documents. No real machine operation is used for validation.

### Verification and rollout of the replacement

The composite identity and contextual TanStack keyboard changes pass Ultracite, TypeScript, and all
238 tests across 50 files. The production build and deployment dry-run pass with 28 packaged assets;
the asset guard excludes local preview code and audit documents. Chrome verification used the existing
local preview process and browser-only fixtures. Same-name resources select distinct deployment URLs,
retain their type-specific operations, and restore through navigation. No real upstream credentials,
purchases or machine actions were exercised. Signed commit `8d1289a` contains the machine identity
change, and signed commit `cb73a79` contains the contextual keyboard controls. The required GitHub CI
job passed for `cb73a79` before deployment. The 31-test Worker suite also passed before each commit.

The production build of `cb73a794f6b823bae2c4e1a3f699d4adca7e6cfb` was deployed on 2026-11-11 at
18:54 UTC as Worker version `752d54d1-6560-4e25-840b-3df422d1a8b5`. The active deployment response
confirmed this version receives 100% of traffic. An anonymous sign-in request returned 200 with the
expected CSP and `/assets/index-Brn2dxcv.js`; the served script's SHA-256 matched the local production
artifact (`4e87a7aac53a7a10d26470a6984124e52c77dac51465f58fc7ef3f89d2abbc12`). The build links to
PR #1. Existing secrets were retained. This replaces the temporary duplicate-name guard above; later
audit-documentation commits do not change the deployed code or its excluded documentation assets.

Keyboard shortcuts now use TanStack Hotkeys with exclusive dialog/action scopes. The native help modal
lists only active, enabled registrations from the page or section where it was opened. Chrome checks
confirmed that question-mark typing remains in the public-key field, Settings omits machine/launch
commands, end confirmation lists its own cancel command, launch lists only available sizes and its
eligible hold action, and Escape closes help before it can navigate the underlying page. Automated
regressions also cover nested editable content, IME composition, disabled commands, route changes,
release-before-confirmation and cancellation of a held background command when another scope opens.
This is ordinary engineering verification, separate from the original source-only security audit.

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
