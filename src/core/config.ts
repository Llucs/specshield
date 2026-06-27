import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import type { SpecShieldConfig } from './types.js';

const CONFIG_FILES = ['specshield.yaml', 'specshield.yml', '.specshield.yaml', '.specshield.yml'];

export function findConfigFile(startDir?: string): string | null {
  const dir = startDir || process.cwd();
  for (const name of CONFIG_FILES) {
    const fullPath = dir + '/' + name;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

export function loadConfigFile(configPath: string): SpecShieldConfig {
  if (!existsSync(configPath)) {
    throw new Error('Config file not found: ' + configPath);
  }
  const content = readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(content) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid config file: ' + configPath);
  }
  return parsed as SpecShieldConfig;
}

export function loadConfigFromDir(configPath?: string): SpecShieldConfig | null {
  if (configPath) {
    return loadConfigFile(configPath);
  }
  const found = findConfigFile();
  if (found) {
    return loadConfigFile(found);
  }
  return null;
}
