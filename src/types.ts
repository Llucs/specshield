export interface SpecEndpoint {
  path: string;
  method: string;
  summary?: string;
  operation: Record<string, unknown>;
}

export interface CheckConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number;
  additionalParams: Record<string, string>;
  skipMethods: Set<string>;
  onlyMethods: Set<string> | null;
  verbose: boolean;
  color: boolean;
}

export interface CheckEntry {
  path: string;
  method: string;
  summary: string;
  url: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  statusCodeValid: boolean | null;
  expectedStatus: string;
  actualStatus: number | null;
  schemaValid: boolean | null;
  contentTypeValid: boolean | null;
  errors: string[];
  durationMs: number;
  skippedReason?: string;
}
