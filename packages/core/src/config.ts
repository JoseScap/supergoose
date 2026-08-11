export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoDbUri: string;
  controlDatabaseName: string;
}

export type AppConfigEnv = Record<string, string | undefined>;

/**
 * Represents a configuration value that is missing or invalid.
 */
export class ConfigLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/**
 * Reads a required string environment variable and trims whitespace.
 */
function readRequiredString(env: AppConfigEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new ConfigLoadError(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * Reads an optional string environment variable and falls back when missing.
 */
function readOptionalString(env: AppConfigEnv, key: string, fallback: string): string {
  const value = env[key]?.trim();

  return value ? value : fallback;
}

/**
 * Reads and validates a numeric port environment variable.
 */
function readPort(env: AppConfigEnv, key: string, fallback: number): number {
  const raw = env[key];

  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new ConfigLoadError(`Invalid ${key} value: ${raw}. Expected a positive integer between 1 and 65535.`);
  }

  return port;
}

/**
 * Loads the application configuration from environment variables.
 */
export function loadAppConfig(env: AppConfigEnv): AppConfig {
  return {
    port: readPort(env, 'PORT', 3000),
    nodeEnv: readOptionalString(env, 'NODE_ENV', 'development'),
    mongoDbUri: readRequiredString(env, 'MONGODB_URI'),
    controlDatabaseName: 'supergoose_control'
  };
}
