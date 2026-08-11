import type { DocumentStore, SuperGooseCore } from 'supergoose-core';
import type {
  DocumentData,
  DocumentListQuery,
  DocumentListResult,
  DocumentRecord
} from 'supergoose-core';
import type { MongoConnectionManager } from 'supergoose-infra';
import type { ResolvedTenantContext } from 'supergoose-infra';

export type SuperGooseHealthPort = Pick<SuperGooseCore, 'health'>;

export type SuperGooseReadyPort = Pick<MongoConnectionManager, 'health' | 'isConnected'>;

export interface SuperGooseDataPort {
  listDocuments(collectionName: string, query?: DocumentListQuery, store?: DocumentStore): Promise<DocumentListResult>;
  getDocumentById(collectionName: string, objectId: string, store?: DocumentStore): Promise<DocumentRecord>;
  createDocument(collectionName: string, document: DocumentData, store?: DocumentStore): Promise<DocumentRecord>;
  replaceDocument(collectionName: string, objectId: string, document: DocumentData, store?: DocumentStore): Promise<DocumentRecord>;
  patchDocument(collectionName: string, objectId: string, patch: DocumentData, store?: DocumentStore): Promise<DocumentRecord>;
  deleteDocument(collectionName: string, objectId: string, store?: DocumentStore): Promise<{ deleted: true }>;
}

export type ApiDocument = DocumentData;
export type ApiDocumentRecord = DocumentRecord;
export type ApiDocumentListQuery = DocumentListQuery;
export type ApiDocumentListResult = DocumentListResult;
export type SuperGooseTenantContext = ResolvedTenantContext;
