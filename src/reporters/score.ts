import type { CheckEntry } from '../core/types.js';

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
