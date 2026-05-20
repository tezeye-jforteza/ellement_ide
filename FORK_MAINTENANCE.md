# Ellement IDE Fork Maintenance

This repository is the Ellement IDE fork scaffold for `microsoft/vscode`.
The first milestone keeps the fork close to upstream Code - OSS so VS Code
updates can be merged before Ellement-specific product changes are added.

## Remotes

- `origin`: `https://github.com/tezeye-jforteza/ellement_ide.git`
- `upstream`: `https://github.com/microsoft/vscode.git`

Run `git remote -v` before update work if the clone has moved between machines.

## Runtime

Use the Node version pinned by VS Code:

```sh
source ~/.nvm/nvm.sh
nvm install
nvm use
node --version
npm --version
```

The current `.nvmrc` requires Node `22.22.1`.

## Pulling VS Code Updates

Keep `main` as the clean upstream-tracking branch:

```sh
git checkout main
git fetch upstream
git pull upstream main
git push origin main
```

Do Ellement-specific work on feature branches:

```sh
git checkout main
git pull upstream main
git checkout -b ellement/<feature-name>
```

When VS Code updates land, rebase or merge each active Ellement branch onto the
updated `main` and resolve conflicts inside that feature branch.

## Extension Gallery Policy

Future Ellement IDE builds should use Open VSX as the extension gallery path.
Do not wire this fork to the Microsoft Visual Studio Marketplace unless a
separate product and legal review explicitly approves that distribution model.

## Local Verification

After installing dependencies:

```sh
unset ELECTRON_RUN_AS_NODE
npm install
npm run watch
./scripts/code.sh
```

The scaffold is healthy when the Code - OSS development app launches from this
repository and `git status --short --branch` is clean except for intentional
Ellement changes.

If `./scripts/code.sh` fails with an Electron named export error, confirm
`ELECTRON_RUN_AS_NODE` is unset before launching the GUI app.
