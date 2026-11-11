# Render and navigation feedback review

Reviewed 2026-11-11 following [StayLameBro's history-freeze report and proposed patch](https://github.com/hotaisle/hotaisle-console/pull/1#issuecomment-6805444385).
The history fix builds on that contribution. This is a focused application-performance review, not a
new security audit. It covers the current source tree; no production behavior is certified.

## Scope and result

Reviewed all 40 `useEffect`/`useLayoutEffect` calls in 27 source files, all six direct
`useSyncExternalStore` subscriptions, and the automatic routing paths they call. The check looked for
freshly created dependencies causing an effect to navigate, publish a new store snapshot, or update
state, which then recreates those same dependencies before the original change settles.

Two repeat-navigation cases were reproduced with isolated component tests:

| Flow | Cause | Change |
| --- | --- | --- |
| History pagination | A new derived history array restarted the measurement effect while its URL correction was pending. | Memoize derived lists per vault snapshot/team, depend on a primitive loaded flag, and request each measured capacity once until it settles. |
| Launch-size fallback | Newly derived offers could repeatedly request the same fallback GPU count while navigation was pending. | Derive a primitive fallback count and suppress duplicate pending requests; allow a later invalid choice or inventory change to trigger a new fallback. |

The regression harnesses stop after 20 navigation calls instead of allowing a test-runner freeze.
Both tests failed against the original behavior and passed with the fixes. Follow-up checks cover a
later resize in each direction, retaining the visible history position, and another invalid GPU choice
after the first fallback settles.

An adjacent routing check also found that spreading router search state preserved the retired
`cloudInit` query parameter. That cleanup now uses validated search fields and requests replacement
once per location. A test using the browser history adapter verifies that the parameter actually
disappears and only one cleanup navigation is issued. It uses a dummy URL, not a real cloud-init link.
Another case combines cleanup with an unavailable selected size. Both corrections use the router's
latest search state rather than captured render snapshots, so one cannot restore the obsolete URL or
overwrite the other's GPU selection. History page-size updates also merge against current router state.

## Other paths checked

- Legacy machine and ended-run links: canonicalization depends on primitive identities; route-driven
  re-render tests assert one navigation for each unambiguous upgrade.
- Authentication redirects and email completion: primitive destinations/completion flags and a pending
  mutation guard prevent the reviewed feedback pattern.
- History/cloud-init stores: snapshots are retained until a publication rather than allocated on every
  snapshot read. The system-theme snapshot is a primitive Boolean.
- Machine pruning and readiness polling: pruning publishes only when records change; polling speed
  uses a Boolean state update. TanStack Query structurally shares the combined state results.
- Stage geometry and layout measurement: size updates preserve the prior state when dimensions are
  unchanged; tag/layout keys use primitive serialized values. History capacity retains row-size
  measurements and produces a bounded primitive count.
- Preferences, copy timers, hold controls, dialogs, keyboard help, scroll indicators, and notifications:
  reviewed effect dependencies and cleanup do not create the same self-restarting navigation/store loop.

No further matching feedback loop was found in those reviewed paths. This is a source review and
fixture result, not a claim that every timing condition or browser performance issue has been ruled out.
No real credentials, purchases, email delivery, or machine operations are used by these checks.

## Verification

Ultracite, TypeScript, all 257 tests across 51 files, the production build, and the deployment dry-run
passed. The full suite includes the isolated Worker tests for the separately pending email-login
signing work. These are local engineering checks; no application process was started or restarted,
and no production deployment or GitHub comment was made as part of this review.
