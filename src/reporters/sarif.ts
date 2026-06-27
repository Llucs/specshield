import type { CheckEntry } from '../core/types.js';

export function printReportSarif(results: CheckEntry[], specTitle: string, specVersion: string): void {
  const sarifResults: Record<string, unknown>[] = [];

  for (const r of results) {
    if (r.status !== 'fail' && r.status !== 'error') continue;

    const message = r.errors.length > 0 ? r.errors.join('\n') : r.status === 'error' ? 'Request error' : 'Validation failure';
    const level = r.status === 'error' ? 'error' : 'warning';

    sarifResults.push({
      ruleId: 'specshield/' + r.status,
      level,
      message: {
        text: message,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: r.url || r.path,
            },
            region: {
              startLine: 1,
            },
          },
        },
      ],
      properties: {
        method: r.method,
        path: r.path,
        actualStatus: r.actualStatus,
        statusCodeValid: r.statusCodeValid,
        schemaValid: r.schemaValid,
        contentTypeValid: r.contentTypeValid,
      },
    });
  }

  const sarif = {
    version: '2.1.0',
    $schema: 'https://schemastore.astype/schemas/json/sarif-2.1.0-rtm.5.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'SpecShield',
            version: '0.3.0',
            informationUri: 'https://github.com/Llucs/specshield',
            rules: [
              {
                id: 'specshield/fail',
                name: 'specshield-fail',
                shortDescription: { text: 'Endpoint response validation failed' },
                properties: { category: 'Validation' },
              },
              {
                id: 'specshield/error',
                name: 'specshield-error',
                shortDescription: { text: 'Endpoint request error' },
                properties: { category: 'Error' },
              },
            ],
          },
        },
        results: sarifResults,
        invocations: [
          {
            executionSuccessful: sarifResults.length === 0,
          },
        ],
      },
    ],
  };

  console.log(JSON.stringify(sarif, null, 2));
}
