#!/usr/bin/env node
'use strict';

/**
 * health-check.js
 * One-command environment health check for Midscene YAML execution.
 * Consolidates all pre-flight checks from Runner Step 0.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findSystemChrome } = require('../src/runner/runner-utils');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    const result = fn();
    console.log('  \u2713 ' + label + (result ? ' — ' + result : ''));
    passed++;
  } catch (err) {
    console.log('  \u2717 ' + label + ' — ' + err.message);
    failed++;
  }
}

console.log('\nMidscene Environment Health Check\n');

// 1. Node.js version
check('Node.js >= 22', () => {
  const ver = process.versions.node;
  const major = parseInt(ver.split('.')[0], 10);
  if (major < 22) throw new Error('Found v' + ver + ', need >= 22 (required for fs.globSync)');
  return 'v' + ver;
});

// 2. Dependencies installed
check('Dependencies installed', () => {
  const nm = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nm)) throw new Error('Run: npm install');
  return 'node_modules exists';
});

// 3. CLI script exists
check('CLI script (midscene-run.js)', () => {
  const cli = path.join(ROOT, 'scripts', 'midscene-run.js');
  if (!fs.existsSync(cli)) throw new Error('scripts/midscene-run.js not found');
  return 'OK';
});

// 4. @midscene/web available
check('@midscene/web available', () => {
  try {
    const out = execSync('npx @midscene/web --version', {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    }).toString().trim();
    return out || 'installed';
  } catch {
    throw new Error('Run: npm install @midscene/web');
  }
});

// 5. tsx runtime (for Extended mode)
check('tsx runtime (Extended mode)', () => {
  try {
    const out = execSync('npx tsx --version', {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    }).toString().trim();
    return out || 'installed';
  } catch {
    throw new Error('Run: npm install tsx');
  }
});

// 6. AI model configuration
check('AI model configured', () => {
  // Load .env if present
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
      if (match) {
        const [, key, val] = match;
        // Strip surrounding quotes from .env values
        const stripped = val.replace(/^(['"])(.*)\1$/, '$2');
        if (!process.env[key]) process.env[key] = stripped;
      }
    }
  }
  const key = process.env.MIDSCENE_MODEL_API_KEY;
  if (!key) throw new Error('MIDSCENE_MODEL_API_KEY not set (check .env or environment)');
  return 'MIDSCENE_MODEL_API_KEY is set';
});

// 7. Chrome browser (Web platform) — reuse shared findSystemChrome()
check('Chrome browser (Web platform)', () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      return 'PUPPETEER_EXECUTABLE_PATH: ' + process.env.PUPPETEER_EXECUTABLE_PATH;
    }
  }

  const chromePath = findSystemChrome();
  if (chromePath) return chromePath;
  throw new Error('Chrome not found. Install Chrome or set PUPPETEER_EXECUTABLE_PATH');
});

// Summary
console.log('\n' + '-'.repeat(40));
console.log('Passed: ' + passed + '  Failed: ' + failed);
if (failed > 0) {
  console.log('\nFix the issues above before running YAML files.');
  process.exit(1);
} else {
  console.log('\nEnvironment is ready!');
}
