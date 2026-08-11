import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigLoadError, loadAppConfig } from '../src/config';

test('loadAppConfig applies sensible defaults for optional values', () => {
  const config = loadAppConfig({
    MONGODB_URI: 'mongodb://localhost:27017/supergoose'
  });

  assert.equal(config.port, 3000);
  assert.equal(config.nodeEnv, 'development');
  assert.equal(config.mongoDbUri, 'mongodb://localhost:27017/supergoose');
  assert.equal(config.controlDatabaseName, 'supergoose_control');
});

test('loadAppConfig reads explicit values when present', () => {
  const config = loadAppConfig({
    PORT: '4000',
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://db.example.com:27017/supergoose'
  });

  assert.equal(config.port, 4000);
  assert.equal(config.nodeEnv, 'production');
  assert.equal(config.mongoDbUri, 'mongodb://db.example.com:27017/supergoose');
  assert.equal(config.controlDatabaseName, 'supergoose_control');
});

test('loadAppConfig rejects invalid PORT values', () => {
  assert.throws(
    () =>
      loadAppConfig({
        PORT: 'abc',
        MONGODB_URI: 'mongodb://localhost:27017/supergoose'
      }),
    (error: unknown) => error instanceof ConfigLoadError && error.message.includes('Invalid PORT value: abc')
  );
});

test('loadAppConfig rejects missing MONGODB_URI', () => {
  assert.throws(
    () => loadAppConfig({}),
    (error: unknown) =>
      error instanceof ConfigLoadError && error.message === 'Missing required environment variable: MONGODB_URI'
  );
});
