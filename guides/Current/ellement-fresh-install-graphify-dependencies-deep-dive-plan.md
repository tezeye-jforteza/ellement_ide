# Ellement IDE Fresh Install + Graphify Dependencies Deep-Dive Plan

Status: Implemented and validated locally  
Scope: Fresh macOS install readiness for Ellement IDE + Graphify/codebase graph workflows  
Repository: `tezeye-jforteza/ellement_ide`  
Created: 2026-05-22  
Last validated: 2026-05-22

## 1. Purpose

This guide documents what a fresh Ellement IDE install needs after the IDE is installed and booted, with special focus on the dependencies needed to create and use local codebase graphs through Graphify.

The goal is to provide a practical checklist that answers:

- what must be installed for the IDE to run;
- what must be installed for graph creation and workspace scanning;
- what is only needed for source development;
- what is optional for future Graph/RAG/vector database workflows;
- how to validate that the install is complete.

## 2. Key Findings

### 2.1 Ellement IDE product identity is already present

`product.json` identifies this fork as Ellement IDE:

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
  "urlProtocol": "ellement"
}
```

For an end-user packaged app, normal runtime dependencies should be bundled into the application. Host tools become important when Ellement IDE is expected to inspect repositories, build graphs, run source workflows, or integrate with external model/database services.

### 2.2 Graphify output is local and already present

The repo has local Graphify output under:

```text
graphify-out/
```

Key files observed:

```text
graphify-out/GRAPH_REPORT.md
graphify-out/manifest.json
graphify-out/graph.json
graphify-out/.graphify_root
graphify-out/.rebuild.lock
```

Local validation showed:

```text
graphify-out/GRAPH_REPORT.md  685K
graphify-out/manifest.json    2.2M
graphify-out/graph.json       387M
```

The graph report summarizes:

```text
10595 files · ~18,012,770 words
247814 nodes · 810446 edges · 6367 communities
Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
Token cost: 0 input · 0 output
Built from commit: 1e037601
Run graphify update . after code changes (no API cost).
```

This indicates the current Graphify workflow is primarily local file generation, not a hard dependency on Docker, Neo4j, Qdrant, or another always-running database service.

### 2.3 Graphify CLI is installed

The local machine has Graphify available at:

```text
/Users/jordanforteza/.local/bin/graphify
```

Help output begins with:

```text
Usage: graphify <command>

Commands:
  install [--platform P]  copy skill to platform config dir
  uninstall               remove graphify from all detected platforms in one shot
```

The generated report also documents:

```bash
graphify update .
```

as the post-change update command.

### 2.4 `ripgrep` was the missing host dependency

Initial validation found:

```text
rg NOT FOUND
```

It was installed with Homebrew:

```bash
brew install ripgrep
```

Final validation:

```text
ripgrep 15.1.0
```

`ripgrep` should be treated as a required/recommended host dependency for fast workspace scanning and graph creation workflows.

### 2.5 Source development requires Node from `.nvmrc`

The repo requires:

```text
22.22.1
```

from `.nvmrc`.

The machine initially used:

```text
Node v25.9.0
npm 11.12.1
```

The correct repo version was already installed through `nvm` and was activated successfully:

```text
Node v22.22.1
npm 10.9.4
```

For reliable source builds and package installs, always source `nvm` and run:

```bash
nvm use 22.22.1
```

before running repo commands.

## 3. Dependency Classification

### 3.1 Required for packaged Ellement IDE runtime

For an installed `.app` / `.dmg` release, these should be bundled or provided by the OS:

- Ellement IDE application bundle.
- Electron runtime bundled in the app.
- Built-in extensions included in the app bundle.
- Built-in search/parser dependencies bundled through the VS Code build.
- User data folder created on first launch.

Relevant product data folders:

```text
.ellement
.ellement-shared
.ellement-server
```

End users should not need Node.js or npm merely to launch the installed IDE.

### 3.2 Required/recommended for graph creation

Install these host tools on a fresh Mac when graph creation should work reliably:

| Dependency | Purpose | Status on validated machine |
| --- | --- | --- |
| Git | Repository inspection, commit freshness checks, source metadata | Installed |
| ripgrep / `rg` | Fast workspace scanning, search, graph input discovery | Installed during this task |
| Python 3 | Common Graph/RAG helper runtime, scripting, embeddings tooling | Installed |
| pip | Python package installer for helper tooling | Installed |
| SQLite | Local index/cache support | Installed |
| Graphify CLI | Create/update graph outputs | Installed |

Recommended install command:

```bash
brew install git ripgrep python sqlite
```

### 3.3 Required for developing/building Ellement IDE from source

These are source-development dependencies, not packaged-app runtime dependencies:

| Dependency | Purpose | Required version/status |
| --- | --- | --- |
| nvm | Select repo Node version | Installed |
| Node.js | Build scripts, npm scripts, extension builds | `22.22.1` |
| npm | Dependency install and scripts | `10.9.4` with Node 22.22.1 |

Source setup:

```bash
nvm install 22.22.1
nvm use 22.22.1
npm install
```

Optional extension install path if working directly inside `extensions/`:

```bash
cd extensions
npm install
```

### 3.4 Optional for future Graph/RAG service backends

These are not proven hard requirements for the current local Graphify output, but they may be needed if Ellement later adds a persistent graph or vector service:

| Dependency | Use when |
| --- | --- |
| Docker Desktop | Running local graph/vector/database containers |
| PostgreSQL client / `psql` | Connecting to local or remote Postgres metadata/vector stores |
| Postgres + pgvector | Storing embeddings and metadata in one database |
| Neo4j | Property graph database backend |
| Qdrant / Chroma / LanceDB / Weaviate | Dedicated vector search backend |
| Ollama | Local model/embedding provider |

Docker is installed on the validated machine, but the daemon was not running:

```text
Docker version 28.3.0
docker daemon not running/not required for current local graph files
```

Only start Docker if a specific backend requires it:

```bash
open -a Docker
docker info
```

## 4. Implementation Steps Completed

### Step 1 — Verify dependency state

Command used:

```bash
for c in git rg node npm python3 pip3 sqlite3 docker psql brew nvm; do
  printf '%-8s ' "$c"
  if command -v "$c" >/dev/null 2>&1; then
    command -v "$c"
  else
    echo 'NOT FOUND'
  fi
done
```

Initial result identified:

```text
rg NOT FOUND
node v25.9.0
repo-required Node from .nvmrc: 22.22.1
```

### Step 2 — Install missing host tool

Installed `ripgrep`:

```bash
brew install ripgrep
```

Validated:

```bash
rg --version
```

Result:

```text
ripgrep 15.1.0
```

### Step 3 — Activate repo Node version

Command used:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22.22.1
nvm use 22.22.1
node -v
npm -v
```

Result:

```text
v22.22.1 is already installed.
Now using node v22.22.1 (npm v10.9.4)
```

### Step 4 — Validate Graph/RAG optional dependencies

Command used:

```bash
rg --version | head -n 1
python3 --version
pip3 --version
sqlite3 --version
psql --version
docker --version
docker info
```

Results:

```text
ripgrep 15.1.0
Python 3.14.5
pip 26.1.1
sqlite3 3.51.0
psql (PostgreSQL) 18.4
Docker version 28.3.0
docker daemon not running or not accessible
```

Docker daemon status is acceptable for the current local Graphify file workflow.

### Step 5 — Validate graph output

Commands used:

```bash
ls -lh graphify-out/GRAPH_REPORT.md graphify-out/manifest.json graphify-out/graph.json
sed -n '1,16p' graphify-out/GRAPH_REPORT.md
git rev-parse --short HEAD
```

Important result:

```text
Built from commit: 1e037601
Current HEAD: 1e037601435
```

The graph appears fresh for the current checked-out commit.

## 5. Fresh Install Runbook

### 5.1 End-user machine, packaged Ellement IDE only

Use this when the user only installs and launches the app:

```text
1. Install Ellement IDE.
2. Launch once.
3. Confirm user data/profile folder is created.
4. Sign in/configure any AI provider used by the product.
5. Open a repository.
6. Confirm search and terminal work.
```

No standalone Node.js/npm requirement should be imposed on this path.

### 5.2 End-user or developer machine with graph creation

Use this when the user needs Graphify/codebase graph support:

```bash
brew install git ripgrep python sqlite
```

Then validate:

```bash
git --version
rg --version
python3 --version
pip3 --version
sqlite3 --version
graphify --help
```

Generate or update the graph:

```bash
graphify update .
```

Expected local output:

```text
graphify-out/GRAPH_REPORT.md
graphify-out/manifest.json
graphify-out/graph.json
```

### 5.3 Source checkout / IDE development machine

Use this when building or modifying Ellement IDE from source:

```bash
nvm install 22.22.1
nvm use 22.22.1
npm install
npm run compile
```

Before every source-development session:

```bash
nvm use
node -v
npm -v
```

Expected:

```text
v22.22.1
10.9.4
```

### 5.4 Optional service-backed Graph/RAG setup

Only use this if Ellement adds or enables a graph/vector backend:

```bash
brew install --cask docker
open -a Docker
docker info
```

Then install/configure whichever backend is explicitly selected:

- Neo4j for property graph storage.
- Postgres + pgvector for SQL + vector storage.
- Qdrant/Chroma/LanceDB/Weaviate for vector search.
- Ollama or a cloud model provider for local/cloud embeddings.

Do not make these mandatory until the product has a concrete backend requirement.

## 6. Validation Checklist

Use this after a fresh install or after provisioning a new development machine.

### 6.1 Core host tools

```bash
git --version
rg --version
python3 --version
pip3 --version
sqlite3 --version
```

Expected on validated machine:

```text
git version 2.50.0
ripgrep 15.1.0
Python 3.14.5
pip 26.1.1
sqlite3 3.51.0
```

### 6.2 Source repo tools

```bash
cat .nvmrc
nvm use
node -v
npm -v
```

Expected:

```text
22.22.1
v22.22.1
10.9.4
```

### 6.3 Graphify tools

```bash
command -v graphify
graphify --help
ls -lh graphify-out/GRAPH_REPORT.md graphify-out/manifest.json graphify-out/graph.json
sed -n '1,16p' graphify-out/GRAPH_REPORT.md
```

Expected:

```text
Graph report exists
manifest exists
graph.json exists
report commit matches or is intentionally behind current HEAD
```

### 6.4 Docker/backend tools

```bash
docker --version
docker info
psql --version
```

Interpretation:

- `docker --version` should work if Docker Desktop is installed.
- `docker info` only needs to work if the selected graph/vector backend needs containers.
- `psql` is useful for database diagnostics, but not required by the current local Graphify file output.

## 7. Troubleshooting

### 7.1 `rg: command not found`

Install ripgrep:

```bash
brew install ripgrep
```

Validate:

```bash
rg --version
```

### 7.2 Wrong Node version

Symptom:

```text
node -v
v25.x.x
```

Fix:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install 22.22.1
nvm use 22.22.1
```

### 7.3 Graph is stale

Check:

```bash
git rev-parse --short HEAD
grep 'Built from commit' graphify-out/GRAPH_REPORT.md
```

If they do not match intentionally, update:

```bash
graphify update .
```

### 7.4 Docker daemon unavailable

Symptom:

```text
docker daemon not running or not accessible
```

If a backend needs Docker:

```bash
open -a Docker
docker info
```

If using only current local Graphify files, this is not blocking.

## 8. Security Note

The local `.env` file contains real-looking secrets/API keys. This guide does not reproduce those values.

Actions recommended:

1. Keep `.env` ignored and out of commits.
2. Rotate any key that may have been exposed.
3. Prefer app settings, secret storage, or a dedicated local secret manager for end-user provider keys.
4. Never package developer `.env` values into a release build.

## 9. Final Recommended Checklist

For a complete fresh install that supports Ellement IDE plus local Graphify graph generation:

```bash
brew install git ripgrep python sqlite
```

For source development:

```bash
nvm install 22.22.1
nvm use 22.22.1
npm install
```

For Graphify validation/update:

```bash
graphify --help
graphify update .
```

For optional service-backed graph/vector workflows only:

```bash
brew install --cask docker
open -a Docker
```

## 10. Current Completion State

- [x] Verified host dependency state.
- [x] Installed missing `ripgrep` dependency.
- [x] Verified `nvm` and Node `22.22.1`.
- [x] Verified Python, pip, SQLite, PostgreSQL client, Docker CLI.
- [x] Confirmed Docker daemon is not currently required for existing local graph files.
- [x] Confirmed `graphify` CLI exists.
- [x] Confirmed `graphify-out/` contains graph report, manifest, and graph JSON.
- [x] Confirmed graph report commit matches the current repository commit prefix.
- [x] Documented remaining manual security action: rotate/externalize exposed `.env` secrets.