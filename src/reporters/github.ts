import type { CheckEntry } from '../core/types.js';
import { calculateScore } from './score.js';

export function printGitHubAnnotations(results: CheckEntry[], specFile: string): void {
  for (const r of results) {
    if (r.status !== 'fail' && r.status !== 'error') continue;

    const level = r.status === 'error' ? 'error' : 'warning';
    const title = r.method + ' ' + r.path + ' - ' + r.status.toUpperCase();
    const message = r.errors.length > 0 ? r.errors.join('; ') : r.status === 'error' ? 'Request error' : 'Validation failure';

    console.log('::' + level + ' file=' + specFile + ',title=' + title + '::' + message);
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const score = calculateScore(results);

  console.log('::notice title=SpecShield Summary::' +
    passed + ' passed, ' + failed + ' failed, ' + errorCount + ' errors, ' + skipped + ' skipped. API Score: ' + score + '/100');
}
