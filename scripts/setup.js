#!/usr/bin/env node

/**
 * Midi Stagehand Skill — Environment Setup Script
 *
 * One-click initialization for all runtime dependencies:
 * - Smart npm mirror detection (China/International)
 * - npx cache warming for @midscene/web and tsx
 * - System Chrome detection (skips Chromium download if found)
 * - Environment readiness report
 *
 * Usage:
 *   npm run setup              # Full setup
 *   node scripts/setup.js      # Full setup
 *   node scripts/setup.js --postinstall  # Lightweight mode (npx cache only)
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── Configuration ──────────────────────────────────────────────────────────

const CHINA_MIRROR = 'https://registry.npmmirror.com';
const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const PING_TIMEOUT_MS = 3000;

const isPostInstall = process.argv.includes('--postinstall');
const isWindows = os.platform() === 'win32';
const projectRoot = path.resolve(__dirname, '..');

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(icon, msg) {
  console.log(icon + '  ' + msg);
}

function logSection(title) {
  console.log('\n' + '─'.repeat(50));
  console.log('  ' + title);
  console.log('─'.repeat(50));
}

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: opts.silent ? 'pipe' : 'inherit',
      cwd: opts.cwd || projectRoot,
      env: Object.assign({}, process.env, opts.env || {}),
      timeout: opts.timeout || 120000,
      ...opts
    });
  } catch (e) {
    if (opts.ignoreError) return e.stdout || '';
    throw e;
  }
}

function execSilent(cmd, opts = {}) {
  return exec(cmd, Object.assign({ silent: true, ignoreError: true, stdio: 'pipe' }, opts));
}

function commandExists(cmd) {
  try {
    if (isWindows) {
      execSync('where ' + cmd, { stdio: 'pipe', timeout: 5000 });
    } else {
      execSync('which ' + cmd, { stdio: 'pipe', timeout: 5000 });
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Step 1: Detect npm mirror ──────────────────────────────────────────────

function detectBestRegistry() {
  logSection('Step 1: Detecting best npm registry');

  // Check if user already has a custom registry configured
  const currentRegistry = execSilent('npm config get registry').trim();
  if (currentRegistry && currentRegistry !== DEFAULT_REGISTRY && currentRegistry !== 'undefined') {
    log('[OK]', 'Using existing registry: ' + currentRegistry);
    return currentRegistry;
  }

  // Ping test to decide mirror
  log('[..]', 'Testing network to select optimal registry...');

  const chinaPing = pingRegistry(CHINA_MIRROR);
  const defaultPing = pingRegistry(DEFAULT_REGISTRY);

  if (chinaPing !== null && (defaultPing === null || chinaPing < defaultPing * 0.7)) {
    log('[OK]', 'China network detected, using npmmirror: ' + CHINA_MIRROR + ' (' + chinaPing + 'ms)');
    return CHINA_MIRROR;
  }

  log('[OK]', 'Using default npm registry: ' + DEFAULT_REGISTRY + (defaultPing ? ' (' + defaultPing + 'ms)' : ''));
  return DEFAULT_REGISTRY;
}

function pingRegistry(url) {
  try {
    const start = Date.now();
    // Use npm ping or a lightweight HTTP check
    execSync(
      'node -e "const h=require(\'https\');const r=h.get(\'' + url + '/-/ping\',{timeout:' + PING_TIMEOUT_MS + '},res=>{process.exit(res.statusCode<400?0:1)});r.on(\'error\',()=>process.exit(1));r.on(\'timeout\',()=>{r.destroy();process.exit(1)})"',
      { stdio: 'pipe', timeout: PING_TIMEOUT_MS + 2000 }
    );
    return Date.now() - start;
  } catch {
    return null;
  }
}

// ─── Step 2: Install project dependencies ───────────────────────────────────

function installDependencies(registry) {
  logSection('Step 2: Installing project dependencies');

  if (fs.existsSync(path.join(projectRoot, 'node_modules', '.package-lock.json'))) {
    log('[OK]', 'node_modules already exists, running npm install to sync...');
  }

  const registryFlag = registry !== DEFAULT_REGISTRY ? ' --registry=' + registry : '';
  exec('npm install' + registryFlag, { env: { MIDI_SETUP_RUNNING: '1' } });
  log('[OK]', 'Project dependencies installed');
}

// ─── Step 3: Warm npx cache ─────────────────────────────────────────────────

function warmNpxCache(registry) {
  logSection('Step 3: Warming npx cache');

  const registryFlag = registry !== DEFAULT_REGISTRY ? ' --registry=' + registry : '';
  const envSkipPuppeteer = { PUPPETEER_SKIP_DOWNLOAD: 'true' };

  // Check if @midscene/web is already locally installed
  const midsceneBin = path.join(projectRoot, 'node_modules', '.bin', 'midscene');
  const midsceneBinCmd = midsceneBin + (isWindows ? '.cmd' : '');
  if (fs.existsSync(midsceneBinCmd)) {
    log('[OK]', '@midscene/web already available locally');
  } else {
    log('[..]', 'Warming @midscene/web into npx cache (skipping Chromium download)...');
    try {
      exec('npx' + registryFlag + ' --yes @midscene/web@1 --version', {
        env: envSkipPuppeteer,
        silent: true,
        timeout: 180000,
        ignoreError: true
      });
      log('[OK]', '@midscene/web cached');
    } catch {
      log('[!!]', '@midscene/web cache warming failed (will download on first run)');
    }
  }

  // Check if tsx is already locally installed
  const tsxBin = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
  const tsxBinCmd = tsxBin + (isWindows ? '.cmd' : '');
  if (fs.existsSync(tsxBinCmd)) {
    log('[OK]', 'tsx already available locally');
  } else {
    log('[..]', 'Warming tsx into npx cache...');
    try {
      exec('npx' + registryFlag + ' --yes tsx --version', {
        silent: true,
        timeout: 60000,
        ignoreError: true
      });
      log('[OK]', 'tsx cached');
    } catch {
      log('[!!]', 'tsx cache warming failed (will download on first run)');
    }
  }
}

// ─── Step 4: Detect / download Chrome ───────────────────────────────────────

function findSystemChrome() {
  const candidates = [];

  if (isWindows) {
    const programFiles = [
      process.env['PROGRAMFILES'],
      process.env['PROGRAMFILES(X86)'],
      process.env['LOCALAPPDATA']
    ].filter(Boolean);

    for (const base of programFiles) {
      candidates.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      candidates.push(path.join(base, 'Chromium', 'Application', 'chrome.exe'));
    }
    // Edge as fallback (Chromium-based)
    for (const base of programFiles) {
      candidates.push(path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (os.platform() === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    // Linux
    candidates.push('/usr/bin/google-chrome');
    candidates.push('/usr/bin/google-chrome-stable');
    candidates.push('/usr/bin/chromium');
    candidates.push('/usr/bin/chromium-browser');
    candidates.push('/snap/bin/chromium');
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Try command-based detection
  if (commandExists('google-chrome')) return 'google-chrome';
  if (commandExists('chromium')) return 'chromium';
  if (commandExists('chromium-browser')) return 'chromium-browser';

  return null;
}

function setupChrome(registry) {
  logSection('Step 4: Chrome / Chromium detection');

  const chromePath = findSystemChrome();

  if (chromePath) {
    log('[OK]', 'System Chrome found: ' + chromePath);
    log('[OK]', 'Skipping Chromium download (PUPPETEER_SKIP_DOWNLOAD=true)');
    return { chromePath, downloaded: false };
  }

  log('[!!]', 'No system Chrome found');
  log('[..]', 'Downloading Chromium via puppeteer...');

  // Use China mirror for Chromium download when on China network
  if (registry === CHINA_MIRROR && !process.env.PUPPETEER_DOWNLOAD_BASE_URL) {
    process.env.PUPPETEER_DOWNLOAD_BASE_URL = 'https://cdn.npmmirror.com/binaries/chrome-for-testing';
    log('[OK]', 'Using China mirror for Chromium download');
  }

  const registryFlag = registry !== CHINA_MIRROR ? '' : ' --registry=' + registry;
  try {
    // Trigger puppeteer's browser download
    exec('npx' + registryFlag + ' --yes puppeteer browsers install chrome', {
      timeout: 600000 // 10 min for large download
    });
    log('[OK]', 'Chromium downloaded successfully');
    return { chromePath: null, downloaded: true };
  } catch {
    log('[!!]', 'Chromium download failed. Please install Chrome manually.');
    log('[!!]', 'Download from: https://www.google.com/chrome/');
    return { chromePath: null, downloaded: false };
  }
}

// ─── Step 5: Environment report ─────────────────────────────────────────────

function printReport(results) {
  logSection('Environment Report');

  const checks = [
    { label: 'Node.js', check: () => execSilent('node --version').trim() },
    { label: 'npm', check: () => execSilent('npm --version').trim() },
    {
      label: '@midscene/web',
      check: () => {
        const bin = path.join(projectRoot, 'node_modules', '.bin', 'midscene' + (isWindows ? '.cmd' : ''));
        return fs.existsSync(bin) ? 'local' : 'npx cache';
      }
    },
    {
      label: 'tsx',
      check: () => {
        const bin = path.join(projectRoot, 'node_modules', '.bin', 'tsx' + (isWindows ? '.cmd' : ''));
        return fs.existsSync(bin) ? 'local' : 'npx cache';
      }
    },
    {
      label: 'Chrome',
      check: () => {
        if (results.chrome.chromePath) return results.chrome.chromePath;
        if (results.chrome.downloaded) return 'Chromium (downloaded)';
        return 'NOT FOUND';
      }
    },
    {
      label: 'Model Config',
      check: () => {
        const apiKey = process.env.MIDSCENE_MODEL_API_KEY;
        const envFile = fs.existsSync(path.join(projectRoot, '.env'));
        if (apiKey) {
          return 'configured (***masked)';
        }
        if (envFile) {
          return 'NOT SET (but .env file exists — check MIDSCENE_MODEL_API_KEY inside)';
        }
        return 'NOT SET — create .env with MIDSCENE_MODEL_API_KEY (see README)';
      }
    }
  ];

  let allOk = true;
  for (const c of checks) {
    const val = c.check();
    const ok = val && !val.includes('NOT FOUND') && !val.includes('NOT SET');
    if (!ok) allOk = false;
    log(ok ? '[OK]' : '[!!]', c.label + ': ' + (val || 'unknown'));
  }

  console.log('');
  if (allOk) {
    log('[OK]', 'Environment ready! You can now run:');
    console.log('    node scripts/midscene-run.js <your-yaml-file>');
  } else {
    log('[!!]', 'Some components are missing. Check the warnings above.');
  }
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('  Midi Stagehand Skill — Environment Setup');
  console.log('');

  if (isPostInstall) {
    // Skip if already running inside full setup (avoids duplicate npx warming)
    if (process.env.MIDI_SETUP_RUNNING === '1') return;
    // Lightweight mode: only warm npx cache, skip heavy steps
    log('[..]', 'Post-install mode: warming npx cache...');
    warmNpxCache(DEFAULT_REGISTRY);
    log('[OK]', 'Post-install complete');
    return;
  }

  // Full setup
  const registry = detectBestRegistry();
  installDependencies(registry);
  warmNpxCache(registry);
  const chrome = setupChrome(registry);
  printReport({ chrome });
}

main().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
