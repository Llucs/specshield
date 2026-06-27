#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync } from 'fs';
import { loadSpec } from './core/spec.js';
import { checkAll } from './core/check.js';
import { printReport } from './reporters/text.js';
import { printReportJson } from './reporters/json.js';
import { printReportJunit } from './reporters/junit.js';
import { printReportHtml } from './reporters/html.js';
import { printReportSarif } from './reporters/sarif.js';
import { printGitHubAnnotations } from './reporters/github.js';
import { printSpecValidations, printUnsafeWarning } from './reporters/text.js';
import { diff, printDiffReport } from './core/diff.js';
import { loadConfigFromDir } from './core/config.js';
import { loadBaseline, filterAgainstBaseline, updateBaseline } from './core/baseline.js';
import { createWatcher } from './core/watch.js';
import type { CheckConfig, CheckEntry } from './core/types.js';
import { Ajv } from 'ajv';
import addFormats from 'ajv-formats';

function createAjvValidator() {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    validateSchema: false,
  });
  (addFormats as unknown as (ajv: Ajv) => void)(ajv);

  return function validate(data: unknown, schema: Record<string, unknown>): string[] {
    try {
      const validateFn = ajv.compile(schema);
      const valid = validateFn(data);
      if (valid) return [];
      return validateFn.errors?.map((e: { instancePath?: string; message?: string }) =>
        'body' + (e.instancePath ? ' ' + e.instancePath : '') + ': ' + e.message
      ) || [];
    } catch (err) {
      return ['Schema validation error: ' + (err as Error).message];
    }
  };
}

function isHttpUrl(s: string): boolean {
  return s.startsWith('http://') || s.startsWith('https://');
}

const program = new Command();

program
  .name('specshield')
  .description('OpenAPI contract testing tool \u2014 validate your API endpoints against your OpenAPI specification')
  .version('0.3.0');

program
  .command('check')
  .description('Validate API endpoints against OpenAPI spec')
  .argument('<spec>', 'Path or URL to OpenAPI spec file (JSON or YAML)')
  .option('-b, --base-url <url>', 'Base URL of the API. Defaults to spec server URL')
  .option('-H, --header <headers...>', 'Custom request headers (e.g., -H "Authorization: Bearer xxx")')
  .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '10000')
  .option('--skip-methods <methods>', 'Comma-separated methods to skip (e.g., post,put,delete)')
  .option('--only-methods <methods>', 'Comma-separated methods to test (e.g., get,post)')
  .option('-p, --param <params...>', 'Additional parameters as key=value (e.g., -p petId=42)')
  .option('--verbose', 'Show detailed output including passes and skipped')
  .option('--no-color', 'Disable colored output')
  .option('--report <format>', 'Output format: text (default), json, junit, html, sarif')
  .option('--parallel <number>', 'Number of parallel requests (default 5)', '5')
  .option('--config <path>', 'Path to config file (specshield.yaml)')
  .option('--baseline <path>', 'Path to baseline file for ignoring known failures')
  .option('--update-baseline <path>', 'Update baseline file with current results')
  .option('--watch', 'Watch spec file for changes and re-run checks')
  .option('--github-annotations', 'Output GitHub Actions annotations')
  .option('--validate-spec', 'Run spec validations (warnings/errors)')
  .action(async (specArg, options) => {
    const specPath = specArg;

    if (!existsSync(specPath) && !isHttpUrl(specPath)) {
      console.error('Error: Spec file not found: ' + specPath);
      process.exit(1);
    }

    let configFile = options.config as string | undefined;
    const fileConfig = loadConfigFromDir(configFile);
    const configCheck = fileConfig?.check;

    const reportFormat = (
      (options.report as string | undefined) ||
      configCheck?.report ||
      'text'
    ).toLowerCase();
    if (!['text', 'json', 'junit', 'html', 'sarif'].includes(reportFormat)) {
      console.error('Error: Invalid report format "' + options.report + '". Use text, json, junit, html, or sarif.');
      process.exit(1);
    }

    async function runCheck(): Promise<CheckEntry[]> {
      const loaded = await loadSpec(specPath);

      if (options.validateSpec) {
        printSpecValidations(loaded.validations);
      }

      const headers: Record<string, string> = {};
      const headerOpt = options.header || configCheck?.headers;
      if (headerOpt) {
        if (Array.isArray(headerOpt)) {
          for (const h of headerOpt as string[]) {
            const sepIdx = h.indexOf(':');
            if (sepIdx > 0) {
              headers[h.slice(0, sepIdx).trim()] = h.slice(sepIdx + 1).trim();
            }
          }
        } else if (typeof headerOpt === 'object') {
          Object.assign(headers, headerOpt);
        }
      }

      const additionalParams: Record<string, string> = {};
      const paramOpt = options.param || configCheck?.params;
      if (paramOpt) {
        if (Array.isArray(paramOpt)) {
          for (const p of paramOpt as string[]) {
            const eqIdx = p.indexOf('=');
            if (eqIdx > 0) {
              additionalParams[p.slice(0, eqIdx).trim()] = p.slice(eqIdx + 1).trim();
            }
          }
        } else if (typeof paramOpt === 'object') {
          for (const [k, v] of Object.entries(paramOpt)) {
            additionalParams[k] = String(v);
          }
        }
      }

      const skipMethods = new Set<string>();
      const skipOpt = options.skipMethods || configCheck?.skipMethods;
      if (skipOpt) {
        if (typeof skipOpt === 'string') {
          (skipOpt as string).split(',').forEach(m => skipMethods.add(m.toUpperCase().trim()));
        } else if (Array.isArray(skipOpt)) {
          (skipOpt as string[]).forEach(m => skipMethods.add(m.toUpperCase().trim()));
        }
      }

      let onlyMethods: Set<string> | null = null;
      const onlyOpt = options.onlyMethods || configCheck?.onlyMethods;
      if (onlyOpt) {
        onlyMethods = new Set<string>();
        if (typeof onlyOpt === 'string') {
          (onlyOpt as string).split(',').forEach(m => onlyMethods!.add(m.toUpperCase().trim()));
        } else if (Array.isArray(onlyOpt)) {
          (onlyOpt as string[]).forEach(m => onlyMethods!.add(m.toUpperCase().trim()));
        }
      }

      const baseUrl = options.baseUrl || configCheck?.baseUrl || loaded.serverUrl;
      const timeout = parseInt(options.timeout as string, 10) || configCheck?.timeout || 10000;
      const parallel = parseInt(options.parallel as string, 10) || configCheck?.parallel || 5;

      const config: CheckConfig = {
        baseUrl,
        headers,
        timeout,
        additionalParams,
        skipMethods,
        onlyMethods,
        verbose: options.verbose || configCheck?.verbose || false,
        color: options.color !== false,
        parallel,
      };

      if (reportFormat === 'text' && !options.validateSpec) {
        const unsafeMethods = [...new Set(loaded.endpoints
          .map(e => e.method)
          .filter(m => !['GET', 'HEAD', 'OPTIONS'].includes(m))
        )] as string[];

        if (unsafeMethods.length > 0 && !skipMethods.size && !onlyMethods) {
          printUnsafeWarning(unsafeMethods);
        }
      }

      const validate = createAjvValidator();
      const rawResults = await checkAll(loaded.endpoints, config, validate);

      const updateBaselinePath = options.updateBaseline as string || '';
      if (updateBaselinePath) {
        updateBaseline(updateBaselinePath, rawResults);
      }

      let results = rawResults;
      const baselinePath = (options.baseline as string) || fileConfig?.baseline || '';
      if (baselinePath) {
        const baseline = loadBaseline(baselinePath);
        if (baseline) {
          results = filterAgainstBaseline(results, baseline);
        }
      }

      if (reportFormat === 'json') {
        printReportJson(results, loaded.title, loaded.version);
      } else if (reportFormat === 'junit') {
        printReportJunit(results, loaded.title);
      } else if (reportFormat === 'html') {
        printReportHtml(results, loaded.title, loaded.version, options.validateSpec ? loaded.validations : undefined);
      } else if (reportFormat === 'sarif') {
        printReportSarif(results, loaded.title, loaded.version);
      } else {
        printReport(results, loaded.title, loaded.version, config.verbose, !config.color);
      }

      if (options.githubAnnotations) {
        printGitHubAnnotations(results, specPath);
      }

      return results;
    }

    try {
      const results = await runCheck();
      const failCount = results.filter(r => r.status === 'fail' || r.status === 'error').length;

      if (options.watch || fileConfig?.watch) {
        process.stdout.write('Watching ' + specPath + ' for changes...\n');
        const watcher = createWatcher(specPath, async () => {
          process.stdout.write('\n\u2500 File changed, re-running...\n');
          try {
            const newResults = await runCheck();
            const newFailCount = newResults.filter(r => r.status === 'fail' || r.status === 'error').length;
            if (newFailCount > 0) {
              process.exit(1);
            }
          } catch (err) {
            console.error('Error: ' + (err as Error).message);
          }
        });
        process.on('SIGINT', () => {
          watcher.close();
          process.exit(0);
        });
        process.on('SIGTERM', () => {
          watcher.close();
          process.exit(0);
        });
      } else {
        process.exit(failCount > 0 ? 1 : 0);
      }
    } catch (err) {
      console.error('Error: ' + (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('diff')
  .description('Detect breaking changes between two OpenAPI specs')
  .argument('<old-spec>', 'Path to the old OpenAPI spec file')
  .argument('<new-spec>', 'Path to the new OpenAPI spec file')
  .option('--no-color', 'Disable colored output')
  .action(async (oldSpec, newSpec, options) => {
    if (!existsSync(oldSpec)) {
      console.error('Error: Old spec file not found: ' + oldSpec);
      process.exit(1);
    }
    if (!existsSync(newSpec)) {
      console.error('Error: New spec file not found: ' + newSpec);
      process.exit(1);
    }

    try {
      const result = await diff(oldSpec, newSpec);
      printDiffReport(result, options.color === false);
      const breakingCount = result.changes.filter(c => c.type === 'breaking').length;
      process.exit(breakingCount > 0 ? 1 : 0);
    } catch (err) {
      console.error('Error: ' + (err as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate an OpenAPI spec file for common issues')
  .argument('<spec>', 'Path to OpenAPI spec file')
  .option('--no-color', 'Disable colored output')
  .action(async (specPath, options) => {
    if (!existsSync(specPath) && !isHttpUrl(specPath)) {
      console.error('Error: Spec file not found: ' + specPath);
      process.exit(1);
    }
    try {
      const loaded = await loadSpec(specPath);
      printSpecValidations(loaded.validations);
      const errors = loaded.validations.filter(v => v.type === 'error').length;
      process.exit(errors > 0 ? 1 : 0);
    } catch (err) {
      console.error('Error: ' + (err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
