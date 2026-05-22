# Ellement IDE macOS Distribution Deep-Dive Plan

Status: Implemented and validated locally  
Scope: macOS arm64 DMG distribution for the current `ellement_ide` fork  
Created: 2026-05-21

## 1. Purpose

This guide documents the successful path for building, signing, packaging, notarizing, and stapling the Ellement IDE macOS DMG.

It captures the implementation steps, repo-specific build details, and operational insights discovered while producing the first signed and notarized `arm64` installer.

The primary goal is repeatability:

- build the packaged `.app`;
- sign the app with a Developer ID Application identity;
- create a DMG installer;
- sign the DMG;
- submit the DMG to Apple notarization;
- staple and validate the notarization ticket.

## 2. Final Artifact Paths

The successful local build produced:

```text
/Users/jordanforteza/Development/VSCode-darwin-arm64/Ellement IDE.app
/Users/jordanforteza/Development/ellement_ide/.build/darwin/dmg/VSCode-darwin-arm64.dmg
```

The packaged app is created outside the repo root, in the parent development directory. The DMG is created inside the repo under `.build/darwin/dmg`.

## 3. Required Accounts and Credentials

### 3.1 Apple Developer Certificate

For a direct-download DMG distributed outside the Mac App Store, the required signing identity is:

```text
Developer ID Application: Tezeye LLC (D3W8H299QN)
```

Other Apple identities are not sufficient for this distribution path:

- `Apple Development` is for local development.
- `Apple Distribution` is for App Store style distribution.
- `Developer ID Application` is for Developer ID signed and notarized apps distributed outside the App Store.

### 3.2 Certificate File Type

A downloaded `.cer` file is only the public certificate. It becomes usable only if the matching private key is already present in Keychain.

The identity is usable when this command shows a valid `Developer ID Application` row:

```sh
security find-identity -v -p codesigning
```

Expected example:

```text
9CB810A23F14808917D6110B0CB55879AB92BA86 "Developer ID Application: Tezeye LLC (D3W8H299QN)"
```

### 3.3 Notarization Credentials

The `.env` file should contain:

```sh
APPLE_ID=your-apple-id-email
APPLE_TEAM_ID=D3W8H299QN
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
DEVELOPER_ID=Developer ID Application: Tezeye LLC (D3W8H299QN)
```

`APPLE_APP_SPECIFIC_PASSWORD` is generated from the Apple ID account page. It is not the normal Apple ID password.

Never commit `.env` or paste these secrets into logs, tickets, or chat.

## 4. Build Environment

Use the repo-required Node version:

```sh
cd /Users/jordanforteza/Development/ellement_ide
source ~/.nvm/nvm.sh
nvm use
```

The current repo expects Node from `.nvmrc`:

```text
22.22.1
```

Set the macOS target:

```sh
export VSCODE_ARCH=arm64
export VSCODE_QUALITY=stable
```

For Intel Mac builds, use `x64` instead of `arm64`.

## 5. Build the Packaged App

Run:

```sh
npm run gulp vscode-darwin-arm64-min
```

Expected app path:

```text
/Users/jordanforteza/Development/VSCode-darwin-arm64/Ellement IDE.app
```

Quick check:

```sh
ls -la "../VSCode-darwin-arm64"
```

Important insight: exporting `VSCODE_ARCH` does not create the `.app`. The `.app` appears only after the gulp packaging task completes.

## 6. Import and Verify the Developer ID Certificate

The Developer ID Application certificate used for the first successful run was:

```text
/Users/jordanforteza/Downloads/developerID_application.cer
```

The certificate subject was:

```text
Developer ID Application: Tezeye LLC (D3W8H299QN)
```

Import:

```sh
security add-certificates -k login.keychain-db /Users/jordanforteza/Downloads/developerID_application.cer
```

Verify:

```sh
security find-identity -v -p codesigning
```

If the Developer ID Application identity does not appear after importing the `.cer`, the matching private key is missing. In that case, recreate the certificate from a CSR generated on this Mac, or import a `.p12` exported from the Mac that generated the CSR.

## 7. Sign the Packaged App

The repo script `build/darwin/sign.ts` is CI-oriented and expects a temp keychain via `AGENT_TEMPDIRECTORY`. For local signing, the successful path used the same signing logic with the login keychain identity.

The signing identity hash was:

```text
9CB810A23F14808917D6110B0CB55879AB92BA86
```

After signing, verify:

```sh
codesign --verify --deep --strict --verbose=2 "../VSCode-darwin-arm64/Ellement IDE.app"
spctl --assess --type execute --verbose "../VSCode-darwin-arm64/Ellement IDE.app"
```

Before notarization, `spctl` can reject the app with:

```text
source=Unnotarized Developer ID
```

That is expected before Apple accepts and staples the notarization ticket.

## 8. Create the DMG

Create the DMG output folder:

```sh
mkdir -p .build/darwin/dmg
```

Run the repo DMG creator through the correct Node version:

```sh
source ~/.nvm/nvm.sh
nvm use
VSCODE_ARCH=arm64 VSCODE_QUALITY=stable node build/darwin/create-dmg.ts \
  /Users/jordanforteza/Development \
  /Users/jordanforteza/Development/ellement_ide/.build/darwin/dmg
```

Expected output:

```text
.build/darwin/dmg/VSCode-darwin-arm64.dmg
```

### 8.1 DMG Size Fix

The packaged app was about:

```text
1.3G
```

The original DMG template had:

```python
size = '1g'
```

That failed with:

```text
No space left on device
```

The template was updated to:

```python
size = '2g'
```

File changed:

```text
build/darwin/dmg-settings.py.template
```

### 8.2 DMG Icon Patch

The upstream pipeline references `resources/darwin/disk.icns`, but this fork does not currently include that file.

Use the existing app icon:

```sh
python3 build/darwin/patch-dmg.py \
  .build/darwin/dmg/VSCode-darwin-arm64.dmg \
  resources/darwin/code.icns
```

## 9. Sign the DMG

Sign the created DMG:

```sh
codesign --force --timestamp \
  --sign 9CB810A23F14808917D6110B0CB55879AB92BA86 \
  .build/darwin/dmg/VSCode-darwin-arm64.dmg
```

Verify:

```sh
codesign --verify --verbose=2 .build/darwin/dmg/VSCode-darwin-arm64.dmg
```

Expected:

```text
valid on disk
satisfies its Designated Requirement
```

## 10. Load `.env` Before Notarization

The `.env` file is not automatically loaded into a terminal session.

Before running `notarytool`, load it:

```sh
set -a
source .env
set +a
```

Verify the Team ID is present:

```sh
echo "$APPLE_TEAM_ID"
```

Expected:

```text
D3W8H299QN
```

If `.env` is not loaded, `notarytool` fails with:

```text
Error: Team ID must be at least 3 characters
```

Do not run `stapler` until `notarytool` returns `status: Accepted`.

## 11. Notarize the DMG

Submit:

```sh
xcrun notarytool submit .build/darwin/dmg/VSCode-darwin-arm64.dmg \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait
```

Successful result:

```text
status: Accepted
```

If notarization fails, review the Apple log before stapling. Stapling without a successful notarization ticket can fail with:

```text
Record not found
Could not find base64 encoded ticket
The staple and validate action failed! Error 65.
```

## 12. Staple and Validate

After `status: Accepted`, staple:

```sh
xcrun stapler staple .build/darwin/dmg/VSCode-darwin-arm64.dmg
```

Validate:

```sh
xcrun stapler validate .build/darwin/dmg/VSCode-darwin-arm64.dmg
spctl --assess --type open --verbose .build/darwin/dmg/VSCode-darwin-arm64.dmg
```

At this point, the DMG is ready for distribution.

## 13. Repeatable End-to-End Command Sequence

This assumes the Developer ID Application identity is installed and `.env` is populated.

```sh
cd /Users/jordanforteza/Development/ellement_ide
source ~/.nvm/nvm.sh
nvm use

export VSCODE_ARCH=arm64
export VSCODE_QUALITY=stable

npm run gulp vscode-darwin-arm64-min

# Sign the app using the installed Developer ID Application identity.
# Use the local signing helper/process documented in section 7.

mkdir -p .build/darwin/dmg
VSCODE_ARCH=arm64 VSCODE_QUALITY=stable node build/darwin/create-dmg.ts \
  /Users/jordanforteza/Development \
  /Users/jordanforteza/Development/ellement_ide/.build/darwin/dmg

python3 build/darwin/patch-dmg.py \
  .build/darwin/dmg/VSCode-darwin-arm64.dmg \
  resources/darwin/code.icns

codesign --force --timestamp \
  --sign 9CB810A23F14808917D6110B0CB55879AB92BA86 \
  .build/darwin/dmg/VSCode-darwin-arm64.dmg

set -a
source .env
set +a

xcrun notarytool submit .build/darwin/dmg/VSCode-darwin-arm64.dmg \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_SPECIFIC_PASSWORD" \
  --wait

xcrun stapler staple .build/darwin/dmg/VSCode-darwin-arm64.dmg
xcrun stapler validate .build/darwin/dmg/VSCode-darwin-arm64.dmg
spctl --assess --type open --verbose .build/darwin/dmg/VSCode-darwin-arm64.dmg
```

## 14. Implementation Insights

- The sandboxed shell may not see the same Keychain identities as a normal terminal. Use an unsandboxed shell when checking macOS signing identities.
- A `.cer` certificate is not enough unless the matching private key is already in Keychain.
- The correct certificate for direct DMG distribution is `Developer ID Application`, not `Apple Development` or `Apple Distribution`.
- The packaged `.app` lives in the parent development directory, not inside the repo root.
- The DMG builder uses `dmgbuild` and may install it on first run.
- `build/darwin/create-dmg.ts` must be run with the repo's Node version from `.nvmrc`.
- The fork currently has `resources/darwin/code.icns`, but not `resources/darwin/disk.icns`.
- `.env` must be explicitly loaded before notarization commands.
- Stapling should only run after `notarytool` returns `status: Accepted`.

## 15. Future Improvements

- Add a repo-local signing helper script that reads non-secret configuration from `.env` and avoids duplicating the local signing command.
- Add `resources/darwin/disk.icns` if a distinct mounted-volume icon is desired.
- Rename the generated artifact from `VSCode-darwin-arm64.dmg` to an Ellement-branded filename during release packaging.
- Add a release checklist that includes final smoke testing from the mounted DMG.
- Consider parameterizing DMG size based on app size instead of keeping a fixed `2g` template value.
