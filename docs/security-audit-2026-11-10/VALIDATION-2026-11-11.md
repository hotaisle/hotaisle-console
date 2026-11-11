# Validation follow-up: 2026-11-11

This records the earlier follow-up. Its three remaining questions were subsequently resolved in
[RESOLUTION-2026-11-11.md](RESOLUTION-2026-11-11.md); use [NEEDS-VALIDATION.md](NEEDS-VALIDATION.md) for current status.

This is an operational follow-up to the source audit, requested by the owner. It reconciles implemented
fixes, ordinary regression tests, packaging, and deployment evidence. It is not a new full audit or an
independent reproduction under the security-audit skill's stricter OS isolation requirements.

## Revision and release

- Reviewed and deployed source: `40fb99f` on `chore/adopt-hotaisle-console`.
- Production activation was checked; operational version identifiers are omitted from this public record.
- The authenticated Cloudflare deployment completed for `console.hotaisle.app`; existing secrets were retained.
- Production Chrome verification showed the Console repository link and build footer link to PR #1.
- The production dashboard showed all five rate-limit bindings, both required secret names, CPU limit
  1000 ms, Logs and Issues enabled, persisted logs enabled, and invocation logs and traces disabled.
- The packaged configuration specifies ten subrequests, query-string redaction, and the intended limiter thresholds.
  Effective query redaction was not independently observable in the inspected dashboard controls.

## Closed implementation checks

| Removed from open validation | Source and passing regression evidence | Scope of conclusion |
| --- | --- | --- |
| Internal upstream redirects | `worker/src/hotaisle.ts`; `worker/test/upstream-redirect.test.ts` verifies manual redirect mode, one credential-bearing call, and a 502 result for a dummy 307. | The adapter does not follow upstream redirects. No external redirect target was contacted. |
| Delayed team callback | `web/src/app/app.tsx`; the delayed two-account case in `web/src/app/router.test.tsx` passed. | A callback from an earlier sign-in cannot update the new account's team cache or navigate it. |
| Copied SSH metadata | `web/src/lib/format.ts`; `web/src/lib/ssh-format.test.ts` covers normal commands, shell/newline delimiters, invalid aliases, and invalid ports. | Malformed tested metadata is not offered as executable SSH/config text. No shell command was executed from API data. |
| Cloud-init URL migration | `web/src/lib/cloud-init-vault.ts`; `web/src/lib/cloud-init-vault.test.ts` and `web/src/app/route-state.test.ts` passed ciphertext, account-scope, migration, damaged-storage preservation, and legacy route-parameter checks. | New saved links are encrypted; legacy preferences migrate after a successful encrypted write. Earlier bookmarks/history and preferences awaiting migration can still contain old plaintext. |

Machine-kind action routing also passed `web/src/lib/power-api.test.ts`, including same-name VM and
bare-metal release endpoints. Its broader presentation/naming question stays open. Request-body buffering
remains closed: bounded reads and the passing Worker suite cover oversized bodies and rate-limit rejection.

## Verification performed

- `bun run check` and `bun run typecheck` passed.
- `bun run test` passed: 45 files, 203 tests, including the cases above.
- `bun run test:worker` passed before each of the seven implementation/documentation commits: five files, 28 tests per run.
- A normal frontend build with an invalid PR URL failed as intended; the valid verified PR URL built successfully.
- `VITE_BUILD_PR_URL=https://github.com/hotaisle/hotaisle-console/pull/1 bun run build` passed.
- `bun run --cwd worker cf deploy --prebuilt --dry-run --profile hotaisle` passed before the real deployment.
- The packaging guard passed for the 28-asset bundle. Audit documents and local preview assets are excluded.

The regression tests use dummy fixtures. No live sign-in, email delivery, purchase, machine operation,
rate-limit exhaustion, or diagnostic error generation was performed. These ordinary engineering checks
do not establish the audit skill's full sandbox contract, upstream authorization behavior, global rate
accuracy, or production Issues retention/access. Those limits do not turn completed regression checks
back into open implementation tasks; the three remaining external questions are listed separately in
[NEEDS-VALIDATION.md](NEEDS-VALIDATION.md).

## Default-branch dependency alerts

The push reported eleven open Dependabot alerts. Read-only `gh api` inspection showed that they target
the default branch's `web/package-lock.json` and `package-lock.json`, neither of which is tracked in this
branch. The reported vulnerable ranges cover Vite through 6.4.3, esbuild through 0.24.2, and affected
`@vitest/mocker` versions below 4.1.12. This branch's `bun.lock` resolves Vite 8.3.7, esbuild 0.28.2,
and `@vitest/mocker` 5.1.0, outside those reported ranges. The default-branch alerts were not dismissed.
This comparison covers the eleven displayed alerts only; it is not a complete current dependency or
historical-secret scan.
