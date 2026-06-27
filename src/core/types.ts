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
  parallel?: number;
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

export interface DiffChange {
  type: 'breaking' | 'non-breaking';
  path: string;
  method: string;
  message: string;
}

export interface SpecShieldConfig {
  check?: {
    baseUrl?: string;
    headers?: Record<string, string>;
    timeout?: number;
    skipMethods?: string[];
    onlyMethods?: string[];
    params?: Record<string, string>;
    verbose?: boolean;
    report?: string;
    parallel?: number;
  };
  baseline?: string;
  watch?: boolean;
}

export interface SpecValidation {
  type: 'warning' | 'error';
  message: string;
  path?: string;
}

export interface BaselineEntry {
  method: string;
  path: string;
  errors: string[];
  status: 'fail' | 'error';
}

export interface BaselineData {
  version: string;
  createdAt: string;
  updatedAt: string;
  failures: BaselineEntry[];
}
