# SuperGoose

SuperGoose es un backend multi-tenant para MongoDB. La primera release oficial del producto es `0.0.1`.

Lee este documento en ingles: [README.md](README.md)

## Requisitos

- Node.js 22+
- npm 10+
- Una instancia de MongoDB accesible por connection string

## Entorno de runtime

El contrato de runtime usa estas variables de entorno:

- `MONGODB_URI`
- `PORT` opcional, por defecto `3000`
- `NODE_ENV` opcional, por defecto `development`
- `SUPERGOOSE_ROOT_USERNAME` opcional, inicializa el primer usuario root del dashboard
- `SUPERGOOSE_ROOT_PASSWORD` opcional, inicializa el primer usuario root del dashboard

La base de control interna es fija y no se configura por variable de entorno.

Si se definen `SUPERGOOSE_ROOT_USERNAME` y `SUPERGOOSE_ROOT_PASSWORD`, la API inyecta ese usuario root en `supergoose_control` al iniciar cuando ese username todavía no existe.

## Arranque local

```bash
npm install
npm test
npm run test:coverage
npm run dev
```

`npm run test:coverage` genera:

- un resumen de texto en la terminal
- un reporte `lcov`
- un reporte HTML en `coverage/`

## Docker

Construir la imagen de produccion:

```bash
docker build -t supergoose:0.0.1 .
```

Ejecutar el contenedor con envs manuales:

```bash
docker run --rm -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/supergoose" \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e SUPERGOOSE_ROOT_USERNAME="root" \
  -e SUPERGOOSE_ROOT_PASSWORD="change-me" \
  supergoose:0.0.1
```

Despues de iniciar la API, abre el dashboard y autenticate con ese usuario y password root cuando el navegador lo solicite.

Si MongoDB corre en tu host sobre Linux, agrega:

```bash
--add-host=host.docker.internal:host-gateway
```

Validar health y readiness:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Detener el contenedor de forma limpia:

```bash
docker stop <container_id>
```

## Uso basico de la API

Crear un proyecto y recibir la API key inicial una sola vez:

```bash
curl -s -X POST http://localhost:3000/projects \
  -H "content-type: application/json" \
  -d '{
    "name": "Warehouse",
    "slug": "warehouse"
  }'
```

Listar una collection permitida:

```bash
curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  http://localhost:3000/api/warehouse/products
```

Crear un documento:

```bash
curl -s -X POST http://localhost:3000/api/warehouse/products \
  -H "Authorization: Bearer <API_KEY>" \
  -H "content-type: application/json" \
  -d '{
    "name": "Campera",
    "price": 199.99,
    "status": "draft"
  }'
```

Actualizar parcialmente:

```bash
curl -s -X PATCH http://localhost:3000/api/warehouse/products/<DOCUMENT_ID> \
  -H "x-api-key: <API_KEY>" \
  -H "content-type: application/json" \
  -d '{
    "status": "published"
  }'
```

Eliminar un documento:

```bash
curl -s -X DELETE http://localhost:3000/api/warehouse/products/<DOCUMENT_ID> \
  -H "x-api-key: <API_KEY>"
```

Rotar una API key perdida:

```bash
curl -s -X POST http://localhost:3000/projects/<PROJECT_ID>/api-keys/rotate \
  -H "content-type: application/json" \
  -d '{"scopes":["documents:*"]}'
```

Listar metadata de API keys sin exponer el secreto:

```bash
curl -s http://localhost:3000/projects/<PROJECT_ID>/api-keys
```

## Seguridad basica

- Las collections internas estan bloqueadas.
- Los payloads y filtros se validan antes de llegar a MongoDB.
- Los listados de API keys nunca exponen el valor secreto.
- La API key completa solo se devuelve al crear o rotar una key.

## Version

`GET /health` reporta la version publicada del producto. Para esta release debe ser `0.0.1`.

## Licencia

SuperGoose se distribuye bajo la licencia no comercial personalizada en [LICENSE](LICENSE). Permite uso, modificacion, integracion y redistribucion no comerciales con atribucion, pero no permite reventa, hosting pago, acceso por suscripcion ni ningun otro servicio comercial construido alrededor de SuperGoose.
