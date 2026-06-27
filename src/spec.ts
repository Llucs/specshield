import SwaggerParser from '@apidevtools/swagger-parser';
import type { SpecEndpoint } from './types.js';

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

  return { spec, endpoints, title, version, serverUrl };
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
