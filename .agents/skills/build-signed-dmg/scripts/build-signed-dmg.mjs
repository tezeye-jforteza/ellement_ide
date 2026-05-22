#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { sign } from '../../../../build/node_modules/@electron/osx-sign/dist/index.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const args = new Set(process.argv.slice(2));
const arch = getArgValue('--arch') ?? 'arm64';
const quality = getArgValue('--quality') ?? 'stable';
const skipBuild = args.has('--skip-build');
const skipNotarize = args.has('--skip-notarize');
const skipMountValidate = args.has('--skip-mount-validate');
const dryRun = args.has('--dry-run');
const outputDir = path.join(repoRoot, '.build', 'darwin', 'dmg');
const parentBuildDir = path.dirname(repoRoot);
const product = JSON.parse(fs.readFileSync(path.join(repoRoot, 'product.json'), 'utf8'));
const appRoot = path.join(parentBuildDir, `VSCode-darwin-${arch}`);
const appPath = path.join(appRoot, `${product.nameLong}.app`);
const dmgPath = path.join(outputDir, `VSCode-darwin-${arch}.dmg`);
const envFile = path.join(repoRoot, '.env');
const dotenv = fs.existsSync(envFile) ? parseEnvFile(fs.readFileSync(envFile, 'utf8')) : {};
const mergedEnv = { ...process.env, ...dotenv, VSCODE_ARCH: arch, VSCODE_QUALITY: quality };

process.chdir(repoRoot);

const identity = resolveDeveloperIdApplicationIdentity(mergedEnv);
console.log(`Using signing identity: ${identity.name}`);

if (dryRun) {
	console.log('');
	console.log('Dry run only');
	console.log(`Repo: ${repoRoot}`);
	console.log(`Arch: ${arch}`);
	console.log(`Quality: ${quality}`);
	console.log(`App path: ${appPath}`);
	console.log(`DMG path: ${dmgPath}`);
	console.log(`Notarization credentials: ${skipNotarize ? 'not required (--skip-notarize)' : hasNotarizationCredentials(mergedEnv) ? 'present' : 'missing'}`);
	process.exit(0);
}

if (!skipBuild) {
	run('npm', ['run', 'gulp', `vscode-darwin-${arch}-min`], { env: mergedEnv });
}

if (!fs.existsSync(appPath)) {
	throw new Error(`Packaged app not found: ${appPath}`);
}

await signApp(identity.hash);
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

fs.mkdirSync(outputDir, { recursive: true });
run(process.execPath, ['build/darwin/create-dmg.ts', parentBuildDir, outputDir], { env: mergedEnv });
run('python3', ['build/darwin/patch-dmg.py', dmgPath, 'resources/darwin/code.icns']);
run('codesign', ['--force', '--timestamp', '--sign', identity.hash, dmgPath]);
run('codesign', ['--verify', '--verbose=2', dmgPath]);

if (!skipNotarize) {
	for (const key of ['APPLE_ID', 'APPLE_TEAM_ID', 'APPLE_APP_SPECIFIC_PASSWORD']) {
		if (!mergedEnv[key]) {
			throw new Error(`${key} is required in .env for notarization. Use --skip-notarize only for local unsigned distribution tests.`);
		}
	}

	run('xcrun', [
		'notarytool',
		'submit',
		dmgPath,
		'--apple-id',
		mergedEnv.APPLE_ID,
		'--team-id',
		mergedEnv.APPLE_TEAM_ID,
		'--password',
		mergedEnv.APPLE_APP_SPECIFIC_PASSWORD,
		'--wait'
	], { redact: [mergedEnv.APPLE_APP_SPECIFIC_PASSWORD] });

	run('xcrun', ['stapler', 'staple', dmgPath]);
	run('xcrun', ['stapler', 'validate', dmgPath]);
	run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose', dmgPath]);
}

if (!skipMountValidate) {
	validateMountedDmg();
}

const sha256 = runCapture('shasum', ['-a', '256', dmgPath]).trim().split(/\s+/)[0];
const size = fs.statSync(dmgPath).size;
console.log('');
console.log('Signed DMG ready');
console.log(`Path: ${dmgPath}`);
console.log(`Size: ${formatBytes(size)}`);
console.log(`SHA-256: ${sha256}`);

function getArgValue(name) {
	const prefix = `${name}=`;
	const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
	return arg ? arg.slice(prefix.length) : undefined;
}

function parseEnvFile(contents) {
	const result = {};

	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) {
			continue;
		}

		const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
		const match = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) {
			continue;
		}

		let value = match[2].trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}

		result[match[1]] = value;
	}

	return result;
}

function resolveDeveloperIdApplicationIdentity(env) {
	const identities = runCapture('security', ['find-identity', '-v', '-p', 'codesigning'])
		.split(/\r?\n/)
		.map(line => line.match(/\)\s+([A-Fa-f0-9]{40})\s+"([^"]+)"/))
		.filter(Boolean)
		.map(match => ({ hash: match[1].toUpperCase(), name: match[2] }));

	const candidates = identities.filter(identity => identity.name.startsWith('Developer ID Application:'));
	if (candidates.length === 0) {
		throw new Error('No Developer ID Application identity found in the keychain.');
	}

	const configured = env.DEVELOPER_ID_APPLICATION || env.CODESIGN_IDENTITY || env.DEVELOPER_ID;
	if (configured) {
		const normalized = configured.trim();
		const exact = candidates.find(identity => identity.hash === normalized.toUpperCase() || identity.name === normalized);
		if (exact) {
			return exact;
		}

		if (env.DEVELOPER_ID_APPLICATION || env.CODESIGN_IDENTITY) {
			throw new Error('Configured Developer ID signing identity does not match an installed Developer ID Application identity.');
		}

		console.warn('Ignoring DEVELOPER_ID because it is not a Developer ID Application identity.');
	}

	const teamCandidates = env.APPLE_TEAM_ID
		? candidates.filter(identity => identity.name.includes(`(${env.APPLE_TEAM_ID})`))
		: candidates;

	if (teamCandidates.length === 1) {
		return teamCandidates[0];
	}

	throw new Error(`Expected exactly one Developer ID Application identity, found ${teamCandidates.length}. Set DEVELOPER_ID_APPLICATION in .env.`);
}

function hasNotarizationCredentials(env) {
	return Boolean(env.APPLE_ID && env.APPLE_TEAM_ID && env.APPLE_APP_SPECIFIC_PASSWORD);
}

async function signApp(identityHash) {
	const npmrc = fs.readFileSync(path.join(repoRoot, '.npmrc'), 'utf8');
	const version = /^target="(.*)"$/m.exec(npmrc)?.[1];
	if (!version) {
		throw new Error('Unable to read Electron target version from .npmrc.');
	}

	const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
	setPlistString(infoPlistPath, 'NSAppleEventsUsageDescription', 'An application in Visual Studio Code wants to use AppleScript.');
	setPlistString(infoPlistPath, 'NSMicrophoneUsageDescription', 'An application in Visual Studio Code wants to use the Microphone.');
	setPlistString(infoPlistPath, 'NSCameraUsageDescription', 'An application in Visual Studio Code wants to use the Camera.');
	setPlistString(infoPlistPath, 'NSAudioCaptureUsageDescription', 'An application in Visual Studio Code wants to use Audio Capture.');
	setPlistString(infoPlistPath, 'NSLocalNetworkUsageDescription', 'The app uses your local network for DNS resolution and to connect to locally running services.');

	await sign({
		app: appPath,
		platform: 'darwin',
		optionsForFile: filePath => ({
			entitlements: getEntitlementsForFile(filePath),
			hardenedRuntime: true,
		}),
		preAutoEntitlements: false,
		preEmbedProvisioningProfile: false,
		version,
		identity: identityHash,
	});
}

function setPlistString(plistPath, key, value) {
	const replace = spawnSync('plutil', ['-replace', key, '-string', value, plistPath], { encoding: 'utf8' });
	if (replace.status === 0) {
		return;
	}

	run('plutil', ['-insert', key, '-string', value, plistPath]);
}

function getEntitlementsForFile(filePath) {
	const baseDir = path.join(repoRoot, 'build');
	if (filePath.includes(' Helper (GPU).app')) {
		return path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-gpu-entitlements.plist');
	}
	if (filePath.includes(' Helper (Renderer).app')) {
		return path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-renderer-entitlements.plist');
	}
	if (filePath.includes(' Helper (Plugin).app')) {
		return path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-plugin-entitlements.plist');
	}
	if (filePath.includes(' Helper.app')) {
		return path.join(baseDir, 'azure-pipelines', 'darwin', 'helper-entitlements.plist');
	}
	return path.join(baseDir, 'azure-pipelines', 'darwin', 'app-entitlements.plist');
}

function validateMountedDmg() {
	let mountPoint;
	try {
		const output = runCapture('hdiutil', ['attach', dmgPath, '-nobrowse', '-readonly']);
		mountPoint = output
			.split(/\r?\n/)
			.map(line => line.match(/(\/Volumes\/.+)$/)?.[1])
			.filter(Boolean)
			.at(-1);

		if (!mountPoint) {
			throw new Error('Unable to determine mounted DMG volume.');
		}

		const mountedApp = path.join(mountPoint, `${product.nameLong}.app`);
		run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', mountedApp]);
		if (!skipNotarize) {
			run('spctl', ['--assess', '--type', 'execute', '--verbose', mountedApp]);
		}
	} finally {
		if (mountPoint) {
			run('hdiutil', ['detach', mountPoint]);
		}
	}
}

function run(command, commandArgs, options = {}) {
	const redactions = options.redact ?? [];
	const displayedArgs = commandArgs.map(arg => redactions.includes(arg) ? '********' : arg);
	console.log(`\n$ ${[command, ...displayedArgs.map(quoteArg)].join(' ')}`);
	const child = spawnSync(command, commandArgs, {
		stdio: 'inherit',
		cwd: repoRoot,
		env: options.env ?? process.env,
	});

	if (child.status !== 0) {
		throw new Error(`${command} failed with exit code ${child.status}`);
	}
}

function runCapture(command, commandArgs) {
	const child = spawnSync(command, commandArgs, {
		cwd: repoRoot,
		env: process.env,
		encoding: 'utf8',
	});

	if (child.status !== 0) {
		throw new Error(`${command} failed with exit code ${child.status}\n${child.stderr}`);
	}

	return child.stdout;
}

function quoteArg(value) {
	return /\s/.test(value) ? JSON.stringify(value) : value;
}

function formatBytes(bytes) {
	const units = ['B', 'KB', 'MB', 'GB'];
	let value = bytes;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index++;
	}
	return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}
