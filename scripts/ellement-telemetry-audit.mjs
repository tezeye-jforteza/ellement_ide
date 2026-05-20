/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createReadStream, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const scannerPath = fileURLToPath(import.meta.url);

const defaultIgnoredDirectories = new Set([
	'.git',
	'.hg',
	'.svn',
	'.build',
	'.cache',
	'.vscode-test',
	'coverage',
	'dist',
	'graphify-out',
	'node_modules',
	'out',
	'test-results'
]);

const skippedFileNames = new Set([
	'bun.lockb',
	'package-lock.json',
	'pnpm-lock.yaml',
	'yarn.lock'
]);

const skippedExtensions = new Set([
	'.7z',
	'.asar',
	'.bmp',
	'.db',
	'.gif',
	'.icns',
	'.ico',
	'.jpg',
	'.jpeg',
	'.lock',
	'.mp3',
	'.mp4',
	'.pdf',
	'.png',
	'.snap',
	'.ttf',
	'.webp',
	'.zip'
]);

const patterns = [
	{
		category: 'collector-endpoint',
		severity: 'high',
		regex: /\b(mobile\.events\.data\.microsoft\.com|dc\.services\.visualstudio\.com|vortex\.data\.microsoft\.com|appcenter\.ms|applicationinsights|sentry\.io|segment\.io|api\.amplitude\.com|mixpanel\.com|posthog|datadoghq|newrelic)\b/i
	},
	{
		category: 'telemetry-api',
		severity: 'medium',
		regex: /\b(publicLog2?|publicLogError2?|sendTelemetryEvent|TelemetryReporter|ITelemetryService|trackEvent|trackException|captureException|recordEvent)\b/
	},
	{
		category: 'telemetry-config',
		severity: 'medium',
		regex: /\b(enableTelemetry|telemetryLevel|enableCrashReporter|disable-telemetry|disableTelemetry|showTelemetryOptOut|enabledTelemetryLevels|aiConfig|ariaKey)\b/
	},
	{
		category: 'experimentation',
		severity: 'medium',
		regex: /\b(tasConfig|ExperimentationService|experimentation|enableExperiments|disable-experiments|feature\s*flag|assignmentContext)\b/i
	},
	{
		category: 'crash-reporting',
		severity: 'medium',
		regex: /\b(crashReporter|crash-reporter|Crashpad|crash report|crash reporting)\b/i
	},
	{
		category: 'stable-identifier',
		severity: 'medium',
		regex: /\b(machineId|sqmId|devDeviceId|sessionId|distinctId|deviceId|installationId|visitorId|telemetryId)\b/
	},
	{
		category: 'privacy-marker',
		severity: 'low',
		regex: /\b(__GDPR__|GDPR|privacyStatementUrl|TelemetryTrustedValue|SystemMetaData|CallstackOrException)\b/
	}
];

const severityRank = new Map([
	['low', 1],
	['medium', 2],
	['high', 3]
]);

function parseArgs(argv) {
	const options = {
		root: process.cwd(),
		json: false,
		summary: false,
		includeLockfiles: false,
		includeTests: false,
		maxBytes: 1024 * 1024,
		failOn: undefined,
		ignoredDirectories: new Set(defaultIgnoredDirectories)
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
		if (arg === '--json') {
			options.json = true;
			continue;
		}
		if (arg === '--summary') {
			options.summary = true;
			continue;
		}
		if (arg === '--include-tests') {
			options.includeTests = true;
			continue;
		}
		if (arg === '--include-lockfiles') {
			options.includeLockfiles = true;
			continue;
		}
		if (arg === '--max-size-kb') {
			options.maxBytes = Number(argv[++i]) * 1024;
			continue;
		}
		if (arg === '--fail-on') {
			options.failOn = argv[++i];
			continue;
		}
		if (arg === '--ignore-dir') {
			options.ignoredDirectories.add(argv[++i]);
			continue;
		}
		if (!arg.startsWith('-')) {
			options.root = resolve(arg);
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (options.failOn && !severityRank.has(options.failOn)) {
		throw new Error(`--fail-on must be one of: ${[...severityRank.keys()].join(', ')}`);
	}

	return options;
}

function printHelp() {
	console.log([
		'Usage: node scripts/ellement-telemetry-audit.mjs [root] [options]',
		'',
		'Options:',
		'  --json              Emit JSON instead of Markdown',
		'  --summary           Emit only summary counts',
		'  --include-tests     Include files under test folders',
		'  --include-lockfiles Include dependency lockfiles',
		'  --max-size-kb <kb>  Skip files larger than this size, default 1024',
		'  --ignore-dir <dir>  Add a directory name to skip',
		'  --fail-on <level>   Exit 2 if a finding at level low, medium, or high is found',
		''
	].join('\n'));
}

function extensionOf(file) {
	const index = file.lastIndexOf('.');
	return index === -1 ? '' : file.slice(index).toLowerCase();
}

function shouldSkipFile(root, file, stats, options) {
	if (!stats.isFile()) {
		return true;
	}
	if (file === scannerPath) {
		return true;
	}
	if (stats.size > options.maxBytes) {
		return true;
	}
	if (!options.includeLockfiles && skippedFileNames.has(file.split(/[\\/]/).at(-1))) {
		return true;
	}
	if (skippedExtensions.has(extensionOf(file))) {
		return true;
	}
	if (!options.includeTests && /(^|\/)(test|tests|fixtures|node_modules)(\/|$)/.test(relative(root, file))) {
		return true;
	}
	return false;
}

function walk(root, dir, options, files) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory() && options.ignoredDirectories.has(entry.name)) {
			continue;
		}

		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(root, fullPath, options, files);
			continue;
		}

		const stats = statSync(fullPath);
		if (!shouldSkipFile(root, fullPath, stats, options)) {
			files.push(fullPath);
		}
	}
}

async function scanFile(root, file) {
	const findings = [];
	const input = createReadStream(file, { encoding: 'utf8' });
	const reader = createInterface({ input, crlfDelay: Infinity });
	let lineNumber = 0;

	for await (const line of reader) {
		lineNumber++;
		for (const pattern of patterns) {
			pattern.regex.lastIndex = 0;
			const match = pattern.regex.exec(line);
			if (match) {
				findings.push({
					file: relative(root, file),
					line: lineNumber,
					category: pattern.category,
					severity: pattern.severity,
					match: match[0],
					text: line.trim().slice(0, 240)
				});
			}
		}
	}

	return findings;
}

function summarize(findings) {
	const summary = {
		total: findings.length,
		bySeverity: {},
		byCategory: {}
	};

	for (const finding of findings) {
		summary.bySeverity[finding.severity] = (summary.bySeverity[finding.severity] ?? 0) + 1;
		summary.byCategory[finding.category] = (summary.byCategory[finding.category] ?? 0) + 1;
	}

	return summary;
}

function markdownEscape(value) {
	return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function renderMarkdown(root, findings) {
	const summary = summarize(findings);
	const lines = [
		'# Ellement Telemetry Audit',
		'',
		`Root: \`${root}\``,
		`Findings: ${summary.total}`,
		'',
		'## Summary',
		'',
		'### By Severity',
		'',
		'| Severity | Count |',
		'| --- | ---: |',
		...Object.entries(summary.bySeverity).sort().map(([severity, count]) => `| ${severity} | ${count} |`),
		'',
		'### By Category',
		'',
		'| Category | Count |',
		'| --- | ---: |',
		...Object.entries(summary.byCategory).sort().map(([category, count]) => `| ${category} | ${count} |`),
		'',
		'## Findings',
		'',
		'| Severity | Category | Location | Match | Line |',
		'| --- | --- | --- | --- | --- |'
	];

	for (const finding of findings) {
		lines.push(`| ${finding.severity} | ${finding.category} | \`${finding.file}:${finding.line}\` | \`${markdownEscape(finding.match)}\` | ${markdownEscape(finding.text)} |`);
	}

	return `${lines.join('\n')}\n`;
}

function renderSummary(root, findings) {
	const summary = summarize(findings);
	const lines = [
		'# Ellement Telemetry Audit Summary',
		'',
		`Root: \`${root}\``,
		`Findings: ${summary.total}`,
		'',
		'## By Severity',
		'',
		'| Severity | Count |',
		'| --- | ---: |',
		...Object.entries(summary.bySeverity).sort().map(([severity, count]) => `| ${severity} | ${count} |`),
		'',
		'## By Category',
		'',
		'| Category | Count |',
		'| --- | ---: |',
		...Object.entries(summary.byCategory).sort().map(([category, count]) => `| ${category} | ${count} |`),
		'',
		'## High Severity Findings',
		'',
		'| Category | Location | Match |',
		'| --- | --- | --- |'
	];

	for (const finding of findings.filter(finding => finding.severity === 'high')) {
		lines.push(`| ${finding.category} | \`${finding.file}:${finding.line}\` | \`${markdownEscape(finding.match)}\` |`);
	}

	return `${lines.join('\n')}\n`;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const files = [];
	walk(options.root, options.root, options, files);

	const findings = [];
	for (const file of files) {
		findings.push(...await scanFile(options.root, file));
	}

	findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.category.localeCompare(b.category));

	if (options.json) {
		console.log(JSON.stringify({ root: options.root, summary: summarize(findings), findings }, undefined, 2));
	} else if (options.summary) {
		process.stdout.write(renderSummary(options.root, findings));
	} else {
		process.stdout.write(renderMarkdown(options.root, findings));
	}

	if (options.failOn) {
		const threshold = severityRank.get(options.failOn);
		if (findings.some(finding => severityRank.get(finding.severity) >= threshold)) {
			process.exit(2);
		}
	}
}

main().catch(err => {
	console.error(err.message);
	process.exit(1);
});
