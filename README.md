# SpecShield

OpenAPI contract testing tool — validate your API endpoints against your OpenAPI specification automatically.

```bash
npx specshield check ./openapi.yaml --base-url https://api.example.com/v3
```

## Features

- **Status code validation** — ensures every response status matches the spec
- **Response schema validation** — validates response bodies against JSON Schema definitions using AJV
- **Content-Type validation** — checks Content-Type headers against spec declarations
- **Auto-generated parameters** — fills path/query parameters with examples or type-based defaults
- **Safe by default** — clear warnings for state-modifying methods (POST, PUT, PATCH, DELETE)
- **CI-ready** — exits with code 1 on any failure
- **OpenAPI 3.0 & 3.1** — supports JSON and YAML specs

## Installation

```bash
npm install -g specshield
```

Or run directly:

```bash
npx specshield check ./spec.yaml --base-url http://localhost:3000
```

## Usage

```bash
specshield check <spec> --base-url <url> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `spec` | Path or URL to OpenAPI spec file (JSON or YAML) |

### Options

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

### Examples

```bash
# Basic check against production
specshield check ./openapi.json --base-url https://api.example.com

# Check with auth header, skip unsafe methods
specshield check ./spec.yaml --base-url http://localhost:8080 \
  -H "Authorization: Bearer token123" \
  --skip-methods post,put,patch,delete

# Check only GET endpoints
specshield check ./petstore.yaml --base-url https://petstore3.swagger.io/api/v3 \
  --only-methods get \
  --verbose

# Override path parameters
specshield check ./spec.json --base-url http://localhost:3000 \
  -p userId=42 -p status=active
```

## Output

```
SpecShield · OpenAPI Contract Testing
──────────────────────────────────────────────────
  Spec:     Petstore v1.0.7
  Time:    2.3s
  Total:   20 endpoints

  PASS GET    /pet/findByStatus                  200  ✓ status ✓ schema ✓ ctype
  PASS GET    /pet/{petId}                       200  ✓ status ✓ schema ✓ ctype
  PASS POST   /pet                               200  ✓ status ✓ schema ✓ ctype
  FAIL PUT    /pet                               200  ✓ status ✗ schema ✓ ctype
       → body/name: must be string
  PASS DELETE /pet/{petId}                       404  ✓ status --- schema --- ctype

──────────────────────────────────────────────────
  18 passed | 1 failed | 1 skipped

  ✗ 1 check(s) failed.
```

## Why SpecShield?

Postman is proprietary and expensive for teams. Bruno and Hoppscotch are great for manual testing but lack automated contract validation. SpecShield fills the gap: a zero-config CLI that validates every endpoint against its spec in CI, without a GUI or account.

## License

MIT © Llucs
