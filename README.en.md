# Midi Stagehand Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-green.svg)](https://nodejs.org/)
[![Tests: 548](https://img.shields.io/badge/Tests-548-brightgreen.svg)](#development)
[![Skills: 2](https://img.shields.io/badge/Claude%20Code%20Skills-2-purple.svg)](#install-as-skills)

> AI-powered low-code browser automation via natural language.
> Two Claude Code Skills: **YAML Generator** + **Runner**.

**[简体中文](README.md)** | English

## What Is This

Midi Stagehand Skill is a **Midscene YAML superset ecosystem** that turns natural language into executable browser automation. It ships as **two Claude Code Skills** — a Generator that converts requirements into YAML, and a Runner that validates, executes, and reports results.

```
Natural Language → YAML (Native / Extended) → Detect → Execute → Report
```

Supports **Web**, **Android**, **iOS**, and **Computer** platforms.

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

### Update / Uninstall

```bash
# Check for updates
npx skills check

# Update all installed skills
npx skills update

# Remove a specific skill
npx skills remove midscene-yaml-generator
npx skills remove midscene-runner

# List installed skills
npx skills list
```

## How It Works

### YAML Generator — Natural Language to YAML

When you describe a browser automation task, the Generator will:

- Analyze complexity and choose **Native** or **Extended** mode
- Determine target platform (Web / Android / iOS / Computer)
- Map natural language to YAML actions using 22 built-in templates
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

| Mode | Use Case | Execution |
|------|----------|-----------|
| **Native** | Basic actions (tap, input, query, assert, scroll) | `@midscene/web` runs YAML directly |
| **Extended** | Complex logic (conditions, loops, API calls, error handling) | Transpile to TypeScript, then execute |

Extended mode is auto-detected when YAML contains: `variables`, `logic`, `loop`, `import`, `use`, `data_transform`, `try/catch`, `external_call`, or `parallel`.

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

22 built-in templates (13 native + 9 extended) covering common automation scenarios:

- **Native**: web basics, login, search, data extraction, file upload, multi-tab, deep-think locator, bridge mode, cookie session, local serve, Android, iOS, Computer
- **Extended**: conditional flows, pagination loops, retry logic, sub-flow reuse, API integration, data pipelines, auth flows, responsive testing, e2e workflows

Browse all templates in [`templates/`](templates/).

## Documentation

- **[Progressive Guide (L1-L5)](guide/MIDSCENE_YAML_GUIDE.md)** — comprehensive tutorial from beginner to advanced
- **[Skills CLI](https://github.com/vercel-labs/skills)** — install, update, and manage skills

## Development

```bash
npm install          # Install dependencies
npm test             # Run 548 tests
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
templates/        22 YAML templates
skills/           Claude Code Skill definitions
```

## License

[MIT](LICENSE) - lee-117
