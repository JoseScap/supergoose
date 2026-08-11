import { Router, type Request, type Response, type NextFunction } from 'express';
import type { SuperGooseHealthPort, SuperGooseReadyPort } from '../types';

/**
 * Handles the `/health` endpoint.
 */
export async function handleHealth(_req: Request, res: Response, next: NextFunction, core: SuperGooseHealthPort): Promise<void> {
  try {
    const health = await Promise.resolve(core.health());
    res.status(200).json(health);
  } catch (error) {
    next(error);
  }
}

/**
 * Handles the `/ready` endpoint.
 */
export async function handleReady(_req: Request, res: Response, next: NextFunction, mongo: SuperGooseReadyPort): Promise<void> {
  try {
    const mongodb = await Promise.resolve(mongo.health());

    if (!mongo.isConnected()) {
      res.status(503).json({
        ok: false,
        status: 'not_ready',
        mongodb
      });
      return;
    }

    res.status(200).json({
      ok: true,
      status: 'ready',
      mongodb
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Builds the router for service health endpoints.
 */
export function createStatusRouter(core: SuperGooseHealthPort, mongo: SuperGooseReadyPort): Router {
  const router = Router();

  router.get('/health', (req, res, next) => {
    void handleHealth(req, res, next, core);
  });

  router.get('/ready', (req, res, next) => {
    void handleReady(req, res, next, mongo);
  });

  return router;
}
