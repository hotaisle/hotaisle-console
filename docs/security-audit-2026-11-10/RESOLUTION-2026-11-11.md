# Remaining validation resolved: 2026-11-11

This follow-up resolves the three questions left by [the earlier validation pass](VALIDATION-2026-11-11.md).
It combines read-only hotManager source inspection, fixture regressions, live Cloudflare configuration,
an existing diagnostic occurrence, and administrative access inventory. It is not a new full audit.

## Machine names

Upstream source inspection established that the Console must not assume display names are globally
unique. Public evidence here describes the Console's resulting invariant and regressions; private
upstream implementation paths and deployment details are omitted.

The initial mitigation rejected duplicate names in the combined response (commit `2743ea8`).
That restriction is superseded by composite identity
handling: `shared/machine-identity.ts` uses **team handle, API collection, deployment ID**. The API’s
resource endpoints also accept deployment IDs. The collections are `virtual_machines` and
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

The production build of public commit `cb73a79` was deployed on 2026-11-11. Deployment and artifact
checks confirmed the expected source was active and the served frontend matched the local build.
The build links to PR #1. Existing secrets were retained. Production version identifiers, raw control-plane
responses, and artifact fingerprints are omitted from this public record. This replaces the temporary
duplicate-name guard above; later audit-documentation commits do not change the deployed code or its
excluded documentation assets.

Keyboard shortcuts now use TanStack Hotkeys with exclusive dialog/action scopes. The native help modal
lists only active, enabled registrations from the page or section where it was opened. Chrome checks
confirmed that question-mark typing remains in the public-key field, Settings omits machine/launch
commands, end confirmation lists its own cancel command, launch lists only available sizes and its
eligible hold action, and Escape closes help before it can navigate the underlying page. Automated
regressions also cover nested editable content, IME composition, disabled commands, route changes,
release-before-confirmation and cancellation of a held background command when another scope opens.
This is ordinary engineering verification, separate from the original source-only security audit.

## Upstream email limits

Upstream source inspection confirmed mailbox and client-address attempt limits before email delivery,
including mailbox normalization and a source regression for case variants. Those upstream tests were
inspected, not executed in this follow-up. Exact upstream thresholds, counter capacities, implementation
paths, and process topology are omitted from the public record.

The Console's independently configured edge limits and passing Worker limiter regressions remain
documented in its public source. The Worker does not forward browser IPs to override upstream identity.
No real email was sent. This resolves the source-policy question without claiming a strict global
delivery guarantee or independently attesting the deployed upstream revision.

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

The dashboard agrees with these toggles. Existing diagnostic metadata was inspected without generating
a production failure. Raw diagnostic records, request values, and identifying metadata are excluded from
the public record. One sample does not establish every possible error payload.

[Cloudflare documents](https://developers.cloudflare.com/workers/observability/issues/investigate/)
that available diagnostic context depends on the captured failure, occurrence details last seven days,
and issue summaries remain listed afterward. Query redaction does not hide path segments, and it does
not remove secrets accidentally included in an application error. The source still avoids explicit
Worker logging and application tracing; the owner's acceptance of diagnostic metadata remains necessary.

Read-only access and retention review was performed without changing roles, credentials, or export
settings. Account membership, token inventories, individual grants, and diagnostic export configuration
are operational information and are excluded from the public record. The inspection was not an exhaustive
credential inventory and does not prove that no delegated access exists.
[Cloudflare's permission model](https://developers.cloudflare.com/workers/authorization/workers/)
controls observability access through Workers roles and scope. No application code was changed or
deployed through the dashboard during this inspection.

## Release and limits

Lint, type checks, the 205-test suite, the required 28-test Worker suite, production build, packaging
guard, and deployment dry-run passed. The naming fix was deployed with the existing secrets retained.
The 28-asset package excludes audit documents and local preview fixtures.

The three original questions are resolved at the stated evidence level. This does not claim exhaustive
Cloudflare credential inventory, live upstream revision attestation, strict global mail throttling,
all possible diagnostic payloads, or real machine/payment behavior. These are explicit scope limits,
not unperformed versions of the now-completed naming, upstream-policy, and Issues-settings checks.
