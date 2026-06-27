import chalk from 'chalk';
import type { DiffChange, SpecEndpoint } from './types.js';
import { loadSpec, getRequestBodySchema } from './spec.js';

interface DiffContext {
  oldEndpoints: SpecEndpoint[];
  newEndpoints: SpecEndpoint[];
}

function getResponseCodes(operation: Record<string, unknown>): string[] {
  const responses = operation.responses as Record<string, unknown> | undefined;
  if (!responses) return [];
  return Object.keys(responses);
}

function getResponseSchemaForCode(operation: Record<string, unknown>, statusCode: string): Record<string, unknown> | null {
  const responses = operation.responses as Record<string, unknown> | undefined;
  if (!responses) return null;
  const response = (responses[statusCode] || responses['default']) as Record<string, unknown> | undefined;
  if (!response) return null;
  const content = response.content as Record<string, unknown> | undefined;
  if (!content) return null;
  const jsonContent = content['application/json'] as Record<string, unknown> | undefined;
  if (!jsonContent) return null;
  return (jsonContent.schema as Record<string, unknown>) || null;
}

function getSchemaProperties(schema: Record<string, unknown> | null | undefined): Set<string> {
  if (!schema || typeof schema !== 'object') return new Set();
  const props = new Set<string>();

  if (schema.properties && typeof schema.properties === 'object') {
    for (const key of Object.keys(schema.properties as Record<string, unknown>)) {
      props.add(key);
    }
  }

  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      for (const p of getSchemaProperties(sub as Record<string, unknown>)) {
        props.add(p);
      }
    }
  }

  return props;
}

function getRemovedResponseProperties(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>,
  statusCode: string
): string[] {
  const oldSchema = getResponseSchemaForCode(oldOp, statusCode);
  const newSchema = getResponseSchemaForCode(newOp, statusCode);
  if (!oldSchema || !newSchema) return [];

  const oldProps = getSchemaProperties(oldSchema);
  const newProps = getSchemaProperties(newSchema);

  return [...oldProps].filter(p => !newProps.has(p));
}

function getNewRequiredBodyFields(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>
): string[] {
  const oldBody = getRequestBodySchema(oldOp);
  const newBody = getRequestBodySchema(newOp);
  if (!oldBody || !newBody) return [];

  const oldRequired = new Set((oldBody.required as string[]) || []);
  const newRequired = new Set((newBody.required as string[]) || []);

  return [...newRequired].filter(p => !oldRequired.has(p));
}

function getAddedRequiredParams(
  oldOp: Record<string, unknown>,
  newOp: Record<string, unknown>
): string[] {
  const oldParams = (oldOp.parameters || []) as Record<string, unknown>[];
  const newParams = (newOp.parameters || []) as Record<string, unknown>[];
  const oldMap = new Map(oldParams.map(p => [p.name as string, p]));
  const newMap = new Map(newParams.map(p => [p.name as string, p]));

  const added: string[] = [];
  for (const [name, param] of newMap) {
    const oldParam = oldMap.get(name);
    if (!oldParam && param.required === true) {
      added.push(name);
    } else if (oldParam && param.required === true && oldParam.required !== true) {
      added.push(name);
    }
  }
  return added;
}

export async function diff(oldSpecPath: string, newSpecPath: string): Promise<{
  changes: DiffChange[];
  oldTitle: string;
  newTitle: string;
  oldVersion: string;
  newVersion: string;
}> {
  const oldLoaded = await loadSpec(oldSpecPath);
  const newLoaded = await loadSpec(newSpecPath);

  const changes: DiffChange[] = [];

  const oldMap = new Map<string, SpecEndpoint>();
  for (const ep of oldLoaded.endpoints) {
    oldMap.set(`${ep.method}:${ep.path}`, ep);
  }

  const newMap = new Map<string, SpecEndpoint>();
  for (const ep of newLoaded.endpoints) {
    newMap.set(`${ep.method}:${ep.path}`, ep);
  }

  for (const [key, oldEp] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        type: 'breaking',
        path: oldEp.path,
        method: oldEp.method,
        message: 'Endpoint removed',
      });
      continue;
    }

    const newEp = newMap.get(key)!;
    const oldResponses = getResponseCodes(oldEp.operation);
    const newResponses = getResponseCodes(newEp.operation);

    for (const statusCode of oldResponses) {
      if (!newResponses.includes(statusCode)) {
        changes.push({
          type: 'breaking',
          path: oldEp.path,
          method: oldEp.method,
          message: `Response ${statusCode} removed`,
        });
      }
    }

    for (const statusCode of oldResponses) {
      if (newResponses.includes(statusCode)) {
        const removedProps = getRemovedResponseProperties(oldEp.operation, newEp.operation, statusCode);
        for (const prop of removedProps) {
          changes.push({
            type: 'breaking',
            path: oldEp.path,
            method: oldEp.method,
            message: `Response ${statusCode}: property "${prop}" removed from schema`,
          });
        }
      }
    }

    const newRequiredFields = getNewRequiredBodyFields(oldEp.operation, newEp.operation);
    for (const prop of newRequiredFields) {
      changes.push({
        type: 'breaking',
        path: oldEp.path,
        method: oldEp.method,
        message: `Request body: required property "${prop}" added`,
      });
    }

    const newRequiredParams = getAddedRequiredParams(oldEp.operation, newEp.operation);
    for (const param of newRequiredParams) {
      changes.push({
        type: 'breaking',
        path: oldEp.path,
        method: oldEp.method,
        message: `Required parameter "${param}" added`,
      });
    }
  }

  for (const [key, newEp] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        type: 'non-breaking',
        path: newEp.path,
        method: newEp.method,
        message: 'New endpoint added',
      });
    }
  }

  changes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'breaking' ? -1 : 1;
    if (a.method !== b.method) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  return {
    changes,
    oldTitle: oldLoaded.title,
    newTitle: newLoaded.title,
    oldVersion: oldLoaded.version,
    newVersion: newLoaded.version,
  };
}

export function printDiffReport(
  result: Awaited<ReturnType<typeof diff>>,
  noColor: boolean
): void {
  if (noColor) chalk.level = 0;

  const breaking = result.changes.filter(c => c.type === 'breaking');
  const nonBreaking = result.changes.filter(c => c.type === 'non-breaking');

  console.log();
  console.log(chalk.bold('SpecShield') + chalk.dim(' · OpenAPI Diff'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`  ${chalk.bold('Old:')}   ${result.oldTitle} ${chalk.dim('v' + result.oldVersion)}`);
  console.log(`  ${chalk.bold('New:')}   ${result.newTitle} ${chalk.dim('v' + result.newVersion)}`);
  console.log();

  if (result.changes.length === 0) {
    console.log(chalk.green('  No changes detected.'));
    console.log();
    return;
  }

  if (breaking.length > 0) {
    console.log(chalk.red(chalk.bold(`  BREAKING CHANGES (${breaking.length})`)));
    console.log();
    for (const change of breaking) {
      const mc = methodColor(change.method);
      console.log(
        chalk.red('  ✗ ') + mc(formatMethod(change.method)) +
        chalk.dim(formatPath(change.path, 50)) +
        chalk.red('  ' + change.message)
      );
    }
    console.log();
  }

  if (nonBreaking.length > 0) {
    console.log(chalk.yellow(chalk.bold(`  NON-BREAKING CHANGES (${nonBreaking.length})`)));
    console.log();
    for (const change of nonBreaking) {
      const mc = methodColor(change.method);
      console.log(
        chalk.yellow('  + ') + mc(formatMethod(change.method)) +
        chalk.dim(formatPath(change.path, 50)) +
        chalk.yellow('  ' + change.message)
      );
    }
    console.log();
  }

  console.log(chalk.dim('─'.repeat(50)));
  const totalMsg: string[] = [];
  if (breaking.length > 0) totalMsg.push(chalk.red(`${breaking.length} breaking`));
  if (nonBreaking.length > 0) totalMsg.push(chalk.yellow(`${nonBreaking.length} non-breaking`));
  console.log('  ' + (totalMsg.length > 0 ? totalMsg.join(chalk.dim(' | ')) : chalk.dim('no changes')));
  console.log();
}

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
