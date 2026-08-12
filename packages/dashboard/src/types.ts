export type ProjectStatus = 'active' | 'syncing' | 'maintenance';

export interface DataDocument {
  _id: string;
  [key: string]: unknown;
}

export interface CollectionModel {
  name: string;
  documents: DataDocument[];
  updatedAt: string;
  indexes: number;
}

export interface ProjectModel {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  description: string;
  databaseName: string;
  lastSync: string;
  apiKeyPrefix: string;
  collections: CollectionModel[];
}

export interface ClusterModel {
  name: string;
  status: 'ready';
  environment: string;
  projects: ProjectModel[];
}
