# SuperGoose

SuperGoose is a multi-tenant backend for MongoDB. The first official product release is `0.0.1`.

Read this document in Spanish: [README.es.md](README.es.md)

## Requirements

- Node.js 22+
- npm 10+
- A MongoDB instance reachable through a connection string

## Runtime Environment

The runtime contract uses these environment variables:

- `MONGODB_URI`
- `PORT` optional, defaults to `3000`
- `NODE_ENV` optional, defaults to `development`

The internal control database is fixed and is not configured through an environment variable.

## Local Setup

```bash
npm install
npm test
npm run test:coverage
npm run dev
```

`npm run test:coverage` generates:

- a text summary in the terminal
- an `lcov` report
- an HTML report under `coverage/`

## Docker

Build the production image:

```bash
docker build -t supergoose:0.0.1 .
```

Run the container with manual env vars:

```bash
docker run --rm -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/supergoose" \
  -e PORT=3000 \
  -e NODE_ENV=production \
  supergoose:0.0.1
```

If MongoDB runs on your host on Linux, add:

```bash
--add-host=host.docker.internal:host-gateway
```

Validate health and readiness:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Stop the container cleanly:

```bash
docker stop <container_id>
```

## Basic API Usage

Create a project and receive the initial API key once:

```bash
curl -s -X POST http://localhost:3000/projects \
  -H "content-type: application/json" \
  -d '{
    "name": "Warehouse",
    "slug": "warehouse"
  }'
```

List a permitted collection:

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  http://localhost:3000/api/warehouse/products
```

Create a document:

```bash
curl -s -X POST http://localhost:3000/api/warehouse/products \
  -H "Authorization: Bearer <API_KEY>" \
  -H "content-type: application/json" \
  -d '{
    "name": "Jacket",
    "price": 199.99,
    "status": "draft"
  }'
```

Patch a document:

```bash
curl -s -X PATCH http://localhost:3000/api/warehouse/products/<DOCUMENT_ID> \
  -H "x-api-key: <API_KEY>" \
  -H "content-type: application/json" \
  -d '{
    "status": "published"
  }'
```

Delete a document:

```bash
curl -s -X DELETE http://localhost:3000/api/warehouse/products/<DOCUMENT_ID> \
  -H "x-api-key: <API_KEY>"
```

Rotate a lost API key:

```bash
curl -s -X POST http://localhost:3000/projects/<PROJECT_ID>/api-keys/rotate \
  -H "content-type: application/json" \
  -d '{"scopes":["documents:*"]}'
```

List API key metadata without exposing the secret:

```bash
curl -s http://localhost:3000/projects/<PROJECT_ID>/api-keys
```

## Security Basics

- Internal collections are blocked.
- Payloads and filters are validated before they reach MongoDB.
- API key listings never expose the secret value.
- The full API key is only returned when a key is created or rotated.

## Version

`GET /health` reports the published product version. For this release, it must be `0.0.1`.

## License

SuperGoose is distributed under the custom non-commercial license in [LICENSE](LICENSE). It allows non-commercial use, modification, integration, and redistribution with attribution, but it does not allow resale, paid hosting, subscription access, or any other commercial service built around SuperGoose.
