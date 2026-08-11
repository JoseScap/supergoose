export { createSuperGooseCore, SuperGooseCore } from './core';
export { CollectionNotFoundError, DatabaseDisconnectedError, DocumentNotFoundError, InvalidObjectIdError, SuperGooseError } from './errors';
export type { DocumentData, DocumentListQuery, DocumentListResult, DocumentRecord, DocumentStore } from './data';
export type { InfrastructureHealthSnapshot, MongoConnectionHealth, SuperGooseCoreHealth, SuperGooseCoreOptions } from './types';
export { stripMongoId } from './core';
export { assertSafeDocumentData, isDangerousKey, isReservedCollectionName, normalizeCollectionName } from './security';
export {
  generateApiKeyMaterial,
  parseApiKey,
  verifyApiKey
} from './api-keys';
export type {
  GeneratedApiKeyMaterial,
  ParsedApiKey
} from './api-keys';
