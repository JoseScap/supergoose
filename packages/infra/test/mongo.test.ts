import assert from 'node:assert/strict';
import test from 'node:test';
import { createMongoConnectionManager } from '../src/mongo';
import type { MongoClientLike } from '../src/mongo';

/**
 * Creates a fake Mongo client that records connection lifecycle events.
 */
function createFakeMongoClient(state: { connected: boolean; closed: boolean }): MongoClientLike {
  return {
    async connect() {
      state.connected = true;
      return this;
    },
    async close() {
      state.closed = true;
    },
    db() {
      return {
        collection() {
          return {
            async findOne() {
              return null;
            },
            find() {
              return {
                async toArray() {
                  return [];
                }
              };
            },
            async insertOne() {
              return { insertedId: '000000000000000000000001' };
            },
            async replaceOne() {
              return { matchedCount: 0 };
            },
            async updateOne() {
              return { matchedCount: 0 };
            },
            async deleteOne() {
              return { deletedCount: 0 };
            }
          };
        },
        async createCollection() {
          return undefined;
        },
        listCollections() {
          return {
            async hasNext() {
              return false;
            }
          };
        }
      };
    }
  };
}

test('MongoConnectionManager supports connect, disconnect and on-demand collection creation', async () => {
  try {
    const disconnectedState = { connected: false, closed: false };
    const disconnectedMongo = createMongoConnectionManager({
      mongoClientFactory: () => createFakeMongoClient(disconnectedState)
    });

    assert.deepEqual(disconnectedMongo.health(), {
      status: 'disconnected'
    });
    assert.equal(disconnectedMongo.isConnected(), false);

    await disconnectedMongo.connect({
      mongoDbUri: 'mongodb://localhost:27017/supergoose',
      databaseName: 'supergoose'
    });

    assert.equal(disconnectedState.connected, true);
    assert.equal(disconnectedMongo.isConnected(), true);
    assert.deepEqual(disconnectedMongo.health(), {
      status: 'connected',
      databaseName: 'supergoose'
    });

    await disconnectedMongo.disconnect();

    assert.equal(disconnectedState.closed, true);
    assert.equal(disconnectedMongo.isConnected(), false);
    assert.deepEqual(disconnectedMongo.health(), {
      status: 'disconnected'
    });

    const createdCollections: string[] = [];
    const collectionState = { connected: false, closed: false };
    const collectionMongo = createMongoConnectionManager({
      mongoClientFactory: () =>
        ({
          async connect() {
            collectionState.connected = true;
            return this;
          },
          async close() {
            collectionState.closed = true;
          },
          db() {
            return {
              collection() {
                throw new Error('collection() should not be called in this test');
              },
              async createCollection(name: string) {
                createdCollections.push(name);
              },
            listCollections() {
              return {
                async hasNext() {
                  return false;
                }
                };
              }
            };
          }
        }) as MongoClientLike
    });

    await collectionMongo.connect({
      mongoDbUri: 'mongodb://localhost:27017/supergoose',
      databaseName: 'supergoose'
    });

    await collectionMongo.ensureCollection('widgets');

    assert.deepEqual(createdCollections, ['widgets']);

    await collectionMongo.disconnect();
    assert.equal(collectionState.closed, true);
  } catch (error) {
    console.error(error);
    throw error;
  }
});
