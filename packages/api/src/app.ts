import express, { type Express, type Request, type Response, type RequestHandler, type Router } from 'express';
import { createStatusRouter } from './routes/health';
import { createResourceRouter } from './routes/resources';
import { errorRequestHandler } from './errors';
import type { SuperGooseDataPort, SuperGooseHealthPort, SuperGooseReadyPort } from './types';

/**
 * Sends the default 404 response for unknown routes.
 */
function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not Found' });
}

/**
 * Builds the Express application with health, CRUD and error-handling middleware.
 */
export function createApp(
  core: SuperGooseHealthPort,
  mongo: SuperGooseReadyPort,
  data: SuperGooseDataPort,
  authMiddleware?: RequestHandler,
  publicRouter?: Router
): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));
  app.use(createStatusRouter(core, mongo));
  if (publicRouter) {
    app.use(publicRouter);
  }
  app.use(createResourceRouter(data, authMiddleware));
  app.use(notFoundHandler);
  app.use(errorRequestHandler);

  return app;
}
