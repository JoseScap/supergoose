import { SuperGooseError } from './errors';

const RESERVED_COLLECTION_NAMES = new Set(['projects', 'api_keys', 'project_connections', 'supergoose_control']);

/**
 * Returns true when a field name could be used for prototype or query injection.
 */
export function isDangerousKey(key: string): boolean {
  return key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Returns true when a collection name is reserved for internal SuperGoose use.
 */
export function isReservedCollectionName(collectionName: string): boolean {
  const normalized = collectionName.trim().toLowerCase();

  return normalized.startsWith('system.') || RESERVED_COLLECTION_NAMES.has(normalized);
}

/**
 * Normalizes a collection name and rejects internal or empty names.
 */
export function normalizeCollectionName(collectionName: string): string {
  const trimmed = collectionName.trim();

  if (!trimmed) {
    throw new SuperGooseError('Collection name cannot be empty', 'InvalidCollectionName', 400);
  }

  if (isReservedCollectionName(trimmed)) {
    throw new SuperGooseError('Collection name is reserved', 'ReservedCollection', 403);
  }

  return trimmed;
}

/**
 * Throws when an object, array or nested structure contains dangerous field names.
 */
export function assertSafeDocumentData(value: unknown, errorCode = 'InvalidPayload'): void {
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }

      return;
    }

    if (!current || typeof current !== 'object') {
      return;
    }

    const prototype = Object.getPrototypeOf(current);

    if (prototype !== Object.prototype && prototype !== null) {
      return;
    }

    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (isDangerousKey(key)) {
        throw new SuperGooseError(`Dangerous field rejected: ${key}`, errorCode, 400);
      }

      visit(child);
    }
  };

  visit(value);
}
