#!/usr/bin/env node

import { Command } from 'commander';
import { existsSync } from 'fs';
import { loadSpec } from './spec.js';
import { checkAll } from './check.js';
import {
  printReport, printReportJson, printReportJunit,
  printUnsafeWarning,
} from './format.js';
import { diff, printDiffReport } from './diff.js';
import type { CheckConfig } from './types.js';
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
        `body${e.instancePath ? ' ' + e.instancePath : ''}: ${e.message}`
      ) || [];
    } catch (err) {
      return [`Schema validation error: ${(err as Error).message}`];
    }
  };
}

const program = new Command();

program
  .name('specshield')
  .description('OpenAPI contract testing tool — validate your API endpoints against your OpenAPI specification')
  .version('0.1.0');

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
  .option('--report <format>', 'Output format: text (default), json, junit', 'text')
  .action(async (specArg, options) => {
    const specPath = specArg;

    if (!existsSync(specPath) && !specPath.startsWith('http')) {
      console.error('Error: Spec file not found: ' + specPath);
      process.exit(1);
    }

    const reportFormat = (options.report as string || 'text').toLowerCase();
    if (!['text', 'json', 'junit'].includes(reportFormat)) {
      console.error('Error: Invalid report format "' + options.report + '". Use text, json, or junit.');
      process.exit(1);
    }

    try {
      const loaded = await loadSpec(specPath);
      const headers: Record<string, string> = {};
      if (options.header) {
        for (const h of options.header as string[]) {
          const sepIdx = h.indexOf(':');
          if (sepIdx > 0) {
            headers[h.slice(0, sepIdx).trim()] = h.slice(sepIdx + 1).trim();
          }
        }
      }

      const additionalParams: Record<string, string> = {};
      if (options.param) {
        for (const p of options.param as string[]) {
          const eqIdx = p.indexOf('=');
          if (eqIdx > 0) {
            additionalParams[p.slice(0, eqIdx).trim()] = p.slice(eqIdx + 1).trim();
          }
        }
      }

      const skipMethods = new Set<string>();
      if (options.skipMethods) {
        (options.skipMethods as string).split(',').forEach(m => skipMethods.add(m.toUpperCase().trim()));
      }

      let onlyMethods: Set<string> | null = null;
      if (options.onlyMethods) {
        onlyMethods = new Set<string>();
        (options.onlyMethods as string).split(',').forEach(m => onlyMethods!.add(m.toUpperCase().trim()));
      }

      const baseUrl = options.baseUrl || loaded.serverUrl;

      const config: CheckConfig = {
        baseUrl,
        headers,
        timeout: parseInt(options.timeout as string, 10) || 10000,
        additionalParams,
        skipMethods,
        onlyMethods,
        verbose: options.verbose || false,
        color: options.color !== false,
      };

      if (reportFormat === 'text') {
        const unsafeMethods = [...new Set(loaded.endpoints
          .map(e => e.method)
          .filter(m => !['GET', 'HEAD', 'OPTIONS'].includes(m))
        )] as string[];

        if (unsafeMethods.length > 0 && !skipMethods.size) {
          printUnsafeWarning(unsafeMethods);
        }
      }

      const validate = createAjvValidator();
      const results = await checkAll(loaded.endpoints, config, validate);

      if (reportFormat === 'json') {
        printReportJson(results, loaded.title, loaded.version);
      } else if (reportFormat === 'junit') {
        printReportJunit(results, loaded.title);
      } else {
        printReport(results, loaded.title, loaded.version, config.verbose, config.color);
      }

      const failCount = results.filter(r => r.status === 'fail' || r.status === 'error').length;
      process.exit(failCount > 0 ? 1 : 0);
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

program.parse(process.argv);
