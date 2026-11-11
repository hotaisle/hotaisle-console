# Historical audit records

This directory is public documentation under the [publication policy](../SECURITY-PUBLICATION.md).
The source audit describes baseline commit `4e72d26` on 2026-11-10. It did not establish any confirmed
vulnerability. Later implementation and operational follow-ups closed its validation questions at
their stated evidence level; they do not certify every upstream or production behavior.

`findings.json`, `coverage-ledger.json`, and `run-metadata.json` retain that historical source baseline.
Their `needs_validation`, blocked/candidate statuses, line numbers, and proposed fixture checks must
not be read as statements about the current code or as proof of an exploitable vulnerability.
The [current queue](NEEDS-VALIDATION.md) and follow-up records govern closure status.

| Historical lead | Follow-up evidence |
| --- | --- |
| Custom cloud-init URL persistence | Encrypted browser storage and route/migration regressions in [validation](VALIDATION-2026-11-11.md). |
| Issues metadata/privacy boundary | Accepted diagnostic scope and settings/access review in [resolution](RESOLUTION-2026-11-11.md). |
| Machine identity and action routing | Composite team/collection/deployment identity and regressions in [resolution](RESOLUTION-2026-11-11.md). |
| Copied SSH metadata | Input validation and copy-format regressions in [validation](VALIDATION-2026-11-11.md). |
| Delayed team callbacks | Account-switch regression in [validation](VALIDATION-2026-11-11.md). |
| Email issuance abuse controls | Worker limiter regressions in [report](REPORT.md) and upstream source-policy review in [resolution](RESOLUTION-2026-11-11.md). |
| Email request buffering | Bounded request reads and Worker regressions in [report](REPORT.md). |
| Internal upstream redirects | Manual redirects and isolated fixture regression in [validation](VALIDATION-2026-11-11.md). |
| Proxy request buffering | Bounded request reads and Worker regressions in [report](REPORT.md). |

Private operational details were removed from the public prose during the 2026-11-11 disclosure review.
Historical Git revisions may still contain earlier wording. That cleanup is not a secret revocation,
history rewrite, or retroactive reclassification of the original audit evidence.
