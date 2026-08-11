import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SuperGooseError } from 'supergoose-core';
import type { MongoControlPlane } from 'supergoose-infra';
import type { SuperGooseTenantContext } from './types';

/**
 * Extracts the API key from a Bearer token or `x-api-key` header.
 */
function readBearerToken(req: Request): string | undefined {
  const authorization = req.header?.('authorization') ?? req.header?.('Authorization');

  if (authorization) {
    const match = authorization.match(/^Bearer\s+(.+)$/i);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const apiKey = req.header?.('x-api-key') ?? req.header?.('X-API-Key');

  if (apiKey) {
    return apiKey.trim();
  }

  return undefined;
}

/**
 * Stores the resolved tenant context on the request object.
 */
function attachTenant(req: Request, tenant: SuperGooseTenantContext): void {
  (req as Request & { supergooseTenant?: SuperGooseTenantContext }).supergooseTenant = tenant;
}

/**
 * Creates middleware that authenticates requests against the control plane and attaches the tenant context.
 */
export function createTenantAuthMiddleware(
  controlPlane: MongoControlPlane
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const apiKey = readBearerToken(req);

      if (!apiKey) {
        throw new SuperGooseError('Missing API key', 'Unauthorized', 401);
      }

      const tenant = await controlPlane.resolveTenant(apiKey);

      if (!tenant) {
        throw new SuperGooseError('Invalid API key', 'Unauthorized', 401);
      }

      attachTenant(req, tenant);
      next();
    } catch (error) {
      next(error);
    }
  };
}
