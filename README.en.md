# Midi Stagehand Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-green.svg)](https://nodejs.org/)
[![Tests: 698](https://img.shields.io/badge/Tests-698-brightgreen.svg)](#development)
[![Skills: 2](https://img.shields.io/badge/Claude%20Code%20Skills-2-purple.svg)](#install-as-skills)

> AI-powered low-code browser automation via natural language.
> Two Claude Code Skills: **YAML Generator** + **Runner**.

**[简体中文](README.md)** | English

## Table of Contents

- [What Is This](#what-is-this)
- [Quick Start](#quick-start)
- [Install as Skills](#install-as-skills)
- [Using Skills](#using-skills)
- [How It Works](#how-it-works)
- [Two Modes](#two-modes)
- [Features](#features)
- [Model Configuration](#model-configuration)
- [CLI Reference](#cli-reference)
- [Templates](#templates)
- [FAQ](#faq)
- [Known Limitations](#known-limitations)
- [Documentation](#documentation)
- [Development](#development)
- [License](#license)

## What Is This

Midi Stagehand Skill is a **Midscene YAML superset ecosystem** that turns natural language into executable browser automation. It ships as **two Claude Code Skills** — a Generator that converts requirements into YAML, and a Runner that validates, executes, and reports results.

```
Natural Language → YAML (Native / Extended) → Detect → Execute → Report
```

Supports **Web**, **Android**, **iOS**, and **Computer** platforms.

## Quick Start

### 1. Generate YAML with Natural Language

Describe your automation needs directly in Claude Code:

```
You: "Write an automation script to open Google, search for Midscene, and screenshot the results"
```

The Generator automatically picks the right mode and template, outputting YAML to `./midscene-output/`.

### 2. Execute YAML

```
You: "Run midscene-output/search-google.yaml"
```

The Runner validates, executes, and interprets the report.

### 3. Or Run Templates Directly via CLI

```bash
# Validate a template
node scripts/midscene-run.js templates/native/web-basic.yaml --dry-run

# Execute a template
node scripts/midscene-run.js templates/native/web-search.yaml
```

## Install as Skills

### Prerequisites

- **Node.js >= 22** and **npm**
- **Chrome** browser (for web automation)
- An AI coding agent: **Claude Code**, Trae, Qoder, Cursor, Cline, etc.

### From GitHub (recommended)

```bash
# Install both skills globally
npx skills add https://github.com/lee-117/midi-stagehand-skill -a claude-code -y -g

# Other agents
npx skills add https://github.com/lee-117/midi-stagehand-skill -a trae -y -g
npx skills add https://github.com/lee-117/midi-stagehand-skill -a qoder -y -g
```

### Install a single skill

```bash
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-yaml-generator -a claude-code -y -g
npx skills add https://github.com/lee-117/midi-stagehand-skill --skill midscene-runner -a claude-code -y -g
```

### From Gitee (clone first)

```bash
git clone https://gitee.com/lee-zh/midi-stagehand-skill.git
npx skills add ./midi-stagehand-skill -a claude-code -y -g
```

After installation, verify it was successful:

```bash
npx skills list
```

### Update / Uninstall

```bash
# Check for updates
npx skills check

# Update all installed skills
npx skills update

# Remove a specific skill
npx skills remove midscene-yaml-generator
npx skills remove midscene-runner
```

## Using Skills

### YAML Generator

The Generator triggers automatically when you describe browser automation needs in Claude Code.

Example trigger phrases:
- "Write an automation script to test the login flow"
- "Generate a YAML to open Amazon, search for phones, and extract prices"
- "Create an automation workflow that loops through pages to collect data"

### YAML Runner

The Runner triggers automatically when you need to run or validate a YAML file.

Example trigger phrases:
- "Run midscene-output/login-test.yaml"
- "Dry-run validate this YAML"
- "Execute templates/native/web-search.yaml and analyze the report"

### Typical Workflow

```
Describe needs → [Generator] output YAML → [Runner --dry-run] validate → [Runner] execute → view report
```

## How It Works

### YAML Generator — Natural Language to YAML

When you describe a browser automation task, the Generator will:

- Analyze complexity and choose **Native** or **Extended** mode
- Determine target platform (Web / Android / iOS / Computer)
- Map natural language to YAML actions using 31 built-in templates
- Auto-validate and output to `./midscene-output/`

### YAML Runner — Execute and Report

When you need to run a YAML file, the Runner will:

- Check the runtime environment (Node.js, dependencies, browser)
- Locate and pre-validate the YAML file
- Execute and analyze results
- Parse the Midscene report with actionable fix suggestions

### End-to-End Workflow

```
You: "Write an automation script to open Google and search for Midscene"
  ↓ [Generator]
Output: midscene-output/search-google.yaml
  ↓ [Runner --dry-run]
Validate: passed
  ↓ [Runner]
Execute: open browser → type query → click search
  ↓
Report: midscene-report/ (HTML + JSON)
```

## Two Modes

| Dimension | **Native** | **Extended** |
|-----------|-----------|-------------|
| **Use case** | Page interactions, data extraction, simple assertions | Conditional logic, loops, API calls, error handling |
| **Execution** | `@midscene/web` runs YAML directly | Transpile to TypeScript, then execute |
| **Declaration** | Default mode, no declaration needed | Requires `engine: extended` |
| **Learning curve** | Low — just learn AI action keywords | Medium — requires variables, logic, loops concepts |
| **When to choose** | Most UI automation and testing scenarios | Complex workflows needing programming logic |
| **Examples** | Login, search, screenshot, data extraction | Paginated scraping, conditional approval, API integration tests |

Extended mode is auto-detected when YAML contains: `variables`, `logic`, `loop`, `import`, `use`, `data_transform`, `try/catch`, `external_call`, or `parallel`.

## Features

- **Write automation in natural language** — describe what you need, get YAML generated automatically
- **Full platform coverage** — Web, Android, iOS, Computer with unified YAML syntax
- **4-layer validation catches errors early** — syntax → structure → schema → semantic, with security checks (JS injection / SSRF / path traversal) before execution
- **31 templates ready to use** — 19 Native + 12 Extended, covering login, search, data collection, API testing, and more
- **Smart AI operations** — 11 interaction actions + 6 data extractors + 2 assertions, locate elements with natural language
- **Complex logic support** — conditional branches, loops, sub-flow reuse, parallel execution, error handling via Extended mode
- **CLI toolchain** — `--dry-run` pre-validation, `--retry` for flaky tests, glob batch execution, 13-category error auto-classification with fix suggestions
- **Security by design** — `execFileSync` prevents command injection, UUID-isolated temp files, path traversal detection
- **698 tests for reliability** — full coverage across detector / validator / transpiler / CLI / runner / report-parser

## Model Configuration

Midscene requires a vision-language model for AI operations. Set these environment variables before execution:

| Variable | Description | Example |
|----------|-------------|---------|
| `MIDSCENE_MODEL_BASE_URL` | Model API endpoint | `https://api.openai.com/v1` |
| `MIDSCENE_MODEL_API_KEY` | API key | `sk-xxxxxxxx` |
| `MIDSCENE_MODEL_NAME` | Model name | `gpt-4o` |

Create a `.env` file in the project root:

```env
MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1
MIDSCENE_MODEL_API_KEY=sk-your-key
MIDSCENE_MODEL_NAME=gpt-4o
```

Any OpenAI-compatible vision model works. See the [progressive guide](guide/MIDSCENE_YAML_GUIDE.md) for more providers and advanced config.

## CLI Reference

```
node scripts/midscene-run.js <yaml-file|glob> [options]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Validate and transpile only, do not execute |
| `--output-ts <path>` | Save transpiled TypeScript to file |
| `--report-dir <path>` | Custom report output directory |
| `--template puppeteer\|playwright` | TS template engine (default: puppeteer) |
| `--timeout <ms>` | Execution timeout (includes browser startup, min 60000 recommended) |
| `--retry <count>` | Retry failed executions for flaky scenarios (default: 0) |
| `--clean` | Clean stale temp files from `.midscene-tmp/` (>24h old) |
| `--verbose`, `-v` | Verbose output (error classification, duration) |
| `--version`, `-V` | Show version |
| `--help`, `-h` | Show help |

Supports glob patterns for batch execution:

```bash
node scripts/midscene-run.js "tests/**/*.yaml"
```

## Templates

31 built-in templates (19 Native + 12 Extended) covering common automation scenarios:

- **Native**: web basics, login, search, data extraction, file upload, file download, multi-tab, deep-think locator, bridge mode, cookie session, local serve, long press, Android, Android system buttons, Android advanced config, iOS, iOS system buttons, Computer, Computer headless
- **Extended**: conditional flows, pagination loops, retry logic, sub-flow reuse, API integration, API CRUD test, data pipelines, auth flows, responsive testing, e2e workflows, data-driven testing, i18n testing

Browse all templates in [`templates/`](templates/).

## FAQ

| Problem | Solution |
|---------|----------|
| API Key error `401 Unauthorized` | Check `MIDSCENE_MODEL_API_KEY` in `.env` is correct and the model service is accessible |
| Chrome browser not found | Install Chrome or Chromium, or set `MIDSCENE_CHROME_PATH` env variable to the browser path |
| Element timeout `element_not_found` | Increase `timeout`, use a more precise natural language description, or enable `deepThink: true` |
| Extended mode not working | Verify `engine: extended` is declared at the top of the YAML file |
| File too large to execute | YAML files have a size limit; split into smaller files or use `import` to reference sub-flows |

For more, see the [Guide FAQ](guide/MIDSCENE_YAML_GUIDE.md#附录-d-常见问题-faq).

## Known Limitations

- **Chromium-only for web** — Web automation relies on Puppeteer/Playwright; Firefox and Safari are not supported
- **Requires a vision-language model** — AI operations (`aiTap`, `aiQuery`, etc.) need a configured and accessible vision model API
- **No programming logic in Native mode** — Conditionals, loops, and variables require Extended mode
- **Mobile requires additional setup** — Android needs ADB and a device/emulator; iOS needs WebDriverAgent
- **Limited cross-task data passing** — Variables cannot be shared between tasks in Native mode; use Extended mode instead

## Documentation

- **[Progressive Guide (L1-L5)](guide/MIDSCENE_YAML_GUIDE.md)** — comprehensive tutorial from beginner to advanced
- **[Skills CLI](https://github.com/vercel-labs/skills)** — install, update, and manage skills

## Development

```bash
npm install          # Install dependencies
npm test             # Run 698 tests
npm run test:coverage # Tests with coverage report
npm run lint         # ESLint check
```

```
src/
  detector/       Mode detector (native vs extended)
  validator/      4-layer YAML validation
  transpiler/     YAML → TypeScript transpiler + 10 generators
  runner/         Native runner + TS runner + report parser
scripts/          CLI entry point
schema/           Keyword schemas + JSON Schema
templates/        31 YAML templates
skills/           Claude Code Skill definitions
```

## License

[MIT](LICENSE) - lee-117
