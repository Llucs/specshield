import type { CheckEntry } from '../core/types.js';
import { calculateScore } from './score.js';

export function printReportJson(results: CheckEntry[], specTitle: string, specVersion: string): void {
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);
  const report = {
    specshield: {
      version: '0.3.0',
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
