# Vilkas — frontend

The resident app and the municipality dashboards (Vite + React + TypeScript).
`src/api/` is a typed client for `api/openapi.yaml`; the screens and phases are
described in `planning/FRONTEND_PLAN.md`.

## Run it against the backend

```bash
# terminal 1 — the API (from the repository root)
uv --directory ./src/backend run python manage.py runserver

# terminal 2 — the app
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/media` to the
Django dev server at `http://127.0.0.1:8000`, so the browser sees one origin
and no CORS setup is needed. Point it elsewhere with `VITE_BACKEND_URL`:

```bash
VITE_BACKEND_URL=http://192.168.1.10:8000 npm run dev
```

A fresh database has no categories or districts, which leaves an empty map and
no way to report anything — seed it first:

```bash
uv --directory ./src/backend run python manage.py seed_demo --with-examples
```

## Run it without a backend

```bash
npm run dev:mocks
```

Serves every endpoint in the contract from [MSW](https://mswjs.io/) fixtures
(`src/mocks/`), including the api-gap extensions the backend doesn't have yet.
Pages always call the real `src/api` functions either way.

## Checks

```bash
npm run lint    # oxlint
npm run build   # tsc -b && vite build
```
