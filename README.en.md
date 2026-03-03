# Midi Stagehand Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/Node-%3E%3D22-green.svg)](https://nodejs.org/)
[![CI](https://github.com/lee-117/midi-stagehand-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/lee-117/midi-stagehand-skill/actions/workflows/ci.yml)
[![AI Agent Skills: 2](https://img.shields.io/badge/AI%20Agent%20Skills-2-purple.svg)](#install-as-skills)

> AI-powered low-code browser automation — describe what you need, generate YAML, execute in one step.

**[简体中文](README.md)** | English

## What Is This

Midi Stagehand Skill is a **Midscene YAML superset ecosystem** that turns natural language into executable browser automation. It ships as **two AI Agent Skills** — a Generator that converts requirements into YAML, and a Runner that validates, executes, and reports results.

Supports **Web**, **Android**, **iOS**, and **Computer** platforms.

## Quick Start

### Prerequisites

- **Node.js >= 22** and **npm**
- **Chrome** browser (for web automation)
- An AI coding agent (see [compatibility table](#install-as-skills))

### Install as Skills

```bash
# Install both skills to the current project (Qoder example)
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git -a qoder -y
```

> **Global install (optional)**: Add the `-g` flag to install skills globally, shared across all projects:
> ```bash
> npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git -a qoder -y -g
> ```

Supported AI Agents:

| Agent | Install Flag |
|-------|-------------|
| **Claude Code** | `-a claude-code` |
| **Trae** | `-a trae` |
| **Trae CN** | `-a trae-cn` |
| **Qoder** | `-a qoder` |
| **Cursor** | `-a cursor` |
| **Cline** | `-a cline` |

Install a single skill:

```bash
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git --skill midscene-yaml-generator -a qoder -y
npx skills add https://gitee.com/lee-zh/midi-stagehand-skill.git --skill midscene-runner -a qoder -y
```

Verify installation: `npx skills list`

### 30-Second Experience

**1. Generate YAML with Natural Language**

Describe your automation needs directly in your AI Agent:

```
You: "Write an automation script to open Google, search for Midscene, and screenshot the results"
```

The Generator will output YAML like this to `./midscene-output/`:

```yaml
web:
  url: "https://www.google.com"

tasks:
  - name: "Search Midscene"
    flow:
      - aiInput: "search box"
        value: "Midscene"
      - aiTap: "Google Search"
      - aiWaitFor: "search results loaded"
      - recordToReport: "search results screenshot"
```

**2. Execute YAML**

```
You: "Run midscene-output/search-google.yaml"
```

The Runner validates, executes, and interprets the report.

**3. Or use the CLI directly**

```bash
node scripts/midscene-run.js templates/native/web-basic.yaml --dry-run   # validate only
node scripts/midscene-run.js templates/native/web-search.yaml            # execute
```

### Update / Uninstall

```bash
npx skills check          # check for updates
npx skills update          # update all skills
npx skills remove midscene-yaml-generator   # uninstall
npx skills remove midscene-runner
```

## Using Skills

### YAML Generator

The Generator triggers automatically when you describe browser automation needs in your AI Agent.

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

### Workflow

```
Describe needs → [Generator] output YAML → [Runner --dry-run] validate → [Runner] execute → view report
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

- **Natural language driven** — describe what you need, get executable YAML
- **Unified across platforms** — Web, Android, iOS, Computer share the same YAML syntax
- **Pre-execution validation** — multi-layer checks + security detection catch errors before running
- **Rich templates** — covering login, search, data collection, API testing, and more
- **Smart AI operations** — locate and interact with page elements using natural language
- **Complex logic support** — conditional branches, loops, sub-flow reuse, parallel execution, error handling
- **CLI toolchain** — pre-validation, retry, batch execution, automatic error classification with fix suggestions

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
| `--template puppeteer\|playwright` | TS template engine (default: playwright) |
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

Built-in templates covering common automation scenarios:

- **Native**: web basics, login, search, data extraction, file upload/download, multi-tab, mobile (Android / iOS), Computer, and more
- **Extended**: conditional flows, pagination loops, retry logic, sub-flow reuse, API integration, data pipelines, auth flows, e2e workflows, and more

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


## Contributing

```bash
npm install              # install dependencies
npm test                 # run tests
npm run test:coverage    # tests with coverage report
```

For detailed project architecture, code conventions, and test structure, see the internal project documentation.

## License

[MIT](LICENSE) - lee-117
