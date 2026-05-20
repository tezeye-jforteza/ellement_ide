# Ellement Telemetry Audit

Status: Initial audit notes  
Scope: Current Ellement IDE fork and future workspace/project scanning  
Created: 2026-05-20

## Purpose

Ellement should be able to inspect codebases for telemetry, analytics, crash reporting, experimentation, and stable identifier usage. This matters in two places:

- the Ellement IDE fork itself, so product builds do not accidentally send upstream telemetry;
- user projects opened in Ellement, so security reviews can find telemetry-bearing dependencies, endpoints, and code paths.

## Current Fork Findings

Core VS Code telemetry is centralized around:

- `src/vs/platform/telemetry/common/telemetry.ts`
- `src/vs/platform/telemetry/common/telemetryUtils.ts`
- `src/vs/platform/telemetry/common/telemetryService.ts`
- `src/vs/workbench/services/telemetry/browser/telemetryService.ts`
- `src/vs/workbench/services/telemetry/electron-browser/telemetryService.ts`
- `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts`
- `src/vs/code/electron-main/app.ts`

The important choke point is `supportsTelemetry(productService, environmentService)`.

For built product builds, telemetry support requires `product.enableTelemetry` to be truthy. The current Ellement `product.json` does not define `enableTelemetry`, `aiConfig`, or `tasConfig`, which means built Ellement builds should not initialize external core telemetry upload by default.

Development builds are different: `supportsTelemetry` intentionally returns true when the build is not built and `--disable-telemetry` was not passed. Without `product.aiConfig.ariaKey`, this is local logging/debug telemetry rather than 1DS upload, but secure test runs should still pass `--disable-telemetry --disable-experiments`.

External upload paths found in the platform layer are:

- `src/vs/platform/telemetry/common/1dsAppender.ts`
- `src/vs/platform/telemetry/node/1dsAppender.ts`
- `src/vs/platform/telemetry/browser/1dsAppender.ts`

Those appenders send to Microsoft 1DS only when an instrumentation key is configured.

Experiment assignment is gated by `product.tasConfig`, `workbench.enableExperiments`, telemetry level, and `--disable-experiments`. The current Ellement product config has no `tasConfig`.

Crash reporting is tied to telemetry level through `telemetry.telemetryLevel` and the deprecated `telemetry.enableCrashReporter` setting. Native startup can write `enable-crash-reporter` and `crash-reporter-id` into argv storage.

Built-in extensions can have their own telemetry implementations. The highest-value extension areas to review separately are:

- `extensions/copilot/src/platform/telemetry/`
- `extensions/github-authentication/src/common/telemetryReporter.ts`
- `extensions/microsoft-authentication/src/common/telemetryReporter.ts`
- `extensions/typescript-language-features/src/experimentTelemetryReporter.ts`
- `extensions/markdown-language-features/src/telemetryReporter.ts`
- `extensions/git/src/cloneManager.ts`

## Repeatable Scanner

Use the audit script to scan this fork or another project:

```sh
node scripts/ellement-telemetry-audit.mjs . > telemetry-audit.md
node scripts/ellement-telemetry-audit.mjs . --summary
node scripts/ellement-telemetry-audit.mjs /path/to/project --json > telemetry-audit.json
node scripts/ellement-telemetry-audit.mjs /path/to/project --fail-on high
```

By default it skips generated and dependency-heavy folders such as `.git`, `node_modules`, `out`, `.build`, `dist`, `graphify-out`, dependency lockfiles, and test fixtures. Use `--include-tests` when reviewing tests and fixtures too. Use `--include-lockfiles` when you want dependency manifests included in the signal.

The scanner is intentionally conservative. It flags likely telemetry surfaces, not proven data exfiltration. High findings are collector endpoints; medium findings are APIs, telemetry config, experiments, crash reporting, or stable identifiers; low findings are privacy/GDPR markers.

## Hardening Recommendations

For the fork:

1. Add explicit product-level telemetry posture after product identity settles:

	```json
	"enableTelemetry": false,
	"showTelemetryOptOut": false
	```

2. Keep `aiConfig`, `tasConfig`, `appCenter`, and update endpoints absent until Ellement has owned services and a privacy review.
3. Consider changing default settings so `telemetry.telemetryLevel` and `workbench.enableExperiments` default to off in Ellement builds.
4. Launch validation and security smoke tests with:

	```sh
	./scripts/code.sh --disable-telemetry --disable-experiments
	```

5. Audit built-in extensions separately, especially Copilot and authentication extensions, because extension telemetry can be independent of core telemetry.
6. Before configuring Open VSX or an Ellement service endpoint, re-run the scanner and review every new high-severity endpoint.

For user project scanning inside the future Ellement product:

1. Start as a built-in extension command that scans the current workspace with the same pattern categories used by `scripts/ellement-telemetry-audit.mjs`.
2. Report findings in a read-only webview or virtual document.
3. Never upload audit results by default.
4. Provide an export command for Markdown/JSON results.
5. Add an allowlist file, for example `.ellement/telemetry-audit.allow.json`, so teams can document accepted telemetry endpoints.
