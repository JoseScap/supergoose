export interface SuperGooseCoreHealth {
  ok: true;
  service: 'supergoose-core';
  version: string;
  timestamp: string;
  mongodb?: MongoConnectionHealth;
}

export interface MongoConnectionHealth {
  status: 'disconnected' | 'connecting' | 'connected';
  databaseName?: string;
}

export interface InfrastructureHealthSnapshot {
  mongodb: MongoConnectionHealth;
}

export interface SuperGooseCoreOptions {
  version?: string;
  now?: () => Date;
}
