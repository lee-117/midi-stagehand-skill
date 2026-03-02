# Changelog

## [6.0.0] — 2026-03-02

### Multi-Role Analysis
- 10-role deep review: Prompt Engineer, Domain Expert, QA Engineer, Integration Tester, Tech Writer, UX Designer, Security Engineer, DevOps/SRE, Schema Analyst, Systems Architect
- 175 findings deduplicated to 49 actionable items across 7 phases

### Phase 1: Factual Error Fixes (P0)
- Fixed `aiWaitFor` timeout default: `15000ms` → `30000ms` (2 places in Generator SKILL.md)
- Fixed `screenshotShrinkFactor` description: `0-1 fraction` → `divisor (1-3, default 1)`
- Added 6 V5.0 templates to Generator SKILL.md list and decision table
- Fixed `runWdaRequest` key in `ios-system-buttons.yaml`: `endpoint:` → `url:`
- Added `null` type to `variables` definition in JSON Schema
- Marked `aiAction` as deprecated alias in Generator SKILL.md

### Phase 2: API Alignment & Feature Completion (P1)
- Added `fileChooserAccept` to `aiTap` documentation
- Added Swipe gesture mapping row to Generator SKILL.md
- Added `deepLocate` option documentation
- Expanded platform config descriptions (Android, iOS, Computer)
- Added `data:`/`file:` import support documentation
- Added per-intent model separation explanation

### Phase 3: Security Hardening (P1)
- **Validator**: `javascript:` step suspicious pattern detection (eval, Function, execSync)
- **Validator**: Dangerous ADB command detection for `runAdbShell` (rm -rf, dd if=, reboot, pm uninstall/clear)
- **Validator**: Path traversal check on `output.filePath`
- **Validator**: SSRF internal URL detection for `external_call` (localhost, 127.x, 10.x, 192.168.x, 169.254.169.254)
- **Validator**: `acceptInsecureCerts: true` security warning
- **Validator**: Extended variable collection for `aiBoolean`/`aiNumber`/`aiString`/`aiAsk`/`aiLocate` name fields
- **Validator**: `javascript` step `name`/`output` variable recognition
- Added "安全注意事项" section to Generator SKILL.md
- Added "执行安全" section to Runner SKILL.md

### Phase 4: Documentation Structure (P2)
- Added "职责范围" (responsibility scope) section to both Skills
- Added `[HELP_NEEDED]` format help request template to Generator SKILL.md
- Added workflow overview ASCII diagram to Runner SKILL.md
- Renamed "第0步" to "前置条件" in Runner SKILL.md
- Enhanced ESCALATE format with `ERROR_MSG` and `REPORT_PATH` fields
- Added 4 error decision tree branches (Chrome, network, rate limit, disk)

### Phase 5: QA & Robustness (P2)
- Added anti-pattern #6: unquoted template variables
- Added semantic protection rule for auto-fix operations

### Phase 6: Best Practices & UX (P3)
- Added `cacheable` explanation to `aiTap` documentation
- Upgraded `--dry-run` warning to CRITICAL format in both Skills
- Added "Native 动作快速参考" table to Runner SKILL.md
- Added `[RESULT]` format success output template to Runner SKILL.md

### Phase 7: Code & Architecture (P3)
- **Report parser**: 5 new error classification categories:
  - `rate_limit` (429, rate limit, too many requests) — recoverable
  - `browser_crash` (target closed, browser crash, session closed, protocol error) — fatal
  - `browser_not_found` (chrome not found, browser not found, ENOENT chrome) — fatal
  - `network_failure` (ERR_INTERNET_DISCONNECTED, ECONNRESET, ECONNREFUSED, ERR_NETWORK_CHANGED) — fatal
  - `disk_full` (ENOSPC, no space left, disk full) — fatal

### Tests
- 698 tests (maintained from V5.0.0, all passing with new validator checks backward-compatible)

## [5.0.0] — 2026-03-02

### Schema & API Alignment
- Updated `imeStrategy` enum: replaced `adbBroadcast`/`adbInput` with `always-yadb` (official API parity)
- Added `forceSameTabNavigation`, `unstableLogContent` to `native-keywords.json` allKeywords
- Added `output` to taskStructure keywords
- Fixed `aiDragAndDrop` schema: added missing `deepThink`, `xpath`, `timeout`, `cacheable` properties
- Fixed `aiInput` mode enum: removed unofficial `append` value
- Added nested object format support for `aiLongPress` in JSON Schema
- Removed `append` from `aiInput` mode enum (not in official API)

### Generator SKILL.md Improvements
- Fixed contradictory `ai:` vs specific actions guidance — now scenario-based table
- Added `logic.if` condition format guide (natural language vs JavaScript)
- Added Extended mode YAML structure specification section
- Added missing web config fields (`enableTouchEventsInActionSpace`, `forceChromeSelectRendering`, `unstableLogContent`)
- Added CAPTCHA/bot-detection guidance for Web platform
- Deduplicated self-check checklists (single authoritative checklist)
- Clarified `features` field: optional in schema but strongly recommended
- Fixed anti-pattern #3: `steps:` → `flow:` in examples
- Made `argument-hint` bilingual

### Runner SKILL.md Improvements
- Unified error display: suggestions always shown (not just in `--verbose`)
- Added iframe/shadow DOM debugging guidance
- Added success summary with elapsed time

### Code Optimizations
- `detect()` now accepts pre-parsed YAML objects (avoids 3-5x redundant parsing)
- `findSystemChrome()` memoized (eliminates repeated filesystem checks)
- Retry loop adds 2-second delay between attempts
- Output path traversal validation for `--output-ts` and `--report-dir`
- ENV references (`${ENV:xxx}`) in platform config no longer trigger extended mode detection
- `while` loop without `maxIterations` upgraded from warning to error
- Transpiler warnings displayed with `[WARN]` prefix

### Transpiler
- `extractAgentConfig` now includes `outputFormat` and `modelConfig` fields

### Validator
- Added `aiInput` missing `value` warning (most common user mistake)
- Updated `imeStrategy` enum to `always-yadb`/`yadb-for-non-ascii`

### Templates (31 total: 19 native + 12 extended)
- **6 new templates**: `ios-system-buttons`, `android-advanced-config`, `web-file-download`, `computer-headless`, `api-crud-test`, `web-i18n-test`
- Standardized comment headers on all 31 templates
- Fixed language consistency: all templates now use Chinese content
- Fixed `aiAct` → `ai` in `web-file-upload.yaml`

### Tests
- 698 tests (up from 678)
- New tests: pre-parsed object detection, ENV exclusion, aiInput value warning, agent config fields, Chrome memoization

## [4.0.0] - 2026-03-02

### Schema & API Alignment
- Added `aiAction` alias to native-keywords.json (official API parity)
- Added `yadb-for-non-ascii` to `imeStrategy` enum (official API default)
- Fixed `importDirective` JSON Schema structure (flow/data/file keys)
- Fixed duplicate `unstableLogContent` in webPlatform schema
- Extended `sleep` schema to accept template variable strings
- Added `computer.headless` to schema and validator
- Added `aiActionAction` flow step type to JSON Schema

### Generator SKILL.md
- Fixed CRITICAL `then:` format in Extended golden path (bare array, not flow wrapper)
- Added 3 missing V3.0.0 templates to template list and decision table
- Unified `steps:` → `flow:` in all examples
- Added `aiAction` alias, `prompt:` field docs, best practices section
- Removed non-official `append` mode from aiInput
- Added `domIncluded: 'visible-only'`, `MIDSCENE_RUN_DIR`, model prefixes

### Runner SKILL.md
- Fixed `--verbose` description (error classification shown by default)
- Added `--version`/`-V` to options list
- Added official Midscene CLI complete flags reference
- Added advanced env vars (MIDSCENE_RUN_DIR, DEBUG, model prefixes)
- Added Node >= 22 batch execution note

### Code Quality
- Deduplicated `findSystemChrome()` in setup.js (imports from runner-utils)
- Replaced `execSync` with `execFileSync` in setup.js pingRegistry
- Centralized `MAX_WALK_DEPTH` in constants.js
- Report parser now reads subdirectories recursively
- Added `--output-ts` path validation (.ts extension required)

### Guide
- Fixed L2 action numbering (sequential 1-14)
- Added `domIncluded: 'visible-only'` documentation
- Added `computer.headless` to platform config
- Marked `append` mode as non-official
- Added Recipe 11: CI environment configuration
- Unified `steps:` → `flow:` throughout (13 locations)

### Tests
- 678 tests (was 663, +15 new)
- Template exact count assertions (15 native, 10 extended)
- flow/steps alias matrix tests (7 tests)
- imeStrategy yadb-for-non-ascii validation tests
- aiAction keyword detection tests
- --output-ts extension validation test
- MAX_WALK_DEPTH constant export test

## [3.0.0] - 2026-03-02

### Added

- **`aiLongPress` action**: Long-press with optional `duration` parameter (milliseconds)
- **Android system buttons**: `AndroidBackButton`, `AndroidHomeButton`, `AndroidRecentAppsButton`
- **iOS system buttons**: `IOSHomeButton`, `IOSAppSwitcher`
- **Android advanced config**: `keyboardDismissStrategy` (`esc-first`|`back-first`), `imeStrategy` (`adbBroadcast`|`adbInput`), `scrcpyConfig` object
- **Computer config**: `xvfbResolution` (format `WIDTHxHEIGHTxDEPTH`)
- **Agent config**: `modelConfig` per-agent model override object, `outputFormat` (`single-html`|`html-and-external-assets`)
- **Validator**: 7 new validations (keyboardDismissStrategy enum, imeStrategy enum, scrcpyConfig object, xvfbResolution format, outputFormat enum, modelConfig object, cache.id warning)
- **3 new templates**: `web-long-press.yaml`, `android-system-buttons.yaml`, `data-driven-test.yaml`
- **Generator SKILL.md rewrite**: persona, anti-pattern reminders, Extended golden path, new actions/config, auto-fix limit, clarification heuristic
- **Runner SKILL.md rewrite**: persona, dry-run warning, health-check matrix, auto-fix guardrails, common pitfalls, collaboration protocol
- **Guide updates**: L2 new actions, L3 new config, Appendix G cookbook (10 recipes), L2-L5 troubleshooting tables
- **31 new tests** (632 → 663)

### Changed

- **CLI default failure display**: Failed task details and error classification shown by default (no longer requires `--verbose`)
- **native-runner**: Added `MAX_FILE_SIZE` file size check before execution
- **setup.js / health-check.js**: Replaced `execSync` with `execFileSync` for security
- **4 template fixes**: `viewportHeight` → 960, added `engine: native` where missing

## [2.1.0] - 2026-03-01

### Added

- **`viewportHeight` default**: Changed from 720 to 960 to match official API
- **New actions**: `freezePageContext`, `unfreezePageContext` as native actions
- **`outputFormat`**: `single-html` | `html-and-external-assets` for agent config
- **iOS validation**: `wdaPort`, `wdaHost`, `autoDismissKeyboard`, `launch`, `output`, `unstableLogContent`
- **Computer validation**: `displayId`, `launch`, `output`, `xvfbResolution`
- **`cache.id` warning**: Warns when `cache.strategy` is set but `cache.id` is missing
- **CLI enhancements**: `--template` validation (`puppeteer`|`playwright`), glob error handling, verbose/dry-run output improvements
- **3 new test files**: cli, integration-skills, health-check
- **84 new tests** (548 → 632)

### Changed

- **`deepLocate` removed**: Not part of official Midscene API
- **Agent config expanded**: Added `extractAgentConfig` with 2 additional fields

## [2.0.0] - 2026-03-01

### Added

- **Agent config support**: `replanningCycleLimit`, `aiActContext`, `screenshotShrinkFactor`, `waitAfterAction` fields
- **Cache object format**: `{ strategy: 'read-write'|'read-only'|'write-only', id: string }` in addition to `cache: true`
- **Bridge mode validation**: `bridgeMode: 'newTabWithUrl'|'currentTab'|false` in web config
- **CLI `--retry <count>`**: Retry failed executions for flaky scenarios
- **CLI `--clean`**: Remove stale temp files (>24h) from `.midscene-tmp/`
- **Error classification**: 8-category error classifier (`api_key`, `timeout`, `element_not_found`, `assertion`, `navigation`, `transpiler`, `permission`, `javascript`) with severity levels
- **Report parser enhancement**: Detailed extraction of `failedTasks`, `taskDetails`, `aiQueryResults`, `totalDuration`, `htmlReports`
- **Expanded Chrome detection**: Chromium, Edge on Windows; Chromium.app on macOS; `/snap/bin/chromium` + `which google-chrome` on Linux
- **Shared constants module** (`src/constants.js`): Centralized `MAX_FILE_SIZE`, `DEFAULT_TIMEOUT`, `DEFAULT_REPORT_DIR`, `DEFAULT_OUTPUT_DIR`, `MIDSCENE_TMP_DIR`, `MAX_IMPORT_DEPTH`, `MIDSCENE_PKG`, `STALE_TEMP_THRESHOLD_MS`, `MAX_ERROR_MESSAGE_LENGTH`
- **3 new templates**: `web-bridge-mode.yaml`, `web-cookie-session.yaml`, `web-local-serve.yaml`
- **Schema updates**: `screenshotShrinkFactor`, `waitAfterAction` in agentConfig; agent config validation; cache strategy validation; bridgeMode validation
- **59 new tests** (486 -> 548): classifyError, detailed report extraction, agent config validation, cache strategy, bridgeMode, Chrome detection, --retry/--clean parsing
- **Generator SKILL.md**: scrollType enum, aiAct alias, aiInput mode clarification, aiWaitFor defaults, cache object format, fileChooserAccept, agent config section, handoff protocol
- **Runner SKILL.md**: expanded Chrome detection docs, --retry/--clean options, agent config section

### Changed

- **CLI quick-fix hints**: Expanded from 3 to 7 error patterns (+ api_key, timeout, element_not_found, permission)
- **Error truncation**: Long error messages capped at 500 characters in CLI output
- **Verbose output**: Subprocess output delimited with visual separators; error classification shown in verbose mode
- **Dry-run warning**: Explicit warning when YAML validation passes but js-yaml cannot parse (non-standard constructs)

### Fixed

- Eliminated duplicated constants across `mode-detector.js`, `native-runner.js`, `ts-runner.js`, `midscene-run.js`, `yaml-validator.js`

## [1.0.0] - 2025-12-01

Initial release with Native and Extended mode support, 19 templates, 486 tests.
