# Midscene YAML Templates

22 ready-to-use templates covering common browser automation scenarios.

## Native Templates (13)

Direct execution, no transpilation needed.

| Template | Use Case |
|----------|----------|
| `native/web-basic.yaml` | Simple page navigation, clicks, and inputs |
| `native/web-login.yaml` | Login form with credentials |
| `native/web-search.yaml` | Search input and result verification |
| `native/web-data-extract.yaml` | Extract structured data with aiQuery |
| `native/web-file-upload.yaml` | File upload via fileChooserAccept |
| `native/web-multi-tab.yaml` | Multi-tab navigation and operations |
| `native/web-bridge-mode.yaml` | Connect to an already-running browser |
| `native/web-cookie-session.yaml` | Session restore via cookie file |
| `native/web-local-serve.yaml` | Test local static files with built-in server |
| `native/deep-think-locator.yaml` | Complex element location with deepThink/xpath |
| `native/android-app.yaml` | Android app testing via ADB |
| `native/ios-app.yaml` | iOS app testing via WebDriverAgent |
| `native/computer-desktop.yaml` | Desktop application automation |

## Extended Templates (9)

Require `engine: extended`, transpiled to TypeScript before execution.

| Template | Use Case |
|----------|----------|
| `extended/web-conditional-flow.yaml` | If/else branching based on page state |
| `extended/web-pagination-loop.yaml` | Loop through paginated content |
| `extended/web-data-pipeline.yaml` | Filter, sort, transform extracted data |
| `extended/multi-step-with-retry.yaml` | Try/catch with retry logic |
| `extended/api-integration-test.yaml` | External HTTP API calls |
| `extended/e2e-workflow.yaml` | Full end-to-end workflow with variables |
| `extended/reusable-sub-flows.yaml` | Modular sub-flow import and reuse |
| `extended/responsive-test.yaml` | Multi-viewport responsive testing |
| `extended/web-auth-flow.yaml` | OAuth/login flow with env variables |

## Usage

```bash
# Dry-run a template
node scripts/midscene-run.js templates/native/web-basic.yaml --dry-run

# Execute a template
node scripts/midscene-run.js templates/native/web-basic.yaml

# Use as starting point
cp templates/native/web-login.yaml ./midscene-output/my-login.yaml
```
