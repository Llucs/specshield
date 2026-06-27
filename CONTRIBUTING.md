# Contributing

This document contains the rules and conventions for contributing to SpecShield. Both human contributors and AI agents must follow them.

## Versioning

- This project follows **Semantic Versioning** (`major.minor.patch`)
- Bump the version in these three files on every change:
  - `package.json`
  - `src/cli.ts` (`.version()` call)
  - `src/reporters/json.ts` (JSON report `version` field)
- Version bump rules:
  - **patch** (0.0.x): bug fixes, documentation, refactoring with no API/feature changes
  - **minor** (0.x.0): new features, new commands, new options (backward compatible)
  - **major** (x.0.0): breaking changes in CLI, output format, or core behavior
- The version in `package.json`, `cli.ts`, and `json.ts` must always match
- Never commit without bumping the version first

## Before Every Commit

Run these checks and fix any issue before staging:

```bash
npm run build
```

- Must compile with **zero errors, zero warnings**. `tsc` must produce no output.
- Do not commit if TypeScript produces any diagnostic output.

```bash
node dist/cli.js --version
```

- Verify the version matches what you set.

```bash
node dist/cli.js check --help
node dist/cli.js diff --help
node dist/cli.js validate --help
```

- Verify all commands and options display correctly.

```bash
node dist/cli.js diff /tmp/spec-old.yaml /tmp/spec-new.yaml
```

- Run diff against known test specs and verify output is correct.

```bash
node dist/cli.js check /tmp/petstore.yaml --base-url https://petstore3.swagger.io/api/v3 --only-methods get --report json | python3 -c "import json,sys; json.load(sys.stdin)"
```

- Verify JSON report output is valid JSON.

## Code Standards

- **Language**: TypeScript with strict mode enabled
- **Module system**: ESM (`"type": "module"` in package.json, `NodeNext` module in tsconfig)
- **Comments**: Do not add any. Code must be self-documenting through naming and structure.
- **No placeholders, no simulations, no examples**: Every function, variable, and constant must serve a real purpose. No `TODO`, `FIXME`, `placeholder`, or unused code paths.
- **No unused imports or variables**: TypeScript strict mode catches these. If it compiles, it's clean.
- **Error messages**: Use string concatenation (`'text ' + var`), not template literals with backticks. Exception: multi-line strings where concatenation is impractical.

## Dependencies

- Minimize external dependencies. Every added dependency must justify itself.
- `dependencies`: runtime libraries
- `devDependencies`: build-time and development tools
- Do not add dependencies that duplicate existing functionality
- Prefer standard Node.js APIs over libraries where reasonable

## Git

- **Commit messages**: English, imperative mood, prefixed by type (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Credits**: The author line must contain "By Llucs"
- Do not commit secrets, tokens, or credentials
- Do not commit `node_modules/`, `dist/`, or `*.tsbuildinfo`
- Keep commits focused: one logical change per commit

## Structure

- `src/cli.ts` — CLI entry point and command definitions
- `src/core/` — Core logic modules
  - `spec.ts` — OpenAPI spec loading, parsing, and validation
  - `check.ts` — HTTP checking logic with parallel execution
  - `diff.ts` — Breaking change detection between specs
  - `schema.ts` — JSON Schema normalization
  - `config.ts` — specshield.yaml configuration file loader
  - `baseline.ts` — Baseline support for ignoring known failures
  - `watch.ts` — Watch mode for continuous testing
  - `types.ts` — TypeScript interfaces
- `src/reporters/` — Output formatters
  - `text.ts` — Text/TTY console output
  - `json.ts` — JSON report output
  - `junit.ts` — JUnit XML report output
  - `html.ts` — HTML report output
  - `sarif.ts` — SARIF report output
  - `github.ts` — GitHub Actions annotations
  - `score.ts` — API Score calculation

When adding new functionality, place it in the appropriate existing module. Only create a new file if the new code is conceptually independent from all existing modules.

## Testing

- Test against real APIs. Use the Petstore API as a reference:
  ```bash
  curl -s https://petstore3.swagger.io/api/v3/openapi.yaml -o /tmp/petstore.yaml
  node dist/cli.js check /tmp/petstore.yaml --base-url https://petstore3.swagger.io/api/v3 --only-methods get
  ```
- Test diff with two versions of the same spec:
  ```bash
  node dist/cli.js diff /tmp/spec-old.yaml /tmp/spec-new.yaml
  ```
- After any change to the checking logic, verify with both passing and failing scenarios
- After any change to the diff logic, verify with both identical and divergent specs
- Test all report formats: `text`, `json`, `junit`, `html`, `sarif`
- Test parallel execution: `--parallel 10`
- Test config file: `--config specshield.yaml`
- Test baseline: `--baseline baseline.json`
- Test validate: `validate ./openapi.yaml`

## CLI Conventions

- Command names: lowercase, single word (`check`, `diff`, `validate`)
- Option names: `--kebab-case` with single-dash short form where intuitive
- Arguments: required arguments before options
- Default values should be sensible for CI usage (timeout, report format, etc.)
- Exit codes: `0` for success, `1` for failure
- Color output: enabled by default, `--no-color` to disable

## Report Formats

- `text` (default): colored console output with API Score
- `json`: structured JSON to stdout
- `junit`: JUnit XML to stdout
- `html`: self-contained HTML report to stdout
- `sarif`: SARIF JSON to stdout
- When adding a new report format, register it in the CLI `--report` option validation and implement both the formatter function and the dispatch in the `check` command action

## AI Agent Rules

AI agents contributing to this repository must:
1. Read this file before making any changes
2. Run `npm run build` after any code change and verify zero errors
3. Bump the version in all three locations before committing
4. Test all affected commands before committing
5. Never generate placeholder code, "TODO" comments, or simulated implementations
6. Never remove existing functionality unless explicitly replacing it
7. Check all three version locations match before push
8. Include "By Llucs" in the commit body
