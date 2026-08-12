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
 * Applies CORS headers for the dashboard and API clients that send cookies.
 */
function createCorsMiddleware(allowedOrigins: string[]): RequestHandler {
  const normalizedOrigins = new Set(allowedOrigins.map((origin) => origin.trim()).filter(Boolean));

  return (req: Request, res: Response, next) => {
    const origin = req.header('origin');

    if (origin && normalizedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-api-key, x-requested-with');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Builds the Express application with health, CRUD and error-handling middleware.
 */
export function createApp(
  core: SuperGooseHealthPort,
  mongo: SuperGooseReadyPort,
  data: SuperGooseDataPort,
  corsOrigins: string[],
  authMiddleware?: RequestHandler,
  publicRouter?: Router,
  dashboardRouter?: Router
): Express {
  const app = express();

  app.use(createCorsMiddleware(corsOrigins));
  app.use(express.json({ limit: '100kb' }));
  app.use(createStatusRouter(core, mongo));
  if (dashboardRouter) {
    app.use(dashboardRouter);
  }
  if (publicRouter) {
    app.use(publicRouter);
  }
  app.use(createResourceRouter(data, authMiddleware));
  app.use(notFoundHandler);
  app.use(errorRequestHandler);

  return app;
}
