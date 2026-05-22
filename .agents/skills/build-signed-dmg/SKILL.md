---
name: build-signed-dmg
description: Build, sign, notarize, staple, and validate a macOS arm64 Ellement IDE DMG from this VS Code fork. Use when creating a new signed installer, notarized DMG, macOS release artifact, or distribution build for Ellement IDE.
metadata:
  allowed-tools: Bash(npm run gulp:*), Bash(node:*), Bash(codesign:*), Bash(xcrun:*), Bash(hdiutil:*), Bash(spctl:*), Bash(shasum:*)
---

# Build Signed DMG

Use this skill to create a fresh macOS arm64 Ellement IDE installer DMG.

Prefer the bundled helper script:

```bash
source ~/.nvm/nvm.sh
nvm use
node .agents/skills/build-signed-dmg/scripts/build-signed-dmg.mjs
```

The script performs the proven local release flow:

1. Build `/Users/jordanforteza/Development/VSCode-darwin-arm64/Ellement IDE.app`.
2. Sign the app with an installed `Developer ID Application` identity.
3. Create `.build/darwin/dmg/VSCode-darwin-arm64.dmg`.
4. Patch the DMG icon metadata.
5. Sign the DMG.
6. Submit to Apple notarization using `.env`.
7. Staple the accepted ticket.
8. Validate the DMG and the app inside the mounted DMG.
9. Print the final path and SHA-256.

## Required Local State

- Run from the repo root: `/Users/jordanforteza/Development/ellement_ide`.
- Use the repo Node version from `.nvmrc`.
- The matching private key for a `Developer ID Application` certificate must be installed in the login keychain.
- `.env` must include:
  - `APPLE_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`
- Prefer setting `DEVELOPER_ID_APPLICATION` to the 40-character SHA-1 hash or full name of the Developer ID Application identity.

Do not rely on a generic `DEVELOPER_ID` value unless it resolves to a `Developer ID Application` identity. Apple Development and Apple Distribution identities are not valid for direct-distribution notarized DMGs.

## Common Options

```bash
# Reuse an existing packaged app and recreate/sign/notarize only the DMG.
node .agents/skills/build-signed-dmg/scripts/build-signed-dmg.mjs --skip-build

# Verify identity/path selection without touching build artifacts.
node .agents/skills/build-signed-dmg/scripts/build-signed-dmg.mjs --dry-run

# Build and sign locally without Apple notarization.
node .agents/skills/build-signed-dmg/scripts/build-signed-dmg.mjs --skip-notarize

# Skip mounting the final DMG for app-inside-DMG validation.
node .agents/skills/build-signed-dmg/scripts/build-signed-dmg.mjs --skip-mount-validate
```

## Notes For Codex

- This workflow needs escalated shell permissions because it writes outside the repo, accesses the keychain, talks to Apple notarization services, mounts disk images, and uses macOS signing tools.
- If `.env` has an app-specific password containing spaces, do not `source .env`; the script parses `.env` directly.
- If notarization returns anything other than `Accepted`, do not staple. Report the notary submission id and fetch the Apple log before retrying.
- If `spctl --type open` returns `source=Insufficient Context`, use `--context context:primary-signature`; this is the expected DMG assessment form.
