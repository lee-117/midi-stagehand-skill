# Changelog

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
