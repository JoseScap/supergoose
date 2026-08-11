/**
 * Base error type for domain and infrastructure failures.
 */
export class SuperGooseError extends Error {
  /**
   * Creates a domain error with a stable code and HTTP status.
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Error thrown when a collection cannot be found.
 */
export class CollectionNotFoundError extends SuperGooseError {
  /**
   * Creates a not-found error for a missing collection.
   */
  constructor(collectionName: string) {
    super(`Collection not found: ${collectionName}`, 'CollectionNotFound', 404);
  }
}

/**
 * Error thrown when an ObjectId does not match MongoDB format.
 */
export class InvalidObjectIdError extends SuperGooseError {
  /**
   * Creates a validation error for malformed ObjectId strings.
   */
  constructor(objectId: string) {
    super(`Invalid ObjectId: ${objectId}`, 'InvalidObjectId', 400);
  }
}

/**
 * Error thrown when a document does not exist in a collection.
 */
export class DocumentNotFoundError extends SuperGooseError {
  /**
   * Creates a not-found error for a missing document.
   */
  constructor(collectionName: string, objectId: string) {
    super(`Document not found in ${collectionName}: ${objectId}`, 'DocumentNotFound', 404);
  }
}

/**
 * Error thrown when the data store is not connected.
 */
export class DatabaseDisconnectedError extends SuperGooseError {
  /**
   * Creates an error indicating the data store is unavailable.
   */
  constructor() {
    super('Database is disconnected', 'DatabaseDisconnected', 503);
  }
}
