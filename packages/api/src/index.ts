import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ConfigLoadError, loadAppConfig } from 'supergoose-infra';
import { startServer } from './server';

/**
 * Walks upward from the provided directory until it finds a `.env` file.
 */
function findEnvFile(startDir: string): string | undefined {
  let currentDir = startDir;

  while (true) {
    const candidate = resolve(currentDir, '.env');

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}

const envFilePath = findEnvFile(process.cwd());

if (envFilePath) {
  loadEnv({ path: envFilePath });
}

/**
 * Loads configuration and starts the API process.
 */
async function main(): Promise<void> {
  try {
    const config = loadAppConfig(process.env);

    await startServer(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown configuration error';

    if (error instanceof ConfigLoadError) {
      console.error(message);
    } else {
      console.error(`Failed to start SuperGoose API: ${message}`);
    }

    process.exitCode = 1;
  }
}

/**
 * Starts the entrypoint bootstrap sequence.
 */
void main();
