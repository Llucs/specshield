import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { CheckEntry, BaselineData, BaselineEntry } from './types.js';

export function loadBaseline(baselinePath: string): BaselineData | null {
  if (!existsSync(baselinePath)) {
    return null;
  }
  try {
    const content = readFileSync(baselinePath, 'utf-8');
    return JSON.parse(content) as BaselineData;
  } catch {
    return null;
  }
}

export function filterAgainstBaseline(
  results: CheckEntry[],
  baseline: BaselineData
): CheckEntry[] {
  const failureMap = new Map<string, BaselineEntry[]>();
  for (const f of baseline.failures) {
    const key = f.method + ':' + f.path;
    const arr = failureMap.get(key);
    if (arr) {
      arr.push(f);
    } else {
      failureMap.set(key, [f]);
    }
  }

  return results.map(r => {
    if (r.status !== 'fail' && r.status !== 'error') return r;
    const key = r.method + ':' + r.path;
    const baselineFailures = failureMap.get(key);
    if (!baselineFailures) return r;

    for (const bf of baselineFailures) {
      if (bf.errors.length === r.errors.length &&
          bf.errors.every((e, i) => e === r.errors[i])) {
        return {
          ...r,
          status: 'pass' as const,
          statusCodeValid: r.statusCodeValid !== false ? r.statusCodeValid : true,
          schemaValid: r.schemaValid !== false ? r.schemaValid : true,
          contentTypeValid: r.contentTypeValid !== false ? r.contentTypeValid : true,
          errors: [],
        };
      }
    }
    return r;
  });
}

export function updateBaseline(baselinePath: string, results: CheckEntry[]): void {
  const failures: BaselineEntry[] = [];
  for (const r of results) {
    if (r.status === 'fail' || r.status === 'error') {
      failures.push({
        method: r.method,
        path: r.path,
        errors: [...r.errors],
        status: r.status,
      });
    }
  }
  const data: BaselineData = {
    version: '0.3.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    failures,
  };
  writeFileSync(baselinePath, JSON.stringify(data, null, 2), 'utf-8');
}
