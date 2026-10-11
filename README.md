# hack4vilnius
A gamified platform to report cities problems.

This project is made for the [Hack4Vilnius 2026](https://hack4vilnius.lt/) hackathon

## Backend

### Run apps
#### Setup
Have python, uv installed and run
```bash
uv sync
```

#### Usage
To start the server
```bash
uv --directory ./src/backend run python manage.py runserver
```
> View api schema with http://127.0.0.1:8000/api/schema/swagger-ui/

API docs (Swagger UI / ReDoc / raw OpenAPI schema) are served at:
- `/api/schema/swagger-ui/`
- `/api/schema/redoc/`
- `/api/schema/`

### Development
#### Setup
```bash
uv sync --group dev
```

#### Run tests and formatters
```bash
uv --directory ./src/backend run ruff format
uv --directory ./src/backend run ruff check
uv --directory ./src/backend run basedpyright
uv --directory ./src/backend run pytest
```

#### Run migrations and apply them
```bash
uv --directory ./src/backend run python manage.py makemigrations
uv --directory ./src/backend run python manage.py migrate
```

### Seed data
The app can't work on an empty database: `GET /categories` and `GET /districts`
back the report form and the map, and a problem can't exist without a category.

```bash
uv --directory ./src/backend run python manage.py seed_demo
```

That creates the institutions, the nine problem categories, the 21 Vilnius
seniūnijos, the badges and the challenges. Add `--with-examples` to also create
the nine example problems (the same ones the frontend's mock API serves) with
their reports and answers. Everything is keyed by name, so re-running updates
in place instead of duplicating.

### Address lookup
`GET /api/geocode?q=` turns a typed address into coordinates for the report
form. It proxies [Photon](https://photon.komoot.io/) (OpenStreetMap data);
point it at another instance with `GEOCODER_URL`, and identify your
deployment with `GEOCODER_USER_AGENT`.

### Priority and trust
Each open problem gets a 0–100 priority score with the reasons behind it, and
each resident a trust score learned from which of their reports and answers
proved right. How both work, with worked examples: `planning/PRIORITY.md`.
The weights live in `src/backend/problems/priority.py` and `trust.py`.

### Walking routes
The route planner ("Planuoti maršrutą" on the map) picks the problems most
worth checking within a time budget, in the app; `GET /api/routes/walk` turns
them into a path along streets. It proxies an OSRM router with a foot profile,
by default the public OpenStreetMap one, which is fine for light use; point
`WALKING_ROUTER_URL` at your own OSRM for more. Without it the planner draws
straight lines.

### Challenge rewards
When a challenge ends, each participant who reported or answered at least once
during it (in its categories, if it has any) gets its `reward_points`. That
happens whenever the challenge list is read, and can also be run on a schedule
(for example daily from cron or Windows Task Scheduler):

```bash
uv --directory ./src/backend run python manage.py settle_challenges
```

Nobody is paid twice, however often it runs.

### Demo mode: municipality tools without a staff login
There is no staff login screen yet, so by default (also in production) any
signed-in user may use the municipality endpoints: change a problem's status,
review moderation flags, read any report. Residents get an anonymous session
automatically, so the whole flow, `/city` dashboard included, works for anyone
who opens the app.

**This means anyone who can reach the server can act as the municipality.**
After the demo, set `CITY_TOOLS_FOR_EVERYONE=false` to restore the staff-only
rules (city administrators and staff).

## Frontend

A Vite + React + TypeScript app in `src/frontend/vilkas`, with a typed client
for this API in `src/api/` (see `planning/FRONTEND_PLAN.md`).

### Run it against the backend
```bash
# terminal 1 – the API
uv --directory ./src/backend run python manage.py runserver

# terminal 2 – the app
cd src/frontend/vilkas
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/media` to
`http://127.0.0.1:8000`, so the browser sees a single origin and no CORS setup
is needed; set `VITE_BACKEND_URL` to point at a backend somewhere else.

To work on the frontend without a backend, `npm run dev:mocks` serves the same
endpoints from [MSW](https://mswjs.io/) fixtures instead.

### Test on a phone (same Wi-Fi)
The phone talks to the Vite dev server, which forwards `/api` and `/media` to
Django, so only the dev server has to be reachable. Find the computer's Wi-Fi
address first (`ipconfig` on Windows, `ip addr` on Linux, e.g. `10.194.94.151`).

Terminal 1 – the API. Django must accept the phone's Host header (the Wi-Fi IP);
binding to `0.0.0.0` also lets the phone open `http://<ip>:8000/api/schema/swagger-ui/`.

```powershell
# Windows PowerShell (the variable lasts for this terminal window)
$env:DJANGO_ALLOWED_HOSTS="<ip>,localhost,127.0.0.1"
uv --directory ./src/backend run python manage.py runserver 0.0.0.0:8000
```

```bash
# bash / Git Bash / macOS / Linux
DJANGO_ALLOWED_HOSTS=<ip>,localhost,127.0.0.1 uv --directory ./src/backend run python manage.py runserver 0.0.0.0:8000
```

Terminal 2 – the app, on all network interfaces, over HTTPS:

```bash
cd src/frontend/vilkas
npm run dev:lan
```

On the phone open `https://<ip>:5173` and accept the certificate warning once.
HTTPS (a self-signed certificate) is needed because phone browsers only allow
location on secure pages. (The mock API can't run here: browsers won't start
its service worker on a self-signed certificate, so use the real backend.)

If the phone can't connect, the firewall is blocking it. On Windows, when the
Wi-Fi network is marked *Public*, run once in an **administrator** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Vilkas dev (5173, 8000)" -Direction Inbound -Protocol TCP -LocalPort 5173,8000 -Action Allow -Profile Private,Public
```

Only do this on networks you trust: the dev servers run with `DEBUG` on.

### Checks
```bash
cd src/frontend/vilkas
npm run lint
npm run build
```
