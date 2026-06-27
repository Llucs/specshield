import SwaggerParser from '@apidevtools/swagger-parser';
import type { SpecEndpoint, SpecValidation } from './types.js';

const VALID_HTTP_STATUS_CODES = new Set([
  '100','101','102','103',
  '200','201','202','203','204','205','206','207','208','226',
  '300','301','302','303','304','305','306','307','308',
  '400','401','402','403','404','405','406','407','408','409',
  '410','411','412','413','414','415','416','417','418','421',
  '422','423','424','425','426','428','429','431','451',
  '500','501','502','503','504','505','506','507','508','510','511',
]);

function collectEndpoints(spec: Record<string, unknown>): SpecEndpoint[] {
  const endpoints: SpecEndpoint[] = [];
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) return endpoints;

  const supportedMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!supportedMethods.has(method)) continue;
      const op = operation as Record<string, unknown>;
      endpoints.push({
        path,
        method: method.toUpperCase(),
        summary: (op.summary as string) || '',
        operation: op,
      });
    }
  }

  endpoints.sort((a, b) => {
    if (a.method !== b.method) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  return endpoints;
}

export interface LoadedSpec {
  spec: Record<string, unknown>;
  endpoints: SpecEndpoint[];
  title: string;
  version: string;
  serverUrl: string;
  validations: SpecValidation[];
}

function validateSpec(spec: Record<string, unknown>, endpoints: SpecEndpoint[]): SpecValidation[] {
  const validations: SpecValidation[] = [];
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  const operationIds = new Map<string, string>();

  if (!paths) return validations;

  for (const [path, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== 'object') {
      validations.push({
        type: 'warning',
        message: 'Path "' + path + '" has no operations',
        path,
      });
      continue;
    }

    const operations = Object.keys(methods).filter(m =>
      ['get','post','put','patch','delete','head','options'].includes(m)
    );

    if (operations.length === 0) {
      validations.push({
        type: 'warning',
        message: 'Path "' + path + '" has no supported operations',
        path,
      });
    }

    for (const method of operations) {
      const op = methods[method] as Record<string, unknown>;

      if (!op.responses || typeof op.responses !== 'object' || Object.keys(op.responses).length === 0) {
        validations.push({
          type: 'error',
          message: method.toUpperCase() + ' ' + path + ' has no responses defined',
          path,
        });
      }

      if (op.responses && typeof op.responses === 'object') {
        for (const statusCode of Object.keys(op.responses)) {
          if (statusCode !== 'default' && !VALID_HTTP_STATUS_CODES.has(statusCode) && !statusCode.endsWith('XX')) {
            validations.push({
              type: 'warning',
              message: method.toUpperCase() + ' ' + path + ' has unusual status code: ' + statusCode,
              path,
            });
          }
        }
      }

      if (op.operationId) {
        const opId = op.operationId as string;
        const existing = operationIds.get(opId);
        if (existing) {
          validations.push({
            type: 'warning',
            message: 'Duplicate operationId "' + opId + '" in ' + method.toUpperCase() + ' ' + path + ' (also in ' + existing + ')',
            path,
          });
        } else {
          operationIds.set(opId, method.toUpperCase() + ' ' + path);
        }
      }

      const params = (op.parameters || []) as Record<string, unknown>[];
      const paramNames = new Set<string>();
      for (const p of params) {
        const name = p.name as string;
        if (paramNames.has(name)) {
          validations.push({
            type: 'warning',
            message: method.toUpperCase() + ' ' + path + ' has duplicate parameter "' + name + '"',
            path,
          });
        }
        paramNames.add(name);
      }

      if (op.deprecated === true) {
        validations.push({
          type: 'warning',
          message: method.toUpperCase() + ' ' + path + ' is marked as deprecated',
          path,
        });
      }
    }
  }

  return validations;
}

export async function loadSpec(specPath: string): Promise<LoadedSpec> {
  let spec: Record<string, unknown>;

  try {
    spec = (await SwaggerParser.dereference(specPath)) as Record<string, unknown>;
  } catch {
    spec = (await SwaggerParser.parse(specPath)) as Record<string, unknown>;
  }

  const info = spec.info as Record<string, unknown> | undefined;
  const title = (info?.title as string) || 'Untitled API';
  const version = (info?.version as string) || '0.0.0';

  const servers = spec.servers as Array<Record<string, unknown>> | undefined;
  const serverUrl = servers?.[0]?.url as string || 'http://localhost';

  const endpoints = collectEndpoints(spec);
  const validations = validateSpec(spec, endpoints);

  return { spec, endpoints, title, version, serverUrl, validations };
}

export function getPathParams(spec: Record<string, unknown>, path: string): Record<string, unknown>[] {
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  const pathItem = paths?.[path];
  if (!pathItem) return [];
  const params = (pathItem.parameters || []) as Record<string, unknown>[];
  return params.filter((p: Record<string, unknown>) => p.in === 'path');
}

export function getOperationParams(operation: Record<string, unknown>): Record<string, unknown>[] {
  return (operation.parameters || []) as Record<string, unknown>[];
}

export function getResponseCodes(operation: Record<string, unknown>): string[] {
  const responses = operation.responses as Record<string, unknown> | undefined;
  if (!responses) return [];
  return Object.keys(responses);
}

export function getResponseSchema(
  operation: Record<string, unknown>,
  statusCode: number,
  contentType: string
): Record<string, unknown> | null {
  const responses = operation.responses as Record<string, unknown> | undefined;
  if (!responses) return null;

  const statusStr = String(statusCode);
  const response = (responses[statusStr] || responses['default']) as Record<string, unknown> | undefined;
  if (!response) return null;

  const content = response.content as Record<string, unknown> | undefined;
  if (!content) return null;

  const mediaType = (content[contentType] || content['application/json']) as Record<string, unknown> | undefined;
  if (!mediaType) return null;

  return (mediaType['schema'] as Record<string, unknown>) || null;
}

export function getRequestBodySchema(operation: Record<string, unknown>): Record<string, unknown> | null {
  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  if (!requestBody) return null;

  const content = requestBody.content as Record<string, unknown> | undefined;
  if (!content) return null;

  const jsonContent = content['application/json'] as Record<string, unknown> | undefined;
  if (!jsonContent) return null;

  return (jsonContent.schema as Record<string, unknown>) || null;
}
