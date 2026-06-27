# SpecShield

**OpenAPI contract testing for CI pipelines.**

```bash
npx specshield check ./openapi.yaml --base-url https://api.example.com/v3
```

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0-brightgreen)](#)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-brightgreen)](#)
[![CI](https://github.com/Llucs/specshield/actions/workflows/test.yml/badge.svg)](https://github.com/Llucs/specshield/actions/workflows/test.yml)

SpecShield validates every endpoint of your API against the responses declared in your OpenAPI specification, in CI or locally. It checks that status codes match, response bodies conform to schemas, and content types align — with no setup beyond a spec file and a base URL.

## Commands

### `check`

Validate that responses from a running API match its OpenAPI spec:

```bash
specshield check ./openapi.yaml --base-url https://api.example.com/v3
```

Output with API Score:

```
SpecShield · OpenAPI Contract Testing
──────────────────────────────────────────────────
  Spec:     Petstore v1.0.7
  Time:    2.3s
  Total:   20 endpoints

  PASS GET    /pet/{petId}                       200  ✓ status ✓ schema ✓ ctype
  PASS POST   /pet                               200  ✓ status ✓ schema ✓ ctype
  FAIL PUT    /pet                               200  ✓ status ✗ schema ✓ ctype
       → body/name: must be string

──────────────────────────────────────────────────
  19 passed | 1 failed
  API Score: 95/100

  ✗ 1 check(s) failed.
```

| Option | Default | Description |
|--------|---------|-------------|
| `-b, --base-url <url>` | spec server URL | Base URL of the API |
| `-H, --header <headers...>` | — | Custom request headers (e.g., `-H "Authorization: Bearer xxx"`) |
| `-t, --timeout <ms>` | 10000 | Request timeout in milliseconds |
| `--skip-methods <methods>` | — | Comma-separated methods to skip (e.g., `post,put,delete`) |
| `--only-methods <methods>` | — | Comma-separated methods to test (e.g., `get,post`) |
| `-p, --param <params...>` | — | Additional parameters as key=value (e.g., `-p petId=42`) |
| `--verbose` | false | Show detailed output for all checks |
| `--no-color` | false | Disable colored output |
| `--report <format>` | `text` | Output format: `text`, `json`, `junit`, `html`, `sarif` |
| `--parallel <number>` | `5` | Number of parallel requests |
| `--config <path>` | — | Path to `specshield.yaml` config file |
| `--baseline <path>` | — | Path to baseline file for ignoring known failures |
| `--update-baseline <path>` | — | Update baseline file with current results |
| `--watch` | false | Watch spec file for changes and re-run checks |
| `--github-annotations` | false | Output GitHub Actions annotations |
| `--validate-spec` | false | Run spec validations (warnings/errors) |

### `validate`

Validate an OpenAPI spec file for common issues:

```bash
specshield validate ./openapi.yaml
```

Detected issues:
- Paths with no operations
- Operations with no responses defined
- Unusual HTTP status codes
- Duplicate operationIds
- Duplicate parameter names
- Deprecated endpoints

### `diff`

Detect breaking changes between two versions of an OpenAPI spec:

```bash
specshield diff ./spec-v1.yaml ./spec-v2.yaml
```

```
SpecShield · OpenAPI Diff
──────────────────────────────────────────────────
  Old:   API v1.0.0
  New:   API v2.0.0

  BREAKING CHANGES (1)

  ✗ POST   /users                    Request body: required property "email" added

  NON-BREAKING CHANGES (1)

  + GET    /users/{id}/posts         New endpoint added

──────────────────────────────────────────────────
  1 breaking | 1 non-breaking
```

Breaking changes detected:
- Removed endpoints
- Removed response status codes
- Properties removed from response schemas
- New required properties in request bodies
- New required parameters

## Report Formats

```bash
# JSON — machine-readable for dashboards and custom tooling
specshield check ./spec.yaml --base-url http://localhost:3000 --report json

# JUnit XML — integrate with CI pipelines (Jenkins, GitLab, etc.)
specshield check ./spec.yaml --base-url http://localhost:3000 --report junit

# HTML — self-contained report for browsers
specshield check ./spec.yaml --base-url http://localhost:3000 --report html > report.html

# SARIF — static analysis results for GitHub Advanced Security
specshield check ./spec.yaml --base-url http://localhost:3000 --report sarif
```

## Configuration File

SpecShield supports a `specshield.yaml` configuration file:

```yaml
# specshield.yaml
check:
  baseUrl: https://api.example.com/v3
  headers:
    Authorization: Bearer token123
  timeout: 10000
  skipMethods:
    - post
    - put
    - delete
  onlyMethods:
    - get
  params:
    petId: 42
  verbose: false
  report: json
  parallel: 10

baseline: specshield-baseline.json
watch: false
```

Pass it explicitly with `--config` or place it in your project root (auto-detected as `specshield.yaml`, `specshield.yml`, `.specshield.yaml`, or `.specshield.yml`). CLI flags override config file values.

## Baseline

Ignore known failures so they don't block CI:

```bash
# Create baseline from current results
specshield check ./spec.yaml --base-url http://localhost:3000 --update-baseline baseline.json

# Use baseline to ignore known failures
specshield check ./spec.yaml --base-url http://localhost:3000 --baseline baseline.json
```

This is useful when you have pre-existing failures that you plan to fix later without blocking deployments.

## GitHub Actions

SpecShield has an official GitHub Action:

```yaml
- uses: Llucs/specshield@v0
  with:
    spec: ./openapi.yaml
    base-url: https://api.example.com/v3
    only-methods: get
    report: text
```

It also supports PR annotations via `--github-annotations`:

```bash
specshield check ./spec.yaml --base-url http://localhost:3000 --github-annotations
```

This outputs GitHub Actions workflow commands that create annotations on the file in PRs.

## Watch Mode

Re-run checks automatically when the spec file changes:

```bash
specshield check ./spec.yaml --base-url http://localhost:3000 --watch
```

## Parallel Execution

Endpoints are tested concurrently (default 5 parallel requests):

```bash
specshield check ./spec.yaml --base-url http://localhost:3000 --parallel 20
```

## API Score

Each check run produces an API Score (0–100) based on:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Status codes | 40% | Response status matches spec |
| Schema validation | 35% | Response body conforms to JSON Schema |
| Content-Type | 15% | Content-Type header matches spec |
| Documentation | 10% | Endpoints have descriptions |

## Use Cases

- **CI pipelines** — validate every deployment against its spec, exit code 1 on failure
- **Contract monitoring** — periodically check production APIs for drift
- **API migrations** — use `diff` to catch breaking changes before they ship
- **Onboarding** — quickly understand if an unfamiliar API matches its documentation

## Examples

```bash
# Basic check
specshield check ./openapi.json --base-url https://api.example.com

# Only GET endpoints, with auth
specshield check ./spec.yaml --base-url http://localhost:8080 \
  -H "Authorization: Bearer token123" \
  --only-methods get

# Skip state-modifying methods
specshield check ./petstore.yaml --base-url https://petstore3.swagger.io/api/v3 \
  --skip-methods post,put,patch,delete

# Override path parameters
specshield check ./spec.json --base-url http://localhost:3000 \
  -p userId=42 -p status=active

# Breaking change detection in CI
specshield diff ./main-branch-spec.yaml ./pr-spec.yaml

# With config file
specshield check ./spec.yaml --config specshield.yaml

# With baseline
specshield check ./spec.yaml --base-url http://localhost:3000 \
  --baseline baseline.json

# Validate spec quality
specshield validate ./openapi.yaml

# HTML report
specshield check ./spec.yaml --base-url http://localhost:3000 \
  --report html > report.html

# SARIF report
specshield check ./spec.yaml --base-url http://localhost:3000 \
  --report sarif

# GitHub Actions annotations
specshield check ./spec.yaml --base-url http://localhost:3000 \
  --github-annotations

# JUnit report for GitLab CI
specshield check ./spec.yaml --base-url http://localhost:3000 \
  --report junit > report.xml
```

## Installation

```bash
npm install -g specshield
```

Or run without installation:

```bash
npx specshield check ./spec.yaml --base-url http://localhost:3000
```

## Why SpecShield

SpecShield complements existing API tools by focusing on automated OpenAPI contract validation for CI pipelines. It provides a lightweight CLI experience with zero configuration — no GUI, no accounts, no complex setup.

## License

MIT © Llucs
