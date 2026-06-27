import type { CheckEntry } from '../core/types.js';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function printReportJunit(results: CheckEntry[], specTitle: string): void {
  const total = results.length;
  const failures = results.filter(r => r.status === 'fail').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<testsuite name="specshield" tests="' + total + '" failures="' + failures + '" errors="' + errorCount + '" skipped="' + skipped + '" time="' + (totalTime / 1000).toFixed(3) + '">\n';

  for (const r of results) {
    const name = r.method + ' ' + r.path;
    const time = (r.durationMs / 1000).toFixed(3);
    xml += '  <testcase name="' + escapeXml(name) + '" classname="' + escapeXml(specTitle) + '" time="' + time + '">\n';

    if (r.status === 'skip') {
      xml += '    <skipped message="' + escapeXml(r.skippedReason || 'skipped') + '"/>\n';
    } else if (r.status === 'error') {
      xml += '    <error message="' + escapeXml(r.errors[0] || 'Unknown error') + '" type="error"/>\n';
    } else if (r.status === 'fail') {
      for (const err of r.errors) {
        xml += '    <failure message="' + escapeXml(err) + '" type="validation"/>\n';
      }
    }

    xml += '  </testcase>\n';
  }

  xml += '</testsuite>\n';
  console.log(xml);
}
