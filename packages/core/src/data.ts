export type DocumentData = Record<string, unknown>;

export interface DocumentRecord extends DocumentData {
  _id: string;
}

export interface DocumentListQuery {
  filter?: DocumentData;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface DocumentListResult {
  documents: DocumentRecord[];
  total: number;
  limit: number;
  skip: number;
}

export interface DocumentStore {
  /**
   * Ensures a collection exists before it is used.
   */
  ensureCollection(collectionName: string): Promise<void>;
  /**
   * Finds a single document by ObjectId.
   */
  findOne(collectionName: string, objectId: string): Promise<DocumentRecord | null>;
  /**
   * Lists documents using an optional filter and paging query.
   */
  findMany(collectionName: string, query?: DocumentListQuery): Promise<DocumentListResult>;
  /**
   * Inserts a new document and returns the stored record.
   */
  insertOne(collectionName: string, document: DocumentData): Promise<DocumentRecord>;
  /**
   * Fully replaces a stored document.
   */
  replaceOne(collectionName: string, objectId: string, document: DocumentData): Promise<DocumentRecord | null>;
  /**
   * Applies a partial update to a stored document.
   */
  updateOne(collectionName: string, objectId: string, patch: DocumentData): Promise<DocumentRecord | null>;
  /**
   * Deletes a document by ObjectId.
   */
  deleteOne(collectionName: string, objectId: string): Promise<boolean>;
}
