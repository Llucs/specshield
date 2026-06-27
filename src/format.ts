import chalk from 'chalk';
import type { CheckEntry } from './types.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function formatMethod(method: string): string {
  return method.padEnd(7);
}

function formatPath(path: string, maxLen: number): string {
  if (path.length > maxLen) {
    return '...' + path.slice(-(maxLen - 3));
  }
  return path.padEnd(maxLen);
}

function methodColor(method: string): (s: string) => string {
  const colors: Record<string, (s: string) => string> = {
    GET: chalk.hex('#61affe'),
    POST: chalk.hex('#49cc90'),
    PUT: chalk.hex('#fca130'),
    PATCH: chalk.hex('#50e3c2'),
    DELETE: chalk.hex('#f93e3e'),
    HEAD: chalk.hex('#9012fe'),
    OPTIONS: chalk.hex('#0d5aa7'),
  };
  return colors[method] || chalk.white;
}

function statusBadge(result: CheckEntry): string {
  if (result.status === 'pass') return chalk.bgGreen.black(' PASS ');
  if (result.status === 'fail') return chalk.bgRed.black(' FAIL ');
  if (result.status === 'skip') return chalk.bgYellow.black(' SKIP ');
  return chalk.bgRed.black(' ERROR ');
}

function statusCodeLabel(result: CheckEntry): string {
  if (result.actualStatus === null) return chalk.dim('---');
  const code = result.actualStatus;
  if (code < 300) return chalk.green(String(code));
  if (code < 400) return chalk.yellow(String(code));
  return chalk.red(String(code));
}

function schemaLabel(result: CheckEntry): string {
  if (result.schemaValid === null) return chalk.dim('---');
  return result.schemaValid ? chalk.green('✓ schema') : chalk.red('✗ schema');
}

function contentTypeLabel(result: CheckEntry): string {
  if (result.contentTypeValid === null) return chalk.dim('---');
  return result.contentTypeValid ? chalk.green('✓ ctype') : chalk.red('✗ ctype');
}

function statusCodeLabelShort(result: CheckEntry): string {
  if (result.statusCodeValid === null) return chalk.dim('---');
  return result.statusCodeValid ? chalk.green('✓ status') : chalk.red('✗ status');
}

export function printReport(results: CheckEntry[], specTitle: string, specVersion: string, verbose: boolean, noColor: boolean): void {
  if (noColor) {
    chalk.level = 0;
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log();
  console.log(chalk.bold('SpecShield') + chalk.dim(' · OpenAPI Contract Testing'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  ${chalk.bold('Spec:')}     ${specTitle} ${chalk.dim('v' + specVersion)}`);
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);
  console.log(`  ${chalk.bold('Time:')}    ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`  ${chalk.bold('Total:')}   ${results.length} endpoints`);
  console.log();

  for (const result of results) {
    const mc = methodColor(result.method);

    if (result.status === 'skip') {
      if (verbose || result.skippedReason) {
        console.log(
          chalk.dim('  -') + ' ' +
          mc(formatMethod(result.method)) +
          chalk.dim(formatPath(result.path, 45)) +
          chalk.dim('  skipped') +
          (result.skippedReason ? chalk.dim(' (' + result.skippedReason + ')') : '')
        );
      }
      continue;
    }

    if (result.status === 'error') {
      console.log(
        '  ' + statusBadge(result) + ' ' +
        mc(formatMethod(result.method)) +
        chalk.dim(formatPath(result.path, 45)) +
        chalk.dim('  ') + chalk.red(result.errors[0] || 'Unknown error')
      );
      continue;
    }

    const line = [
      '  ' + statusBadge(result),
      mc(formatMethod(result.method)),
      formatPath(result.path, 45),
      statusCodeLabel(result),
      ' ' + statusCodeLabelShort(result) + ' ' + schemaLabel(result) + ' ' + contentTypeLabel(result),
    ].join('');

    console.log(line);

    if (result.errors.length > 0 && (verbose || result.status === 'fail')) {
      for (const err of result.errors.slice(0, 3)) {
        console.log(chalk.dim('       → ') + chalk.red(err));
      }
      if (result.errors.length > 3) {
        console.log(chalk.dim(`       → ... and ${result.errors.length - 3} more`));
      }
    }
  }

  console.log();
  console.log(chalk.dim('─'.repeat(50)));

  const summary: string[] = [];
  if (passed > 0) summary.push(chalk.green(`${passed} passed`));
  if (failed > 0) summary.push(chalk.red(`${failed} failed`));
  if (errors > 0) summary.push(chalk.red(`${errors} errors`));
  if (skipped > 0) summary.push(chalk.yellow(`${skipped} skipped`));

  if (summary.length === 0) summary.push(chalk.dim('no results'));

  console.log('  ' + summary.join(chalk.dim(' | ')));

  const failCount = failed + errors;
  if (failCount > 0) {
    console.log(chalk.red(`\n  ✗ ${failCount} check(s) failed.`));
  } else if (results.length > 0) {
    console.log(chalk.green(`\n  ✓ All checks passed.`));
  }

  console.log();
}

export function printUnsafeWarning(methods: string[]): void {
  console.log(chalk.yellow(`  ⚠ Testing ${methods.join(', ')} endpoints — these modify server state.`));
  console.log(chalk.yellow(`    Use --skip-methods ${methods.join(',')} to exclude them.`));
  console.log();
}
