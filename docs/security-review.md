# Privacy and dependency review

Review date: 2026-11-02. Public source defaults to no server. Credentials are only entered in the installed app and saved using SecureStore. No telemetry SDK or analytics code was added. Expo developer tooling may contact Expo/npm during development; EXPO_NO_TELEMETRY=1 is used in local build scripts. Learning requests, downloads and native media go to the selected service. Cross-origin media is rejected. Rendered inline math/diagrams have no network or credential bridge.

Source extraction used an explicit file allowlist. No private Git history, account files, textbook, photo, mistake record, model key, OAuth material or private signing material was copied. `source-check.mjs` checks the deliverable text tree, including docs and examples. Artifacts, generated platform projects, env files and node_modules are excluded. It cannot detect every possible secret, so the staged file manifest must also be reviewed before publishing.

Publication checks now include `source-check.mjs --history`: all reachable commits, file content, and author/committer contact addresses are reviewed in a full clone. Project commits use a nonpersonal identity; dependency-license attribution remains intact. Optional private deny terms are supplied only through `SOURCE_PRIVATE_TERMS_JSON`, never hardcoded into public rules. A passing check is evidence for its inspected scope, not a guarantee about unknown secrets or hosting-provider caches.

## Update boundary

Updates use this client's GitHub Releases without learning credentials. The repository contains only the public verification certificate; the private signing key stays outside source and releases. The loopback adapter forwards signed manifest bytes, while Expo verifies the signature, resource hashes and runtime. Embedded-update and startup fallback protections remain enabled. Android verification used a local distribution fixture; public GitHub OTA and iOS OTA runtime are not yet accepted. See [updates.md](updates.md).

## Dependency audit result

The earlier 0.1.0 doctor result does not validate this dependency set. `npm audit` completed against the npm registry: **33 affected dependency entries — 5 high, 24 moderate, 4 low, 0 critical**. These counts include parent packages reported because of vulnerable transitive dependencies, not 33 separate vulnerabilities.

Direct advisory roots:

| Package | Concern | Review result |
| --- | --- | --- |
| Mermaid 11 / nested KaTeX | Existing prototype pollution may bypass nested KaTeX trust restrictions | Mermaid is an isolated, no-network inline renderer. Its bundled nested runtime remains affected; do not claim an npm override would patch a prebuilt bundle. A separately tested major upgrade is deferred. |
| decode-uri-component 0.2.2 (query-string / expo-router) | Malformed URL decoding DoS, [GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | Runtime-relevant router dependency. 0.5.1 is ESM while the current caller is CommonJS; do not force override without bundler/routing tests. |
| zod 3.25.76 | Oversized constrained collection memory exhaustion, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Used by development/build dependencies; the audit proposes a different major API. |
| glob 13.0.6 / minimatch 3.x and 10.x | Cancellation / amplification DoS | Primarily CLI and lint traversal; fixes cross current dependency majors. |
| deepmerge 4.3.1 | Prototype poisoning of merged objects | Expo configuration tooling; avoid untrusted build config. |

`npm audit fix --force` proposes Expo 51 or Router 58 for parts of this SDK 57 tree; that would invalidate the current platform integration. It was not applied. The source remains reviewable, but **this audit is not clean and signed/public binary release is not approved by these checks**. Address the router dependency and remaining applicable advisories through a supported Expo maintenance release or a separately tested migration, then repeat dependency and platform checks. Do not present this source preview as a security-certified client.

No arbitrary certificate bypass exists. Public HTTP is rejected. No-auth services are limited to private address forms; this check does not create a firewall, VPN or DNS trust boundary. The administrator must actually protect the service network. Same-origin path validation, no-redirect HTTP and native Cookie policy protect credential routing; they cannot make an untrusted server safe.
