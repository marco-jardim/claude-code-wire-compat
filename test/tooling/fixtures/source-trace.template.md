# Synthetic source trace

Prose that lives before the sealed section and has to survive resealing byte for byte.

## Golden fixture

| Behavior  | Upstream file                     | Rule            |
| --------- | --------------------------------- | --------------- |
| Synthetic | `test/fixtures/golden/alpha.json` | Structure only. |

### Fixture integrity

| Fixture                                 | Model                 | SHA-256                     |
| --------------------------------------- | --------------------- | --------------------------- |
| `test/fixtures/golden/decision.json`    | n/a (decision record) | `{{hash:decision.json}}`    |
| `test/fixtures/golden/alpha.json`       | `model-alpha`         | `{{hash:alpha.json}}`       |
| `test/fixtures/golden/beta.canary.json` | `model-beta`          | `{{hash:beta.canary.json}}` |

`test/fixtures/golden/manifest.json` is the machine-readable copy of these hashes and is the
**source of truth**.

Second paragraph of section prose, also preserved byte for byte.

## Billing fingerprint

Trailing prose after the sealed section.
