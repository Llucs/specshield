import chalk from 'chalk';
import type { CheckEntry, SpecValidation } from '../core/types.js';
import { calculateScore } from './score.js';

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
  return result.schemaValid ? chalk.green('\u2713 schema') : chalk.red('\u2717 schema');
}

function contentTypeLabel(result: CheckEntry): string {
  if (result.contentTypeValid === null) return chalk.dim('---');
  return result.contentTypeValid ? chalk.green('\u2713 ctype') : chalk.red('\u2717 ctype');
}

function statusCodeLabelShort(result: CheckEntry): string {
  if (result.statusCodeValid === null) return chalk.dim('---');
  return result.statusCodeValid ? chalk.green('\u2713 status') : chalk.red('\u2717 status');
}

export function printReport(
  results: CheckEntry[], specTitle: string, specVersion: string,
  verbose: boolean, noColor: boolean
): void {
  if (noColor) chalk.level = 0;

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const score = calculateScore(results);

  console.log();
  console.log(chalk.bold('SpecShield') + chalk.dim(' \u00B7 OpenAPI Contract Testing'));
  console.log(chalk.dim('\u2500'.repeat(50)));
  console.log('  ' + chalk.bold('Spec:') + '     ' + specTitle + ' ' + chalk.dim('v' + specVersion));
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);
  console.log('  ' + chalk.bold('Time:') + '    ' + (totalTime / 1000).toFixed(1) + 's');
  console.log('  ' + chalk.bold('Total:') + '   ' + results.length + ' endpoints');
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

    console.log(
      '  ' + statusBadge(result) +
      mc(formatMethod(result.method)) +
      formatPath(result.path, 45) +
      statusCodeLabel(result) +
      ' ' + statusCodeLabelShort(result) + ' ' + schemaLabel(result) + ' ' + contentTypeLabel(result)
    );

    if (result.errors.length > 0 && (verbose || result.status === 'fail')) {
      for (const err of result.errors.slice(0, 3)) {
        console.log(chalk.dim('       \u2192 ') + chalk.red(err));
      }
      if (result.errors.length > 3) {
        console.log(chalk.dim('       \u2192 ... and ' + (result.errors.length - 3) + ' more'));
      }
    }
  }

  console.log();
  console.log(chalk.dim('\u2500'.repeat(50)));

  const summary: string[] = [];
  if (passed > 0) summary.push(chalk.green(passed + ' passed'));
  if (failed > 0) summary.push(chalk.red(failed + ' failed'));
  if (errorCount > 0) summary.push(chalk.red(errorCount + ' errors'));
  if (skipped > 0) summary.push(chalk.yellow(skipped + ' skipped'));
  if (summary.length === 0) summary.push(chalk.dim('no results'));

  console.log('  ' + summary.join(chalk.dim(' | ')));

  const scoreColor = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
  console.log('  ' + chalk.bold('API Score:') + ' ' + scoreColor(String(score) + '/100'));

  const failCount = failed + errorCount;
  if (failCount > 0) {
    console.log(chalk.red('\n  \u2717 ' + failCount + ' check(s) failed.'));
  } else if (results.length > 0) {
    console.log(chalk.green('\n  \u2713 All checks passed.'));
  }

  console.log();
}

export function printUnsafeWarning(methods: string[]): void {
  console.log(chalk.yellow('  \u26A0 Testing ' + methods.join(', ') + ' endpoints \u2014 these modify server state.'));
  console.log(chalk.yellow('    Use --skip-methods ' + methods.join(',') + ' to exclude them.'));
  console.log();
}

export function printSpecValidations(validations: SpecValidation[]): void {
  if (validations.length === 0) return;

  console.log(chalk.bold('\n  Spec Validations'));
  console.log(chalk.dim('  \u2500'.repeat(40)));

  const errors = validations.filter(v => v.type === 'error');
  const warnings = validations.filter(v => v.type === 'warning');

  for (const v of validations) {
    const icon = v.type === 'error' ? chalk.red('\u2717') : chalk.yellow('\u26A0');
    const color = v.type === 'error' ? chalk.red : chalk.yellow;
    console.log('  ' + icon + ' ' + color(v.type.toUpperCase()) + ': ' + v.message);
  }

  console.log(chalk.dim('  \u2500'.repeat(40)));
  const parts: string[] = [];
  if (errors.length > 0) parts.push(chalk.red(errors.length + ' errors'));
  if (warnings.length > 0) parts.push(chalk.yellow(warnings.length + ' warnings'));
  console.log('  ' + (parts.length > 0 ? parts.join(chalk.dim(' | ')) : chalk.dim('no issues')));
  console.log();
}
