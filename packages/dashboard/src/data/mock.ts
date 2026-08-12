import type { ClusterModel, DataDocument, ProjectModel } from '../types';

function document(value: DataDocument): DataDocument {
  return value;
}

const warehouseProject: ProjectModel = {
  id: '000000000000000000000101',
  name: 'Warehouse',
  slug: 'warehouse',
  status: 'active',
  description: 'Merchandising catalog and inventory management for the commerce team.',
  databaseName: 'warehouse',
  lastSync: '2026-08-11T18:20:00.000Z',
  apiKeyPrefix: '4Lk2',
  collections: [
    {
      name: 'products',
      indexes: 4,
      updatedAt: '2026-08-11T17:58:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000001',
          name: 'Merino Jacket',
          sku: 'JK-001',
          status: 'published',
          price: 199.99,
          stock: 42,
          category: 'outerwear',
          updatedAt: '2026-08-11T17:40:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000002',
          name: 'Trail Boot',
          sku: 'BT-017',
          status: 'draft',
          price: 249.5,
          stock: 18,
          category: 'footwear',
          updatedAt: '2026-08-11T17:43:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000003',
          name: 'Canvas Backpack',
          sku: 'BP-033',
          status: 'published',
          price: 89,
          stock: 61,
          category: 'accessories',
          updatedAt: '2026-08-11T17:46:00.000Z'
        })
      ]
    },
    {
      name: 'customers',
      indexes: 3,
      updatedAt: '2026-08-11T17:50:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000011',
          name: 'Ava Johnson',
          email: 'ava@example.com',
          status: 'active',
          segment: 'premium',
          orders: 12,
          updatedAt: '2026-08-11T17:50:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000012',
          name: 'Noah Patel',
          email: 'noah@example.com',
          status: 'trial',
          segment: 'new',
          orders: 2,
          updatedAt: '2026-08-11T17:52:00.000Z'
        })
      ]
    },
    {
      name: 'orders',
      indexes: 5,
      updatedAt: '2026-08-11T18:02:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000021',
          orderNo: 'W-10023',
          total: 389.48,
          status: 'fulfilled',
          customer: 'Ava Johnson',
          lineItems: 4,
          updatedAt: '2026-08-11T18:00:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000022',
          orderNo: 'W-10024',
          total: 112.0,
          status: 'pending',
          customer: 'Noah Patel',
          lineItems: 1,
          updatedAt: '2026-08-11T18:02:00.000Z'
        })
      ]
    }
  ]
};

const analyticsProject: ProjectModel = {
  id: '000000000000000000000102',
  name: 'Analytics',
  slug: 'analytics',
  status: 'syncing',
  description: 'Event pipeline and product analytics for the internal growth team.',
  databaseName: 'analytics',
  lastSync: '2026-08-11T18:11:00.000Z',
  apiKeyPrefix: 'Q9xM',
  collections: [
    {
      name: 'events',
      indexes: 3,
      updatedAt: '2026-08-11T18:09:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000101',
          event: 'page_view',
          path: '/pricing',
          userId: 'usr_1042',
          source: 'organic',
          updatedAt: '2026-08-11T18:06:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000102',
          event: 'signup',
          path: '/register',
          userId: 'usr_2048',
          source: 'referral',
          updatedAt: '2026-08-11T18:08:00.000Z'
        })
      ]
    },
    {
      name: 'funnels',
      indexes: 2,
      updatedAt: '2026-08-11T18:07:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000111',
          name: 'Activation funnel',
          stage: 'trial',
          conversion: 0.42,
          updatedAt: '2026-08-11T18:07:00.000Z'
        })
      ]
    }
  ]
};

const operationsProject: ProjectModel = {
  id: '000000000000000000000103',
  name: 'Operations',
  slug: 'operations',
  status: 'maintenance',
  description: 'Internal workflows, approvals and cluster coordination data.',
  databaseName: 'operations',
  lastSync: '2026-08-11T16:44:00.000Z',
  apiKeyPrefix: 'mN8r',
  collections: [
    {
      name: 'tasks',
      indexes: 3,
      updatedAt: '2026-08-11T16:40:00.000Z',
      documents: [
        document({
          _id: '66b8d4b8f1f2a1f000000201',
          title: 'Rotate expired API key',
          owner: 'ops@supergoose.dev',
          priority: 'high',
          status: 'open',
          updatedAt: '2026-08-11T16:41:00.000Z'
        }),
        document({
          _id: '66b8d4b8f1f2a1f000000202',
          title: 'Audit collection access',
          owner: 'security@supergoose.dev',
          priority: 'medium',
          status: 'review',
          updatedAt: '2026-08-11T16:42:00.000Z'
        })
      ]
    }
  ]
};

export const clusterModel: ClusterModel = {
  name: 'SuperGoose Cluster',
  status: 'ready',
  environment: 'self-hosted',
  projects: [warehouseProject, analyticsProject, operationsProject]
};

export function getProjectBySlug(slug: string): ProjectModel | undefined {
  return clusterModel.projects.find((project) => project.slug === slug);
}

export function getProjectStats(project: ProjectModel): {
  collections: number;
  documents: number;
  indexes: number;
} {
  return project.collections.reduce(
    (stats, collection) => ({
      collections: stats.collections + 1,
      documents: stats.documents + collection.documents.length,
      indexes: stats.indexes + collection.indexes
    }),
    { collections: 0, documents: 0, indexes: 0 }
  );
}

export function getClusterStats() {
  const projects = clusterModel.projects.length;
  const collections = clusterModel.projects.reduce((total, project) => total + project.collections.length, 0);
  const documents = clusterModel.projects.reduce(
    (total, project) => total + project.collections.reduce((collectionTotal, collection) => collectionTotal + collection.documents.length, 0),
    0
  );

  return { projects, collections, documents };
}
