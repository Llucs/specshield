import axios, { AxiosError } from 'axios';
import type { CheckConfig, CheckEntry, SpecEndpoint } from './types.js';
import { getOperationParams, getRequestBodySchema, getResponseSchema } from './spec.js';
import { normalizeSchema } from './schema.js';

function paramToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function generateParamValue(param: Record<string, unknown>): string | null {
  if (param.example !== undefined) return paramToString(param.example);

  const schema = param.schema as Record<string, unknown> | undefined;
  if (!schema) return null;

  if (schema.example !== undefined) return paramToString(schema.example);
  if (schema.default !== undefined) return paramToString(schema.default);
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return paramToString(schema.enum[0]);
  }

  const type = schema.type as string | undefined;
  const format = schema.format as string | undefined;

  if (format === 'int64' || format === 'int32') return '1';

  if (type === 'integer' || type === 'number') return '1';
  if (type === 'boolean') return 'true';
  if (type === 'string') {
    if (format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    if (format === 'email') return 'test@example.com';
    if (format === 'uri' || format === 'url') return 'https://example.com';
    if (format === 'date') return '2024-01-01';
    if (format === 'date-time') return '2024-01-01T00:00:00Z';
    if (format === 'byte') return 'dGVzdA==';
    return 'test';
  }

  return null;
}

function generateBodyFromSchema(schema: Record<string, unknown>): unknown {
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  const type = schema.type as string | undefined;

  if (type === 'object') {
    const result: Record<string, unknown> = {};
    const properties = schema.properties as Record<string, unknown> | undefined;
    const required = (schema.required as string[]) || [];

    if (properties) {
      for (const [key, prop] of Object.entries(properties)) {
        const propSchema = prop as Record<string, unknown>;
        const isReadOnly = propSchema.readOnly === true;
        if (required.includes(key) || !isReadOnly) {
          result[key] = generateBodyFromSchema(propSchema);
        }
      }
    }
    return result;
  }

  if (type === 'array') {
    const items = schema.items as Record<string, unknown> | undefined;
    return items ? [generateBodyFromSchema(items)] : [];
  }

  if (type === 'string') return 'test';
  if (type === 'integer') return 1;
  if (type === 'number') return 1.0;
  if (type === 'boolean') return true;

  return null;
}

function extractResponseData(error: AxiosError): { status: number; data: unknown; headers: Record<string, string> } | null {
  if (error.response) {
    return {
      status: error.response.status,
      data: error.response.data as unknown,
      headers: error.response.headers as Record<string, string>,
    };
  }
  return null;
}

async function checkEndpoint(
  endpoint: SpecEndpoint,
  config: CheckConfig,
  validateFn: (data: unknown, schema: Record<string, unknown>) => string[]
): Promise<CheckEntry> {
  const { path, method, summary, operation } = endpoint;
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  let url = `${baseUrl}${path}`;

  const allParams = getOperationParams(operation);
  const additionalParams = { ...config.additionalParams };

  for (const param of allParams) {
    const p = param as Record<string, unknown>;
    const name = p.name as string;
    const location = p.in as string;
    const required = p.required === true;

    if (location === 'path') {
      const placeholder = `{${name}}`;
      if (url.includes(placeholder)) {
        const value = additionalParams[name] || generateParamValue(param);
        if (value !== null) {
          url = url.replace(placeholder, encodeURIComponent(value));
        } else if (required) {
          return {
            path, method, summary: summary || '', url,
            status: 'skip', statusCodeValid: null, expectedStatus: '',
            actualStatus: null, schemaValid: null, contentTypeValid: null,
            errors: [], durationMs: 0, skippedReason: 'Missing required path parameter: ' + name,
          };
        }
      }
    }
  }

  const queryParams: string[] = [];
  for (const param of allParams) {
    const p = param as Record<string, unknown>;
    const name = p.name as string;
    const location = p.in as string;

    if (location === 'query') {
      const value = additionalParams[name] || generateParamValue(param);
      if (value !== null) {
        queryParams.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
      }
    }
  }

  if (queryParams.length > 0) {
    url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
  }

  if (url.includes('{')) {
    return {
      path, method, summary: summary || '', url,
      status: 'skip', statusCodeValid: null, expectedStatus: '',
      actualStatus: null, schemaValid: null, contentTypeValid: null,
      errors: [], durationMs: 0, skippedReason: 'Could not resolve path parameters',
    };
  }

  const startTime = Date.now();
  let actualStatus: number | null = null;
  let responseData: unknown = null;
  let responseHeaders: Record<string, string> = {};

  const requestHeaders: Record<string, string> = { ...config.headers };

  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const bodySchema = ['POST', 'PUT', 'PATCH'].includes(method) ? getRequestBodySchema(operation) : null;
  let requestBody: unknown = undefined;

  if (bodySchema) {
    try {
      requestBody = generateBodyFromSchema(bodySchema);
    } catch {
      requestBody = undefined;
    }
  }

  try {
    const response = await axios({
      method: method.toLowerCase(),
      url,
      headers: requestHeaders,
      data: requestBody,
      timeout: config.timeout,
      validateStatus: () => true,
    });
    actualStatus = response.status;
    responseData = response.data;
    responseHeaders = response.headers as Record<string, string>;
  } catch (err) {
    const axiosErr = err as AxiosError;
    const extracted = extractResponseData(axiosErr);
    if (extracted) {
      actualStatus = extracted.status;
      responseData = extracted.data;
      responseHeaders = extracted.headers;
    } else {
      const durationMs = Date.now() - startTime;
      return {
        path, method, summary: summary || '', url,
        status: 'error', statusCodeValid: null, expectedStatus: '',
        actualStatus: null, schemaValid: null, contentTypeValid: null,
        errors: ['Request failed: ' + (err as Error).message],
        durationMs,
      };
    }
  }

  const durationMs = Date.now() - startTime;
  const errors: string[] = [];
  const responses = operation.responses as Record<string, unknown> | undefined;

  let statusCodeValid: boolean | null = null;
  let expectedStatus = '';
  let schemaValid: boolean | null = null;
  let contentTypeValid: boolean | null = null;

  if (responses) {
    const statusStr = String(actualStatus);
    const statusCodes = Object.keys(responses);
    const matchExact = statusCodes.includes(statusStr);
    const matchDefault = statusCodes.includes('default');

    if (matchExact) {
      statusCodeValid = true;
      expectedStatus = statusStr;
    } else if (matchDefault) {
      statusCodeValid = true;
      expectedStatus = 'default';
    } else {
      statusCodeValid = false;
      expectedStatus = statusCodes.join(', ');
      errors.push('Unexpected status ' + actualStatus + '. Expected one of: ' + statusCodes.join(', '));
    }
  }

  const contentType = responseHeaders['content-type'] || responseHeaders['Content-Type'] || '';
  const primaryContentType = contentType.split(';')[0].trim().toLowerCase();

  if (responses && actualStatus !== null) {
    const statusStr = String(actualStatus);
    const responseSpec = (responses[statusStr] || responses['default']) as Record<string, unknown> | undefined;
    if (responseSpec) {
      const content = responseSpec.content as Record<string, unknown> | undefined;
      if (content) {
        const specTypes = Object.keys(content).map(t => t.toLowerCase());
        if (specTypes.length > 0 && primaryContentType) {
          contentTypeValid = specTypes.some(t => primaryContentType.startsWith(t.split(';')[0].trim()));
          if (!contentTypeValid) {
            errors.push('Content-Type "' + primaryContentType + '" not in spec: ' + specTypes.join(', '));
          }
        }
      }
    }
  }

  if (actualStatus !== null && responseData !== undefined && responseData !== null) {
    const responseSchema = getResponseSchema(operation, actualStatus, primaryContentType || 'application/json');
    if (responseSchema) {
      const normalizedSchema = normalizeSchema(responseSchema);
      if (normalizedSchema) {
        const schemaErrors = validateFn(responseData, normalizedSchema);
        schemaValid = schemaErrors.length === 0;
        if (!schemaValid) {
          errors.push(...schemaErrors.slice(0, 5));
        }
      }
    }
  }

  const allPass = errors.length === 0;
  const status: 'pass' | 'fail' = allPass ? 'pass' : 'fail';

  return {
    path, method, summary: summary || '', url,
    status, statusCodeValid, expectedStatus,
    actualStatus, schemaValid, contentTypeValid, errors,
    durationMs,
  };
}

export async function checkAll(
  endpoints: SpecEndpoint[],
  config: CheckConfig,
  validateFn: (data: unknown, schema: Record<string, unknown>) => string[]
): Promise<CheckEntry[]> {
  const results: CheckEntry[] = [];

  for (const endpoint of endpoints) {
    const { method } = endpoint;

    if (config.skipMethods.has(method)) {
      results.push({
        path: endpoint.path,
        method,
        summary: endpoint.summary || '',
        url: '',
        status: 'skip',
        statusCodeValid: null,
        expectedStatus: '',
        actualStatus: null,
        schemaValid: null,
        contentTypeValid: null,
        errors: [],
        durationMs: 0,
        skippedReason: 'Method ' + method + ' skipped via --skip-methods',
      });
      continue;
    }

    if (config.onlyMethods !== null && !config.onlyMethods.has(method)) {
      continue;
    }

    const result = await checkEndpoint(endpoint, config, validateFn);
    results.push(result);
  }

  return results;
}
