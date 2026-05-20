# Ellement IDE Foundation Deep-Dive Plan

Status: Draft foundation plan  
Scope: Current `tezeye-jforteza/ellement_ide` fork of `microsoft/vscode`  
Created: 2026-05-20

## 1. Purpose

This guide documents the current state of the Ellement IDE fork and lays out a practical, implementation-ready plan for introducing the **Ellement** brand and future product features while keeping the fork maintainable against upstream VS Code.

The immediate goal is not to deeply fork VS Code internals. The goal is to create a stable product foundation that:

- establishes Ellement identity across product metadata, launchers, storage paths, icons, and platform bundles;
- avoids unnecessary drift from upstream VS Code;
- creates clear boundaries for future Ellement-specific features;
- documents validation steps before and after each implementation phase;
- preserves the ability to regularly merge or rebase from `microsoft/vscode`.

## 2. Current Fork Snapshot

### 2.1 Remotes

The repository is configured as an Ellement fork scaffold:

```text
origin:   https://github.com/tezeye-jforteza/ellement_ide.git
upstream: https://github.com/microsoft/vscode.git
```

### 2.2 Branch State

At review time:

```text
## main...origin/main
?? graphify-out/
```

The local `main` branch matches `origin/main` and is one commit ahead of `upstream/main`:

```text
0       1
```

The fork-only commit is:

```text
09ddbec44c9 Add Ellement fork maintenance guide
```

### 2.3 Current Tracked Fork Customization

The only intentional tracked Ellement-specific file identified is:

- `FORK_MAINTENANCE.md`

This is a good foundation because the fork remains close to upstream, which keeps future VS Code updates easier to merge.

### 2.4 Current Untracked Generated/Local Content

The following untracked folder was observed:

- `graphify-out/`

Recommendation: decide whether `graphify-out/` is a local/generated analysis cache. If yes, add it to `.gitignore` before product work begins.

## 3. Existing Fork Maintenance Policy

`FORK_MAINTENANCE.md` establishes the initial maintenance model:

- Keep `main` close to upstream VS Code.
- Pull upstream updates into `main`.
- Create Ellement work on feature branches named like `ellement/<feature-name>`.
- Rebase or merge active Ellement branches onto the updated `main` after upstream updates.
- Use Open VSX as the future extension gallery path.
- Do not wire this fork to the Microsoft Visual Studio Marketplace without separate product/legal review.

This plan follows that policy.

## 4. Key Architecture and Project Boundaries

VS Code is organized around a layered architecture:

- `src/vs/base/` — foundation utilities and abstractions.
- `src/vs/platform/` — platform services and dependency injection.
- `src/vs/editor/` — text editor implementation.
- `src/vs/workbench/` — main workbench UI, services, and feature contributions.
- `src/vs/code/` — Electron main process specific implementation.
- `src/vs/server/` — server-specific implementation.
- `src/vs/sessions/` — agent sessions window/workbench layer.
- `extensions/` — built-in extensions shipped with the product.
- `build/` — build and packaging scripts.
- `resources/` — static platform assets.

For Ellement features, prefer the least invasive integration point:

1. **Built-in extension** under `extensions/ellement-*` when the feature can be implemented with the extension API.
2. **Workbench contribution** under `src/vs/workbench/contrib/` when first-class UI or internal services are required.
3. **Platform service** under `src/vs/platform/` only when the feature needs cross-workbench infrastructure or dependency injection services.
4. **Base/editor changes** only when a feature truly requires lower-level capabilities.

This ordering minimizes upstream conflicts and keeps Ellement product logic isolated.

## 5. Product Identity Surfaces

### 5.1 Primary Product Configuration

The central product identity file is:

- `product.json`

Current values still identify the product as Code OSS:

```json
{
	"nameShort": "Code - OSS",
	"nameLong": "Code - OSS",
	"applicationName": "code-oss",
	"dataFolderName": ".vscode-oss",
	"sharedDataFolderName": ".vscode-oss-shared",
	"serverApplicationName": "code-server-oss",
	"serverDataFolderName": ".vscode-server-oss",
	"tunnelApplicationName": "code-tunnel-oss",
	"win32DirName": "Microsoft Code OSS",
	"win32NameVersion": "Microsoft Code OSS",
	"win32RegValueName": "CodeOSS",
	"win32AppUserModelId": "Microsoft.CodeOSS",
	"darwinBundleIdentifier": "com.visualstudio.code.oss",
	"linuxIconName": "code-oss",
	"urlProtocol": "code-oss",
	"reportIssueUrl": "https://github.com/microsoft/vscode/issues/new"
}
```

### 5.2 Candidate Ellement Product Values

These should be finalized before implementation:

```json
{
	"nameShort": "Ellement",
	"nameLong": "Ellement IDE",
	"applicationName": "ellement",
	"dataFolderName": ".ellement",
	"sharedDataFolderName": ".ellement-shared",
	"serverApplicationName": "ellement-server",
	"serverDataFolderName": ".ellement-server",
	"tunnelApplicationName": "ellement-tunnel",
	"win32DirName": "Ellement IDE",
	"win32NameVersion": "Ellement IDE",
	"win32RegValueName": "EllementIDE",
	"win32AppUserModelId": "Ellement.IDE",
	"darwinBundleIdentifier": "com.ellement.ide",
	"linuxIconName": "ellement",
	"urlProtocol": "ellement"
}
```

### 5.3 Identity Change Implications

Changing product identity affects:

- application display names;
- executable and CLI names;
- URL protocol registration;
- user data/profile isolation;
- remote server data paths;
- Windows AppUserModel IDs and registry names;
- macOS bundle identifiers;
- Linux desktop and icon names;
- launcher scripts and shell completions;
- smoke/sanity tests that expect Code OSS naming;
- user-facing issue/report links.

Because identity changes are broad, implement them as a dedicated first feature branch.

## 6. Static Resource and Asset Surfaces

Important Code OSS asset files currently include:

### 6.1 macOS

- `resources/darwin/code.icns`
- `resources/darwin/bin/code.sh`
- many file-type icons under `resources/darwin/*.icns`

### 6.2 Linux

- `resources/linux/code.png`
- `resources/linux/code.desktop`
- `resources/linux/code-url-handler.desktop`
- `resources/linux/bin/code.sh`

### 6.3 Server/Web

- `resources/server/code-192.png`
- `resources/server/code-512.png`
- `resources/server/favicon.ico`
- `resources/server/manifest.json`
- `resources/server/bin/code-server-darwin.sh`
- `resources/server/bin/code-server-linux.sh`
- `resources/server/bin/code-server.cmd`

### 6.4 Windows

- `resources/win32/code.ico`
- `resources/win32/code_150x150.png`
- `resources/win32/code_70x70.png`
- `resources/win32/bin/code.cmd`
- `resources/win32/bin/code.sh`
- many file-type icons under `resources/win32/*.ico`

### 6.5 Asset Strategy

Recommended first-pass asset scope:

1. Replace application icon assets only:
   - macOS app icon;
   - Linux app icon;
   - Windows app icon and tile PNGs;
   - web/server favicon and manifest icons.
2. Leave language/file-type icons unchanged initially.
3. Update Linux desktop metadata and server web manifest names after `product.json` identity changes.
4. Validate launchers after build generation rather than manually renaming every template prematurely.

## 7. Build and Packaging Surfaces

The following build files consume product identity and should be understood before editing product names:

- `build/gulpfile.vscode.ts`
  - consumes `product.nameShort`, `product.nameLong`, `product.applicationName`, `product.quality`, Windows identifiers, desktop names, CLI names, and generated resources.
- `build/gulpfile.reh.ts`
  - consumes server and remote extension host names.
- `build/gulpfile.vscode.web.ts`
  - consumes web package/product names.
- `build/darwin/create-dmg.ts`
  - has Code OSS DMG title/icon assumptions.
- `build/lib/builtInExtensions.ts`
  - consumes extension gallery configuration when downloading built-in extensions.
- `build/hygiene.ts`
  - currently flags `product.json` containing `extensionsGallery`.

Implementation note: when changing `product.json`, expect generated output and packaging tasks to reflect those values. Avoid changing generated `out/` files directly.

## 8. Extension Gallery Strategy

### 8.1 Current State

Current `product.json` has:

```text
extensionsGallery: undefined
updateUrl: undefined
quality: undefined
```

This means the fork is not yet configured for Microsoft Marketplace, Open VSX, or an Ellement update service.

### 8.2 Existing Fork Policy

`FORK_MAINTENANCE.md` says future Ellement IDE builds should use Open VSX and should not use the Microsoft Visual Studio Marketplace without separate approval.

### 8.3 Relevant Code Paths

- `src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts`
- `src/vs/platform/extensionManagement/common/extensionGalleryService.ts`
- `src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts`
- `src/vs/server/node/webClientServer.ts`
- `build/lib/builtInExtensions.ts`
- `build/lib/policies/policyGenerator.ts`

### 8.4 Hygiene Concern

`build/hygiene.ts` reports an error if `product.json` contains `extensionsGallery`.

This creates an implementation decision:

#### Option A — Direct `product.json` Gallery Configuration

Add Open VSX directly to `product.json` and adjust fork hygiene expectations.

Pros:

- simple and explicit;
- runtime product config is easy to inspect.

Cons:

- increases upstream diff;
- requires maintaining hygiene modifications;
- may conflict with upstream assumptions for OSS builds.

#### Option B — Fork Product Overlay / Mixin

Keep upstream-like `product.json` mostly clean and apply Ellement product overrides through a fork-specific product mixin or build overlay.

Pros:

- cleaner upstream merge story;
- can separate public OSS defaults from branded distribution config;
- reduces direct edits to upstream-controlled product file.

Cons:

- requires build process design;
- developers need to understand which product config is active.

Recommendation: start with direct product identity changes for local development, but evaluate a product overlay before adding service endpoints such as gallery/update URLs.

## 9. Copilot and Default Chat Agent Considerations

`product.json` currently includes a large `defaultChatAgent` section for GitHub Copilot and Copilot Chat.

This configuration is referenced by many areas, including:

- chat setup;
- default account setup;
- extension unification;
- inline completions;
- SCM commit-message generation;
- MCP registry data;
- welcome and onboarding flows;
- chat entitlement and quota UI.

Relevant areas include:

- `src/vs/workbench/contrib/chat/`
- `src/vs/workbench/services/accounts/`
- `src/vs/workbench/services/chat/`
- `src/vs/workbench/services/inlineCompletions/`
- `src/vs/platform/configuration/common/configurationRegistry.ts`
- `src/vs/platform/extensionManagement/common/extensionGalleryService.ts`

Before changing this section, make a product decision:

1. Keep GitHub Copilot as the default chat agent temporarily.
2. Remove the default chat agent configuration.
3. Replace it with an Ellement AI provider.
4. Defer AI provider decisions until after branding foundation is stable.

Recommendation: defer changes to `defaultChatAgent` during initial branding unless there is a clear Ellement AI provider strategy. Changing it too early can produce many secondary behavior changes.

## 10. Implementation Roadmap

### Phase 0 — Prepare the Branch and Baseline

Goal: start from a clean, reviewable branch.

Steps:

1. Confirm upstream state:

	```sh
	git status --short --branch
	git fetch upstream
	git rev-list --left-right --count upstream/main...HEAD
	```

2. Create a feature branch:

	```sh
	git checkout -b ellement/product-foundation
	```

3. Decide how to handle generated analysis output:

	```text
	graphify-out/
	```

4. If it is local/generated, add it to `.gitignore`.

Success criteria:

- working tree contains only intentional changes;
- branch name clearly represents the product foundation work;
- generated local artifacts are ignored or intentionally documented.

### Phase 1 — Product Identity Baseline

Goal: make the development build identify as Ellement without introducing feature changes.

Primary file:

- `product.json`

Candidate changes:

- `nameShort`: `Ellement`
- `nameLong`: `Ellement IDE`
- `applicationName`: `ellement`
- `dataFolderName`: `.ellement`
- `sharedDataFolderName`: `.ellement-shared`
- `serverApplicationName`: `ellement-server`
- `serverDataFolderName`: `.ellement-server`
- `tunnelApplicationName`: `ellement-tunnel`
- `win32DirName`: `Ellement IDE`
- `win32NameVersion`: `Ellement IDE`
- `win32RegValueName`: `EllementIDE`
- `win32AppUserModelId`: `Ellement.IDE`
- `darwinBundleIdentifier`: `com.ellement.ide`
- `linuxIconName`: `ellement`
- `urlProtocol`: `ellement`
- `reportIssueUrl`: Ellement GitHub issue URL or blank/deferred value.

Validation:

```sh
unset ELECTRON_RUN_AS_NODE
npm run watch
./scripts/code.sh
```

Success criteria:

- local app launches;
- title/about/dialog surfaces show Ellement names;
- command-line help uses the Ellement executable name where generated;
- user data is isolated from `.vscode-oss` when using default paths;
- no unintended Marketplace/update service configuration is introduced.

### Phase 2 — App Icons and Visible Assets

Goal: replace the most visible Code OSS assets with Ellement assets.

Primary files:

- `resources/darwin/code.icns`
- `resources/linux/code.png`
- `resources/win32/code.ico`
- `resources/win32/code_150x150.png`
- `resources/win32/code_70x70.png`
- `resources/server/code-192.png`
- `resources/server/code-512.png`
- `resources/server/favicon.ico`
- `resources/server/manifest.json`

Steps:

1. Collect canonical Ellement source artwork.
2. Generate platform-specific icon formats.
3. Replace application-level icons.
4. Update `resources/server/manifest.json` product names.
5. Rebuild/launch and inspect visible surfaces.

Success criteria:

- app icon shows Ellement in local development build;
- server/web favicon and manifest use Ellement names/assets;
- language/file-type icons remain unchanged unless intentionally rebranded later.

### Phase 3 — Linux Desktop and Protocol Metadata

Goal: ensure Linux desktop entries and URL handling match Ellement identity.

Primary files:

- `resources/linux/code.desktop`
- `resources/linux/code-url-handler.desktop`
- `product.json`

Steps:

1. Confirm how build tasks substitute `applicationName`, `nameLong`, `linuxIconName`, and `urlProtocol`.
2. Update templates only where product substitutions are insufficient.
3. Verify generated desktop file names and protocol handler names.

Success criteria:

- generated Linux desktop entries use `ellement` naming;
- URL protocol is `ellement://`;
- icon name resolves to Ellement icon assets.

### Phase 4 — macOS Bundle and DMG Details

Goal: ensure macOS app bundle metadata and DMG surfaces are Ellement branded.

Primary files:

- `product.json`
- `resources/darwin/code.icns`
- `resources/darwin/bin/code.sh`
- `build/darwin/create-dmg.ts`

Steps:

1. Confirm `darwinBundleIdentifier` and app bundle naming.
2. Validate generated app executable path names.
3. Update DMG title/icon assumptions if Code OSS strings remain.
4. Keep shell command install behavior consistent with `applicationName`.

Success criteria:

- macOS app bundle identifies as Ellement IDE;
- app icon is Ellement;
- DMG title does not say Code OSS;
- shell command naming is predictable.

### Phase 5 — Windows Identity and Installer Surfaces

Goal: update Windows-facing identifiers and icons.

Primary files:

- `product.json`
- `resources/win32/code.ico`
- `resources/win32/code_150x150.png`
- `resources/win32/code_70x70.png`
- `resources/win32/bin/code.cmd`
- `resources/win32/bin/code.sh`
- `build/gulpfile.vscode.ts`

Steps:

1. Confirm stable Windows application identifiers.
2. Generate or reserve unique app IDs/GUIDs if packaging requires them.
3. Update Windows tile/icon resources.
4. Validate generated command names and Visual Elements manifest.

Success criteria:

- Windows executable and registry naming do not conflict with Code OSS;
- AppUserModel ID is Ellement-specific;
- icons and tiles are Ellement-branded.

### Phase 6 — Open VSX Extension Gallery

Goal: configure extension discovery and installation for Open VSX without using Microsoft Marketplace.

Primary files/areas:

- `product.json` or fork-specific product overlay;
- `build/hygiene.ts` if direct config is used;
- `src/vs/platform/extensionManagement/common/extensionGalleryManifestService.ts`;
- `src/vs/platform/extensionManagement/common/extensionGalleryService.ts`;
- `build/lib/builtInExtensions.ts`.

Steps:

1. Decide direct product config vs overlay.
2. Add Open VSX gallery endpoints.
3. Validate extension search and install flows.
4. Confirm no Microsoft Marketplace endpoints are introduced.
5. Document any hygiene exceptions.

Success criteria:

- extension search uses Open VSX;
- extension detail/resource URLs resolve correctly;
- built-in extension download behavior is understood;
- `npm run hygiene` or equivalent fork hygiene passes or has documented fork-specific exceptions.

### Phase 7 — Issue, Legal, Privacy, Telemetry, and Update Endpoints

Goal: replace or remove upstream/Microsoft-facing product endpoints where appropriate.

Potential product keys:

- `reportIssueUrl`
- `licenseUrl`
- `serverLicenseUrl`
- telemetry/crash reporter config if present later;
- `updateUrl` only if Ellement has a real update service.

Steps:

1. Decide official Ellement issue tracker URL.
2. Decide product docs/legal/privacy URLs.
3. Avoid adding update URLs until a release/update service exists.
4. Validate issue reporter and Help menu links.

Success criteria:

- issue reporting no longer points to Microsoft VS Code unless intentionally retained for upstream bugs;
- legal/privacy links match Ellement distribution policy;
- update actions are either disabled, no-op, or wired to a real Ellement update service.

### Phase 8 — Ellement Feature Foundation

Goal: create a maintainable pattern for future Ellement features.

Recommended approach:

1. Create a built-in extension for feature experiments where possible:

	```text
	extensions/ellement-foundation/
	```

2. Use contribution points for commands, views, settings, walkthroughs, and webviews.
3. Promote functionality into `src/vs/workbench/contrib/ellement/` only when internal APIs or first-class workbench integration are required.
4. Keep Ellement-specific identifiers consistently namespaced:

	```text
	ellement.*
	```

Success criteria:

- first Ellement feature can be enabled/disabled independently;
- extension/workbench boundaries are documented;
- future upstream merges have minimal conflict surface.

## 11. Validation Commands

### 11.1 Runtime Setup

Use the Node version pinned by VS Code:

```sh
source ~/.nvm/nvm.sh
nvm install
nvm use
node --version
npm --version
```

Current `.nvmrc` requires Node `22.22.1`.

### 11.2 Install and Launch

```sh
unset ELECTRON_RUN_AS_NODE
npm install
npm run watch
./scripts/code.sh
```

The scaffold is healthy when the development app launches and the working tree is clean except for intentional Ellement changes.

### 11.3 TypeScript Validation

For changes under `src/`:

```sh
npm run compile-check-ts-native
```

For built-in extension changes under `extensions/`:

```sh
npm run gulp compile-extensions
```

For build script changes under `build/`:

```sh
cd build
npm run typecheck
```

For layer validation:

```sh
npm run valid-layers-check
```

### 11.4 Hygiene

Before committing substantial product/build changes:

```sh
npm run hygiene
```

Note: Open VSX/gallery configuration may require a fork-specific hygiene decision because upstream hygiene currently flags `extensionsGallery` in `product.json`.

## 12. Recommended First Pull Request / Commit Stack

Keep early changes small and easy to review.

### PR 1 — Documentation and Ignore Hygiene

- Add this guide.
- Ignore `graphify-out/` if confirmed generated/local.
- No product behavior changes.

### PR 2 — Product Identity Baseline

- Update core `product.json` identity keys.
- Validate local launch.
- Document exact values chosen.

### PR 3 — Application Assets

- Replace app-level icons and server/web manifest assets.
- Validate visible branding surfaces.

### PR 4 — Platform Packaging Polish

- Linux desktop metadata.
- macOS DMG/app polish.
- Windows identifiers/icons if packaging is in scope.

### PR 5 — Extension Gallery

- Add Open VSX strategy.
- Resolve hygiene/build implications.
- Validate extension search/install.

### PR 6+ — Ellement Feature Work

- Start with built-in extension or isolated workbench contribution.
- Avoid core editor/platform changes unless required.

## 13. Open Decisions

Before implementation begins, finalize:

- Exact product name: `Ellement`, `Ellement IDE`, or another display variant.
- Exact CLI command: `ellement`, `ell`, or another command.
- Exact URL protocol: `ellement://` or another protocol.
- Exact macOS bundle identifier.
- Exact Windows AppUserModel ID and app GUID strategy.
- Whether `graphify-out/` should be ignored.
- Whether GitHub Copilot remains the default chat agent.
- Whether Open VSX is configured directly in `product.json` or via product overlay.
- Official issue tracker URL.
- Official privacy, license, and support URLs.
- Whether Ellement will initially ship update functionality or leave update URLs unset.

## 14. Success Definition for the Foundation Milestone

The Ellement foundation milestone is complete when:

- the app launches locally as **Ellement IDE**;
- product metadata no longer identifies the distribution as Code OSS in primary visible surfaces;
- app icons and web/server assets use Ellement branding;
- user data and server data folders are Ellement-specific;
- URL protocol and CLI naming are Ellement-specific;
- extension gallery strategy is documented and preferably Open VSX-backed;
- Copilot/default AI behavior is intentionally retained, removed, or replaced;
- validation commands pass for touched areas;
- the fork can still merge/rebase from upstream with a clear, limited diff.
