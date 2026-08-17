import type { Server } from 'node:http';
import process from 'node:process';
import { createSuperGooseCore } from 'supergoose-core';
import type { AppConfig } from 'supergoose-infra';
import { createMongoConnectionManager, createMongoControlPlane } from 'supergoose-infra';
import { createApp } from './app';
import { createDashboardRouter } from './routes/dashboard';
import { createTenantAuthMiddleware } from './auth';

/**
 * Starts the HTTP server and wires MongoDB, control plane and tenant auth.
 */
export async function startServer(
  config: AppConfig,
  core = createSuperGooseCore(),
  mongo = createMongoConnectionManager()
): Promise<Server> {
  await mongo.connect({
    mongoDbUri: config.mongoDbUri,
    databaseName: config.controlDatabaseName
  });

  const controlPlane = createMongoControlPlane(mongo, config.controlDatabaseName);
  await controlPlane.ensureCollections();

  if (config.rootUsername && config.rootPassword) {
    await controlPlane.bootstrapRootUser(config.rootUsername, config.rootPassword);
  }

  core.setDocumentStore(mongo.createDocumentStore(config.controlDatabaseName));

  const authMiddleware = createTenantAuthMiddleware(controlPlane);
  const dashboardRouter = createDashboardRouter(controlPlane, mongo, core);

  const app = createApp(
    {
      health: () => core.health({ mongodb: mongo.health() })
    },
    mongo,
    core,
    config.corsOrigins,
    authMiddleware,
    undefined,
    dashboardRouter
  );
  const host = process.env.HOST?.trim();
  const server = host ? app.listen(config.port, host, () => {
    console.log(`SuperGoose API listening on ${host}:${config.port}`);
  }) : app.listen(config.port, () => {
    console.log(`SuperGoose API listening on port ${config.port}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    console.log(`Received ${signal}, shutting down SuperGoose API...`);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    await mongo.disconnect();
  };

  const handleSignal = (signal: string): void => {
    void shutdown(signal).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown shutdown error';

      console.error(`Failed to shut down SuperGoose API: ${message}`);
      process.exitCode = 1;
    });
  };

  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));

  return server;
}
