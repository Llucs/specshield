export function normalizeSchema(schema: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!schema || typeof schema !== 'object') return schema;

  const result: Record<string, unknown> = { ...schema };

  if (result.nullable === true && result.type && typeof result.type === 'string') {
    result.type = [result.type, 'null'];
  }
  delete result.nullable;

  for (const key of ['allOf', 'anyOf', 'oneOf', 'not']) {
    if (result[key] && Array.isArray(result[key])) {
      result[key] = result[key].map((item: unknown) => normalizeSchema(item as Record<string, unknown>));
    }
  }

  if (result.properties && typeof result.properties === 'object') {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result.properties as Record<string, unknown>)) {
      normalized[k] = normalizeSchema(v as Record<string, unknown>);
    }
    result.properties = normalized;
  }

  if (result.items) {
    result.items = normalizeSchema(result.items as Record<string, unknown>);
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = normalizeSchema(result.additionalProperties as Record<string, unknown>);
  }

  return result;
}
