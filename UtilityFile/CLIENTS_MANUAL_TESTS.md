# Clients Module - Manual API Tests (Postman/cURL)

## Base setup
- Base URL: `http://localhost:5173/api` (via Vite proxy) oppure `http://localhost:4000`
- Required auth headers (dev mode):
  - `x-user-id` oppure `x-user-email`
  - `x-workspace-id` oppure `x-workspace-slug`

Example common headers:

```http
x-user-email: superadmin@demo.local
x-workspace-slug: demo
Content-Type: application/json
Accept: application/json
```

## 1) List clients (200)

```bash
curl -X GET "http://localhost:5173/api/clients?query=rossi&page=1&pageSize=20&sort=-updatedAt" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo" \
  -H "Accept: application/json"
```

Expected:
- Status `200`
- JSON shape:

```json
{
  "data": {
    "items": [],
    "pageInfo": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 0,
      "totalPages": 0,
      "hasNextPage": false,
      "hasPrevPage": false
    },
    "filters": {
      "query": "rossi",
      "sort": "-updatedAt"
    }
  }
}
```

## 2) Create client (201)

```bash
curl -X POST "http://localhost:5173/api/clients" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"company\",
    \"name\": \"Rossi SRL\",
    \"email\": \"info@rossi.it\",
    \"phone\": \"+39 333 1234567\",
    \"vatNumber\": \"IT12345678901\",
    \"taxCode\": \"12345678901\",
    \"address\": {
      \"street\": \"Via Roma 10\",
      \"city\": \"Milano\",
      \"zip\": \"20100\",
      \"province\": \"MI\",
      \"country\": \"IT\"
    },
    \"notes\": \"Cliente prioritario\",
    \"tags\": [\"vip\", \"b2b\"]
  }"
```

Expected:
- Status `201`
- `data.client.id` valorizzato
- `data.client.workspaceId` coerente con header workspace
- `data.client.email` normalizzata lowercase

## 3) Get detail (200)

```bash
curl -X GET "http://localhost:5173/api/clients/<CLIENT_ID>" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo"
```

Expected:
- Status `200`
- JSON: `{ "data": { "client": { ... } } }`

## 4) Patch client (200)

```bash
curl -X PATCH "http://localhost:5173/api/clients/<CLIENT_ID>" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"+39 02 123456\",
    \"notes\": \"Aggiornato da test manuale\",
    \"address\": {
      \"city\": \"Torino\"
    }
  }"
```

Expected:
- Status `200`
- `data.client.phone` e `data.client.address.city` aggiornati

## 5) Delete client (204)

```bash
curl -X DELETE "http://localhost:5173/api/clients/<CLIENT_ID>" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo"
```

Expected:
- Status `204`
- Body vuoto

## 6) Error case: 401 unauthorized

```bash
curl -X GET "http://localhost:5173/api/clients"
```

Expected:
- Status `401`
- `error.code = "UNAUTHORIZED"`

## 7) Error case: 400 workspace header missing

```bash
curl -X GET "http://localhost:5173/api/clients" \
  -H "x-user-email: superadmin@demo.local"
```

Expected:
- Status `400`
- `error.code = "BAD_REQUEST"`
- `error.details.expected` contains `x-workspace-id` and `x-workspace-slug`

## 8) Error case: 403 module disabled or missing permission
- Disable module `clients` for workspace OR test with user without `clients.view`.

```bash
curl -X GET "http://localhost:5173/api/clients" \
  -H "x-user-email: user-without-client-permissions@demo.local" \
  -H "x-workspace-slug: demo"
```

Expected:
- Status `403`
- `error.code = "FORBIDDEN"`

## 9) Error case: 404 client not found

```bash
curl -X GET "http://localhost:5173/api/clients/cl_missing_client_id" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo"
```

Expected:
- Status `404`
- `error.code = "NOT_FOUND"`

## 10) Error case: 400 validation

```bash
curl -X POST "http://localhost:5173/api/clients" \
  -H "x-user-email: superadmin@demo.local" \
  -H "x-workspace-slug: demo" \
  -H "Content-Type: application/json" \
  -d "{ \"name\": \"\", \"email\": \"not-an-email\" }"
```

Expected:
- Status `400`
- `error.code = "BAD_REQUEST"`
- `error.message` esplicita il campo invalido
