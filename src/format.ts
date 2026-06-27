import chalk from 'chalk';
import type { CheckEntry } from './types.js';

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

export function calculateScore(results: CheckEntry[]): number {
  const checked = results.filter(r => r.status !== 'skip');
  if (checked.length === 0) return 0;

  const weightStatus = 40;
  const weightSchema = 35;
  const weightContentType = 15;
  const weightDocs = 10;

  const statusTotal = checked.filter(r => r.statusCodeValid !== null).length;
  const statusOk = checked.filter(r => r.statusCodeValid === true).length;

  const schemaTotal = checked.filter(r => r.schemaValid !== null).length;
  const schemaOk = checked.filter(r => r.schemaValid === true).length;

  const contentTypeTotal = checked.filter(r => r.contentTypeValid !== null).length;
  const contentTypeOk = checked.filter(r => r.contentTypeValid === true).length;

  const docsOk = checked.filter(r => r.summary && r.summary.length > 0).length;

  let score = 0;
  if (statusTotal > 0) score += (statusOk / statusTotal) * weightStatus;
  if (schemaTotal > 0) score += (schemaOk / schemaTotal) * weightSchema;
  if (contentTypeTotal > 0) score += (contentTypeOk / contentTypeTotal) * weightContentType;
  if (checked.length > 0) score += (docsOk / checked.length) * weightDocs;

  return Math.min(Math.round(score), 100);
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

    console.log(
      '  ' + statusBadge(result) +
      mc(formatMethod(result.method)) +
      formatPath(result.path, 45) +
      statusCodeLabel(result) +
      ' ' + statusCodeLabelShort(result) + ' ' + schemaLabel(result) + ' ' + contentTypeLabel(result)
    );

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
  if (errorCount > 0) summary.push(chalk.red(`${errorCount} errors`));
  if (skipped > 0) summary.push(chalk.yellow(`${skipped} skipped`));
  if (summary.length === 0) summary.push(chalk.dim('no results'));

  console.log('  ' + summary.join(chalk.dim(' | ')));

  const scoreColor = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('API Score:')} ${scoreColor(String(score) + '/100')}`);

  const failCount = failed + errorCount;
  if (failCount > 0) {
    console.log(chalk.red(`\n  ✗ ${failCount} check(s) failed.`));
  } else if (results.length > 0) {
    console.log(chalk.green(`\n  ✓ All checks passed.`));
  }

  console.log();
}

export function printReportJson(results: CheckEntry[], specTitle: string, specVersion: string): void {
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);
  const report = {
    specshield: {
      version: '0.2.0',
      spec: specTitle,
      specVersion,
      timestamp: new Date().toISOString(),
      durationMs: totalTime,
      score: calculateScore(results),
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        skipped: results.filter(r => r.status === 'skip').length,
        errors: results.filter(r => r.status === 'error').length,
      },
      endpoints: results.map(r => ({
        path: r.path,
        method: r.method,
        summary: r.summary,
        status: r.status,
        url: r.url,
        actualStatus: r.actualStatus,
        statusCodeValid: r.statusCodeValid,
        schemaValid: r.schemaValid,
        contentTypeValid: r.contentTypeValid,
        errors: r.errors,
        durationMs: r.durationMs,
        skippedReason: r.skippedReason,
      })),
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function printReportJunit(results: CheckEntry[], specTitle: string): void {
  const total = results.length;
  const failures = results.filter(r => r.status === 'fail').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuite name="specshield" tests="${total}" failures="${failures}" errors="${errorCount}" skipped="${skipped}" time="${(totalTime / 1000).toFixed(3)}">\n`;

  for (const r of results) {
    const name = `${r.method} ${r.path}`;
    const time = (r.durationMs / 1000).toFixed(3);
    xml += `  <testcase name="${escapeXml(name)}" classname="${escapeXml(specTitle)}" time="${time}">\n`;

    if (r.status === 'skip') {
      xml += `    <skipped message="${escapeXml(r.skippedReason || 'skipped')}"/>\n`;
    } else if (r.status === 'error') {
      xml += `    <error message="${escapeXml(r.errors[0] || 'Unknown error')}" type="error"/>\n`;
    } else if (r.status === 'fail') {
      for (const err of r.errors) {
        xml += `    <failure message="${escapeXml(err)}" type="validation"/>\n`;
      }
    }

    xml += `  </testcase>\n`;
  }

  xml += '</testsuite>\n';
  console.log(xml);
}

export function printUnsafeWarning(methods: string[]): void {
  console.log(chalk.yellow(`  ⚠ Testing ${methods.join(', ')} endpoints — these modify server state.`));
  console.log(chalk.yellow(`    Use --skip-methods ${methods.join(',')} to exclude them.`));
  console.log();
}
