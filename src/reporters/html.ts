import type { CheckEntry, SpecValidation } from '../core/types.js';
import { calculateScore } from './score.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function printReportHtml(results: CheckEntry[], specTitle: string, specVersion: string, validations?: SpecValidation[]): void {
  const totalTime = results.reduce((acc, r) => acc + r.durationMs, 0);
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const score = calculateScore(results);

  let rows = '';
  for (const r of results) {
    const statusClass = r.status === 'pass' ? 'pass' : r.status === 'fail' ? 'fail' : r.status === 'error' ? 'error' : 'skip';
    const statusIcon = r.status === 'pass' ? '\u2713' : r.status === 'fail' ? '\u2717' : r.status === 'error' ? '!' : '-';
    let errorsHtml = '';
    if (r.errors.length > 0) {
      errorsHtml = '<div class="errors">' + r.errors.map(e => '<div class="error">' + escapeHtml(e) + '</div>').join('') + '</div>';
    }
    rows += '<tr class="' + statusClass + '">' +
      '<td class="status"><span class="badge badge-' + statusClass + '">' + statusIcon + ' ' + r.status.toUpperCase() + '</span></td>' +
      '<td class="method">' + r.method + '</td>' +
      '<td class="path">' + escapeHtml(r.path) + '</td>' +
      '<td class="code">' + (r.actualStatus !== null ? String(r.actualStatus) : '-') + '</td>' +
      '<td class="checks">' +
      '<span class="check ' + (r.statusCodeValid === true ? 'ok' : r.statusCodeValid === false ? 'fail' : 'na') + '">S</span>' +
      '<span class="check ' + (r.schemaValid === true ? 'ok' : r.schemaValid === false ? 'fail' : 'na') + '">Sch</span>' +
      '<span class="check ' + (r.contentTypeValid === true ? 'ok' : r.contentTypeValid === false ? 'fail' : 'na') + '">CT</span>' +
      '</td>' +
      '<td>' + r.durationMs + 'ms</td>' +
      '<td>' + errorsHtml + '</td>' +
      '</tr>\n';
  }

  let validationsHtml = '';
  if (validations && validations.length > 0) {
    validationsHtml = '<div class="validations"><h3>Spec Validations (' + validations.length + ')</h3><ul>';
    for (const v of validations) {
      const vClass = v.type === 'error' ? 'val-error' : 'val-warning';
      validationsHtml += '<li class="' + vClass + '">' + escapeHtml(v.type.toUpperCase()) + ': ' + escapeHtml(v.message) + '</li>';
    }
    validationsHtml += '</ul></div>';
  }

  const html = '<!DOCTYPE html>\n<html lang="en">\n<head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>SpecShield Report - ' + escapeHtml(specTitle) + '</title>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0d1117;color:#c9d1d9;padding:20px}' +
    'h1{color:#58a6ff;font-size:24px;margin-bottom:4px}' +
    '.subtitle{color:#8b949e;font-size:14px;margin-bottom:20px}' +
    '.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}' +
    '.stat{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;text-align:center}' +
    '.stat .value{font-size:28px;font-weight:600}' +
    '.stat .label{font-size:12px;color:#8b949e;margin-top:4px}' +
    '.stat.pass .value{color:#3fb950}' +
    '.stat.fail .value{color:#f85149}' +
    '.stat.skip .value{color:#d29922}' +
    '.stat.score .value{color:#58a6ff}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:20px}' +
    'th{text-align:left;padding:8px 12px;border-bottom:1px solid #30363d;color:#8b949e;font-size:12px;text-transform:uppercase}' +
    'td{padding:8px 12px;border-bottom:1px solid #21262d;font-size:14px}' +
    'tr:hover{background:#161b22}' +
    '.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}' +
    '.badge-pass{background:#1b3a1b;color:#3fb950}' +
    '.badge-fail{background:#3a1b1b;color:#f85149}' +
    '.badge-error{background:#3a1b1b;color:#f85149}' +
    '.badge-skip{background:#3a301b;color:#d29922}' +
    '.method{font-weight:600}' +
    '.path{font-family:monospace;color:#79c0ff}' +
    '.code{font-family:monospace}' +
    '.checks{display:flex;gap:4px}' +
    '.check{display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600}' +
    '.check.ok{background:#1b3a1b;color:#3fb950}' +
    '.check.fail{background:#3a1b1b;color:#f85149}' +
    '.check.na{background:#21262d;color:#484f58}' +
    '.errors{margin-top:4px}' +
    '.error{font-size:12px;color:#f85149;padding:2px 0}' +
    '.validations{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;margin-bottom:20px}' +
    '.validations h3{color:#c9d1d9;font-size:14px;margin-bottom:8px}' +
    '.validations ul{list-style:none}' +
    '.validations li{font-size:13px;padding:4px 0}' +
    '.val-error{color:#f85149}' +
    '.val-warning{color:#d29922}' +
    '.footer{text-align:center;color:#484f58;font-size:12px;padding:20px}' +
    '</style>\n</head>\n<body>' +
    '<h1>SpecShield Report</h1>' +
    '<div class="subtitle">' + escapeHtml(specTitle) + ' v' + escapeHtml(specVersion) + ' \u00B7 ' + (totalTime / 1000).toFixed(1) + 's \u00B7 ' + results.length + ' endpoints</div>' +
    '<div class="summary">' +
    '<div class="stat pass"><div class="value">' + passed + '</div><div class="label">Passed</div></div>' +
    '<div class="stat fail"><div class="value">' + failed + '</div><div class="label">Failed</div></div>' +
    '<div class="stat skip"><div class="value">' + skipped + '</div><div class="label">Skipped</div></div>' +
    '<div class="stat"><div class="value">' + errorCount + '</div><div class="label">Errors</div></div>' +
    '<div class="stat score"><div class="value">' + score + '/100</div><div class="label">API Score</div></div>' +
    '</div>' +
    validationsHtml +
    '<table>' +
    '<thead><tr><th>Status</th><th>Method</th><th>Path</th><th>Code</th><th>Checks</th><th>Time</th><th>Errors</th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<div class="footer">Generated by SpecShield v0.3.0</div>' +
    '</body>\n</html>';

  console.log(html);
}
